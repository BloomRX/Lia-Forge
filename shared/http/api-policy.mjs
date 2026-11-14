/**
 * Política da API HTTP do Studio Lia Forge (P0 de segurança).
 *
 * Por que este módulo existe
 * --------------------------
 * O caminho do produto é o Electron: renderer isolado → IPC → serviço, com
 * `assertTrustedIpcSender` em todos os handlers. A API HTTP é o **segundo**
 * transporte, criado para o navegador/preview, e ela expunha as mesmas
 * operações sem nenhuma das proteções do IPC:
 *
 *   - requisição **sem** `Origin` era aceita (`if (!origin) return true`);
 *   - `Host` não era verificado, então qualquer nome que resolvesse para a
 *     máquina (DNS rebinding) era atendido;
 *   - nenhuma autenticação: quem alcançasse a porta podia gravar o caminho de
 *     um executável (`POST /providers`) e mandá-lo rodar (`POST /run`);
 *   - decisão humana (`POST /runs/:id/review`) e autorização de provider
 *     podiam ser registradas por qualquer requisição.
 *
 * Reproduzido antes de corrigir: `POST /providers` sem `Origin` gravou um
 * executável arbitrário, `POST /run` o executou e o arquivo marcado pelo
 * binário foi criado. Ver `tests/http-api-policy-smoke.mjs`.
 *
 * O que este módulo decide (e o que o `vite.config.js` apenas aplica)
 * -------------------------------------------------------------------
 * 1. **Bind local por padrão.** O servidor só escuta em loopback; abrir para a
 *    rede é opt-in explícito por variável de ambiente.
 * 2. **Host fechado.** Lista explícita de hosts atendidos. `allowedHosts: true`
 *    (qualquer host) deixa de existir.
 * 3. **Origin obrigatório em operação que muda estado.** Ausência de `Origin`
 *    era tratada como "ferramenta local"; agora é recusada em rotas mutáveis,
 *    porque é exatamente o caso de uma requisição forjada (form/curl/DNS
 *    rebinding sem preflight).
 * 4. **Token por sessão em toda rota mutável.** O token é gerado no início do
 *    processo, entregue ao navegador por um módulo ESM servido same-origin
 *    (nunca embutido em HTML, para não vazar em snapshot/proxy log) e exigido
 *    no header `x-lia-forge-token`.
 * 5. **Operações privilegiadas fora do HTTP.** Configuração de provider
 *    (caminho de executável, endpoint), autorização de provider e decisão de
 *    revisão humana são exclusivas do IPC. Pelo HTTP elas devolvem 403 com o
 *    motivo — o preview continua mostrando o estado, só não o altera.
 *
 * Nada aqui instala, baixa, compra ou envia dados. O módulo é puro: não abre
 * socket nem toca disco, o que permite testá-lo sem servidor.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Header que carrega o token de sessão. */
export const TOKEN_HEADER = 'x-lia-forge-token';

/** Rota que entrega o token ao navegador (mesma origem, sem cache). */
export const TOKEN_MODULE_ROUTE = '/@lia-forge/session-token.js';

/**
 * Hosts atendidos por padrão.
 *
 * `localhost` e `127.0.0.1` cobrem o uso local; `[::1]` cobre IPv6. Os hosts
 * `*.e2b.app` existem porque o preview desta estação de trabalho é servido por
 * um proxy com hostname próprio por sessão — sem eles o produto não abre no
 * preview. A lista é **fechada**: qualquer outro `Host` é recusado antes de
 * chegar a qualquer rota (mitigação de DNS rebinding).
 */
export const DEFAULT_ALLOWED_HOSTS = Object.freeze([
  'localhost',
  '127.0.0.1',
  '[::1]',
  '::1',
]);

/** Sufixos de host permitidos além da lista exata (o proxy do preview). */
export const DEFAULT_ALLOWED_HOST_SUFFIXES = Object.freeze(['.e2b.app']);

/**
 * Rotas que só existem no transporte IPC.
 *
 * São as três decisões que o produto não delega a uma requisição HTTP:
 *   - `POST /providers`  → configura caminho de executável/endpoint (R-01);
 *   - autorização de provider remoto (envio de dados e custo);
 *   - `POST /runs/:id/review` → decisão humana sobre um artefato (C-06).
 *
 * Cada entrada é `{ method, match }`; `match` recebe a rota (sem o prefixo).
 */
export const IPC_ONLY_OPERATIONS = Object.freeze([
  {
    id: 'provider-configuration',
    method: 'POST',
    match: (route) => route === '/providers',
    reason:
      'Configurar provider (caminho de executável, endpoint, checkpoint) é decisão do produto e só pode ser feita pelo app desktop, sobre IPC verificado. '
      + 'Pela API HTTP isto está bloqueado: gravar um executável aqui permitiria a qualquer requisição fazer o produto rodar um binário escolhido por ela.',
  },
  {
    id: 'provider-authorization',
    method: 'POST',
    match: (route) => route === '/providers/authorization',
    reason:
      'Autorizar envio de dados ou custo é consentimento humano vinculado ao run e só pode ser registrado pelo app desktop, sobre IPC verificado.',
  },
  {
    id: 'human-review',
    method: 'POST',
    match: (route) => /^\/runs\/[^/]+\/review$/.test(route),
    reason:
      'Aprovar ou rejeitar um artefato é decisão humana e fica registrada como proveniência; só pode ser feita pelo app desktop, sobre IPC verificado, onde a autoria vem do canal e não do corpo da requisição.',
  },
]);

/**
 * Rotas que mudam estado **e existem**: são as únicas que recebem token.
 *
 * A regra é invertida de propósito. `isMutable` trata **qualquer** método que
 * não seja GET/HEAD/OPTIONS como mutável (exige `Origin` e token), enquanto esta
 * lista diz quais rotas mutáveis o servidor realmente oferece. Uma rota nova que
 * alguém acrescente sem listá-la aqui não fica desprotegida: ela é recusada com
 * 401 por falta de token, e o teste `POST em rota não listada` falha se alguém a
 * aceitar. Fail-closed nas duas pontas.
 */
export const MUTABLE_ROUTES = Object.freeze([
  { method: 'POST', match: (route) => route === '/inputs' },
  { method: 'POST', match: (route) => route === '/compare' },
  { method: 'POST', match: (route) => route === '/plan' },
  { method: 'POST', match: (route) => route === '/run' },
  { method: 'POST', match: (route) => /^\/runs\/[^/]+\/(cancel|resume)$/.test(route) },
  { method: 'POST', match: (route) => /^\/runs\/[^/]+\/export$/.test(route) },
  { method: 'POST', match: (route) => route === '/assets' },
  { method: 'POST', match: (route) => /^\/assets\/[^/]+\/(rights|attach-run|versions)$/.test(route) },
]);

/** Rotas mutáveis do store legado (`/api/spriteforge/assets`, fora do prefixo). */
export const LEGACY_MUTABLE_ROUTES = Object.freeze([
  { method: 'PUT', match: (route) => route === '/assets' },
]);

/**
 * Cria a política de uma sessão.
 *
 * @param {{token?:string, allowedHosts?:string[], allowedHostSuffixes?:string[]}} [options]
 * @returns {{token:string, allowedHosts:string[], allowedHostSuffixes:string[],
 *   isHostAllowed:(host:string|null|undefined)=>boolean,
 *   isOriginAllowed:(origin:string|null|undefined, host:string|null|undefined)=>boolean,
 *   classify:(input:{method:string, route:string, origin?:string|null, host?:string|null, token?:string|null})=>PolicyDecision,
 *   tokenModuleSource:()=>string,
 *   sign:(payload:string)=>string}}
 */
export function createHttpApiPolicy(options = {}) {
  const token = typeof options.token === 'string' && options.token.length >= 32
    ? options.token
    : randomBytes(32).toString('base64url');
  const allowedHosts = Object.freeze([...(options.allowedHosts ?? DEFAULT_ALLOWED_HOSTS)].map((host) => String(host).toLowerCase()));
  const allowedHostSuffixes = Object.freeze([...(options.allowedHostSuffixes ?? DEFAULT_ALLOWED_HOST_SUFFIXES)].map((suffix) => String(suffix).toLowerCase()));

  /** `Host` sem porta e em minúsculas; `null` quando ausente/inválido. */
  function normalizeHost(host) {
    const text = String(host ?? '').split(',')[0].trim().toLowerCase();
    if (!text) return null;
    // IPv6 vem entre colchetes (`[::1]:5173`); host:port vem separado.
    if (text.startsWith('[')) {
      const end = text.indexOf(']');
      return end === -1 ? null : text.slice(0, end + 1);
    }
    const colon = text.lastIndexOf(':');
    return colon === -1 ? text : text.slice(0, colon);
  }

  function isHostAllowed(host) {
    const normalized = normalizeHost(host);
    if (!normalized) return false;
    if (allowedHosts.includes(normalized)) return true;
    return allowedHostSuffixes.some((suffix) => normalized.endsWith(suffix) && normalized.length > suffix.length);
  }

  /**
   * `Origin` tem de existir, ser http/https e ter o **mesmo host** do pedido.
   *
   * O proxy do preview reescreve o `Host` visto pelo servidor; por isso o host
   * comparado vem de `x-forwarded-host` quando presente (comportamento que já
   * existia) e o `Origin` precisa estar na lista fechada de hosts.
   */
  function isOriginAllowed(origin, host) {
    const text = String(origin ?? '').trim();
    if (!text) return false;
    let parsed;
    try {
      parsed = new URL(text);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    // O Origin precisa estar na lista fechada **e** ser o mesmo host do pedido.
    // Só a primeira condição não basta: `https://evil.example` não passaria, mas
    // `http://127.0.0.1:5173` enviado a um pedido cujo Host é `localhost:5173`
    // passaria — e é um par origem/destino que o navegador nunca produz.
    if (!isHostAllowed(parsed.host) && !isHostAllowed(parsed.hostname)) return false;
    const effective = normalizeHost(host);
    if (!effective) return false;
    return normalizeHost(parsed.host) === effective || normalizeHost(parsed.hostname) === effective;
  }

  /**
   * Qualquer método que não seja leitura é mutável. Não existe "POST inofensivo":
   * se muda estado, exige `Origin` e token — inclusive em rota que ninguém
   * listou, porque é assim que uma rota nova nasce sem proteção.
   */
  function isMutable(method, _route) {
    const upper = String(method ?? 'GET').toUpperCase();
    return upper !== 'GET' && upper !== 'HEAD' && upper !== 'OPTIONS';
  }

  /** A rota mutável existe? Se não existe, o token não é entregue (404/401). */
  function isKnownMutableRoute(method, route) {
    const upper = String(method ?? 'GET').toUpperCase();
    const path = String(route ?? '');
    return MUTABLE_ROUTES.some((entry) => entry.method === upper && entry.match(path))
      || LEGACY_MUTABLE_ROUTES.some((entry) => entry.method === upper && entry.match(path));
  }

  function isTokenValid(candidate) {
    const given = Buffer.from(String(candidate ?? ''), 'utf8');
    const expected = Buffer.from(token, 'utf8');
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  /**
   * Decide uma requisição antes de qualquer rota.
   *
   * Ordem deliberada: host → operação privilegiada → origem → token. O host vem
   * primeiro porque é o que impede DNS rebinding; a operação privilegiada vem
   * antes da origem/token porque ela é recusada **mesmo** com token válido (é o
   * transporte que não a oferece, não a credencial).
   *
   * @returns {{allow:true}|{allow:false, status:number, code:string, reason:string}}
   */
  function classify({ method, route, origin = null, host = null, forwardedHost = null, token: candidate = null } = {}) {
    const upper = String(method ?? 'GET').toUpperCase();
    const path = String(route ?? '/');
    const effectiveHost = normalizeHost(forwardedHost) ?? normalizeHost(host);

    if (!isHostAllowed(effectiveHost)) {
      return {
        allow: false,
        status: 421,
        code: 'HOST_NOT_ALLOWED',
        reason: `Host "${String(host ?? '')}" não está na lista de hosts atendidos por esta sessão. `
          + 'O servidor é local: só localhost, 127.0.0.1, [::1] e os hosts de preview declarados são aceitos.',
      };
    }

    const privileged = IPC_ONLY_OPERATIONS.find((entry) => entry.method === upper && entry.match(path));
    if (privileged) {
      return { allow: false, status: 403, code: 'IPC_ONLY_OPERATION', reason: privileged.reason, operation: privileged.id };
    }

    const mutable = isMutable(upper, path);
    if (!mutable) {
      // Leitura: se o navegador mandou `Origin`, ele tem de ser o mesmo host do
      // pedido. Ausência de `Origin` é aceita em leitura porque ferramenta local
      // (o MCP conferindo o painel, por exemplo) não envia o header — e leitura
      // não produz efeito. O que mudou em relação ao estado anterior é que um
      // `Origin` de outro site deixou de passar: antes a comparação só existia
      // quando o header vinha, mas o resultado era ignorado nas rotas de leitura.
      if (origin !== null && origin !== undefined && String(origin).trim() !== '' && !isOriginAllowed(origin, effectiveHost)) {
        return {
          allow: false,
          status: 403,
          code: 'ORIGIN_MISMATCH',
          reason: 'Leitura recusada: o Origin da requisição não é o mesmo host atendido por este servidor local.',
        };
      }
      return Object.freeze({ allow: true, mutable: false });
    }

    if (!isKnownMutableRoute(upper, path)) {
      return {
        allow: false,
        status: 401,
        code: 'UNKNOWN_MUTABLE_ROUTE',
        reason: `Nenhuma operação "${upper} ${path}" é oferecida por esta API. `
          + 'Rota mutável desconhecida não recebe token: se ela passou a existir, liste-a em MUTABLE_ROUTES e escreva o teste.',
      };
    }

    if (!isOriginAllowed(origin, effectiveHost)) {
      return {
        allow: false,
        status: 403,
        code: 'ORIGIN_REQUIRED',
        reason: 'Operação que muda estado exige Origin da mesma origem. Uma requisição sem Origin (ou de outra origem) '
          + 'pode ter sido forjada por outro site, e o produto não executa nada que você não tenha iniciado na interface.',
      };
    }

    if (!isTokenValid(candidate)) {
      return {
        allow: false,
        status: 401,
        code: 'TOKEN_REQUIRED',
        reason: 'Operação que muda estado exige o token desta sessão (header x-lia-forge-token). '
          + 'O token é gerado quando o servidor sobe e entregue somente à página servida por ele.',
      };
    }

    return { allow: true, mutable: true };
  }

  /**
   * Fonte do módulo ESM que entrega o token à página.
   *
   * É um módulo (não HTML) por três razões: o navegador o importa com a mesma
   * origem da página; ele não aparece em snapshot de DOM nem em log de proxy que
   * registre HTML; e o Electron (que não usa HTTP) nunca o solicita.
   */
  function tokenModuleSource() {
    return `// Gerado pelo servidor do Studio Lia Forge para esta sessão.\n`
      + `// Não é segredo de longo prazo: vale enquanto este processo existir.\n`
      + `export const sessionToken = ${JSON.stringify(token)};\n`
      + `export const tokenHeader = ${JSON.stringify(TOKEN_HEADER)};\n`;
  }

  /**
   * Assina um payload com o token da sessão (HMAC-SHA256).
   *
   * Existe para o caso de uma rota precisar provar que um valor veio do
   * servidor (por exemplo um caminho de artefato servido por URL). Não é usado
   * para autorização de operação — para isso vale `classify`.
   */
  function sign(payload) {
    return createHmac('sha256', token).update(String(payload)).digest('base64url');
  }

  return Object.freeze({
    token,
    allowedHosts,
    allowedHostSuffixes,
    normalizeHost,
    isHostAllowed,
    isOriginAllowed,
    isMutable,
    isKnownMutableRoute,
    isTokenValid,
    classify,
    tokenModuleSource,
    sign,
  });
}

/**
 * Onde o servidor deve escutar.
 *
 * Padrão: **loopback**. Abrir para a rede exige duas variáveis explícitas, e o
 * motivo fica registrado — nunca por `allowedHosts: true`, que era o estado
 * anterior (qualquer host, qualquer interface).
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{host:string, exposed:boolean, reason:string}}
 */
export function resolveBindHost(env = process.env) {
  const expose = String(env.LIA_FORGE_HTTP_EXPOSE ?? '').trim().toLowerCase();
  const requested = String(env.LIA_FORGE_HTTP_HOST ?? '').trim();
  if (expose === '1' || expose === 'true') {
    return {
      host: requested || '0.0.0.0',
      exposed: true,
      reason: `Exposição explícita por LIA_FORGE_HTTP_EXPOSE=${expose}`
        + (requested ? ` e LIA_FORGE_HTTP_HOST=${requested}` : '')
        + '. O token de sessão e a lista de hosts continuam valendo.',
    };
  }
  return {
    host: '127.0.0.1',
    exposed: false,
    reason: 'Bind em loopback por padrão. Para expor na rede é preciso LIA_FORGE_HTTP_EXPOSE=1 (e, opcionalmente, LIA_FORGE_HTTP_HOST).',
  };
}

/**
 * Lista de hosts aceita pelo Vite (`server.allowedHosts`).
 *
 * Nunca `true`. Vite aceita `false`/lista; aqui devolvemos a lista exata da
 * política mais os sufixos, no formato que o Vite entende (strings com ponto
 * inicial para sufixos).
 */
export function viteAllowedHosts(policy) {
  return [...policy.allowedHosts, ...policy.allowedHostSuffixes.map((suffix) => suffix.replace(/^\./, '.'))];
}

export default createHttpApiPolicy;
