/**
 * Cliente do Studio Lia Forge (F8 — §11).
 *
 * Um único conjunto de métodos para os dois hospedeiros reais do produto:
 *   - Electron (desktop): chama `window.liaForge.studio.*`, que o preload expõe
 *     sobre os canais IPC `lia-forge:studio:*` do `electron/main.cjs`;
 *   - Navegador/preview: chama a API HTTP same-origin do plugin
 *     `liaForgeStudioApi` (`vite.config.js`).
 *
 * Os dois lados executam exatamente o mesmo `createStudioService`, então não
 * existe um segundo sistema — só dois transportes. As URLs HTTP são relativas
 * de propósito: no preview o navegador fala com o proxy da sessão, nunca com
 * localhost. Nada aqui instala, baixa, compra ou envia dados.
 */

const PREFIX = '/api/lia-forge/studio';

/**
 * Token da sessão HTTP (P0 de segurança).
 *
 * No Electron o transporte é o IPC e não há token: a autoria vem do canal
 * verificado. No navegador/preview o token é buscado uma vez no módulo que o
 * próprio servidor gera (`/@lia-forge/session-token.js`) e enviado no header
 * `x-lia-forge-token` em toda operação que muda estado. Se o módulo não existir
 * (servidor antigo, ou Electron), a chamada segue sem token e o servidor decide.
 */
const TOKEN_MODULE = '/@lia-forge/session-token.js';
const TOKEN_HEADER = 'x-lia-forge-token';
let sessionTokenPromise = null;

/**
 * `Origin` da própria página.
 *
 * O navegador envia este header sozinho em toda requisição same-origin; quem
 * executa o cliente fora dele (Node em teste, script de integração) não envia, e
 * o servidor exige `Origin` em operação que muda estado — sem ele a requisição é
 * indistinguível de uma forjada. Completar o header aqui não enfraquece a regra:
 * o valor vem de `window.location`, ou seja, da página que o servidor mesmo
 * serviu, e um site de terceiros não consegue fazê-lo apontar para outro lugar
 * (o navegador não permite sobrescrever `Origin`).
 */
function pageOrigin() {
  if (typeof window === 'undefined') return null;
  try {
    return window.location?.origin ?? null;
  } catch {
    return null;
  }
}

function sessionToken() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!sessionTokenPromise) {
    // `import()` relativo funciona no navegador; em SSR (Node) o módulo é
    // resolvido pelo pipeline do bundler quando o hospedeiro oferece esse gancho.
    const loader = typeof window.__liaForgeImport === 'function'
      ? window.__liaForgeImport(TOKEN_MODULE)
      : import(/* @vite-ignore */ TOKEN_MODULE);
    sessionTokenPromise = Promise.resolve(loader)
      .then((module) => (typeof module?.sessionToken === 'string' ? module.sessionToken : null))
      .catch(() => null);
  }
  return sessionTokenPromise;
}

function bridge() {
  if (typeof window === 'undefined') return null;
  return window.liaForge?.studio ?? null;
}

/**
 * Operação exclusiva do IPC.
 *
 * Consulta o servidor e, se ele recusar com `IPC_ONLY_OPERATION`, devolve um
 * resultado explicável (`{ ipcOnly: true, ok: false, reason }`) em vez de lançar.
 * Devolve `null` quando o servidor **não** recusou — aí o chamador faz a chamada
 * normal. Um servidor antigo, que ainda aceite a rota, continua funcionando: a
 * restrição é do servidor, e o cliente só a explica.
 */
async function requestIpcOnly(route, { method = 'POST', body = null } = {}) {
  try {
    const token = await sessionToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers[TOKEN_HEADER] = token;
    const origin = pageOrigin();
    if (origin && origin !== 'null') headers.Origin = origin;
    const response = await fetch(`${PREFIX}${route}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status !== 403) return null;
    const payload = await response.json().catch(() => ({}));
    if (payload?.code !== 'IPC_ONLY_OPERATION') return null;
    return Object.freeze({
      ipcOnly: true,
      ok: false,
      reason: String(payload.error ?? 'Esta operação só pode ser feita no aplicativo desktop.'),
    });
  } catch {
    return null;
  }
}

async function request(route, { method = 'GET', body = null } = {}) {
  const token = await sessionToken();
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers[TOKEN_HEADER] = token;
  const origin = pageOrigin();
  if (origin && origin !== 'null') headers.Origin = origin;
  const response = await fetch(`${PREFIX}${route}`, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text.slice(0, 400) };
    }
  }
  if (!response.ok) throw new Error(payload?.error || `A API do Studio respondeu HTTP ${response.status}.`);
  return payload;
}

/** Uint8Array → base64 sem estourar a pilha com arquivos grandes. */
function toBase64(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []);
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < view.length; offset += chunk) {
    binary += String.fromCharCode(...view.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const liaForgeApi = {
  /** true quando roda dentro do Electron (IPC), false no navegador (HTTP). */
  get transport() {
    return bridge() ? 'ipc' : 'http';
  },

  /** Visão geral: máquina, capacidades, adapters, preflight, workflows, assets. */
  async overview() {
    const ipc = bridge();
    if (ipc) return ipc.overview();
    return request('/overview');
  },

  /** Os 8 workflows com estado real por passo (pronto/bloqueado e por quê). */
  async workflows() {
    const ipc = bridge();
    if (ipc) return ipc.workflows();
    const payload = await request('/workflows');
    return payload.workflows ?? [];
  },

  /** Requisitos e ações humanas; `capabilities` filtra por capacidade. */
  async preflight(capabilities = null) {
    const ipc = bridge();
    if (ipc) return ipc.preflight(capabilities);
    return request(`/preflight${query({ capabilities: capabilities?.length ? capabilities.join(',') : null })}`);
  },

  /** Passo 1: a pasta do projeto, o que há nela e o que é preservado. */
  async projectInfo() {
    const ipc = bridge();
    if (ipc) return ipc.projectInfo();
    return request('/project');
  },

  /**
   * Abre (ou cria) a pasta do projeto — só no aplicativo desktop, onde existe
   * seletor de pasta. No navegador devolve null: a raiz vem do servidor.
   */
  async chooseProject({ create = false } = {}) {
    const ipc = bridge();
    return ipc ? ipc.chooseProject({ create }) : null;
  },

  /** Mostra a pasta do projeto no gerenciador de arquivos (só no desktop). */
  async revealProject() {
    const ipc = bridge();
    return ipc ? ipc.revealProject() : null;
  },

  /** Entradas disponíveis em `<projeto>/input/` (referências e modelos). */
  async listInputs() {
    const ipc = bridge();
    if (ipc) return ipc.listInputs();
    return request('/inputs');
  },

  /**
   * Copia um arquivo do usuário para `input/` (o original nunca é movido).
   * `bytes` é um Uint8Array/Buffer; o transporte HTTP exige base64.
   */
  async saveInput({ filename, bytes, note = null }) {
    const base64 = toBase64(bytes);
    const ipc = bridge();
    if (ipc) return ipc.saveInput({ filename, base64, note });
    return request('/inputs', { method: 'POST', body: { filename, base64, note } });
  },

  /**
   * Abre o seletor de arquivos do sistema (só no desktop). No navegador devolve
   * null: a interface usa `<input type="file">` e chama `saveInput`.
   */
  async pickInput() {
    const ipc = bridge();
    return ipc ? ipc.pickInput() : null;
  },

  /** Fonte de imagem para uma entrada: URL HTTP ou data URL (desktop). */
  async inputSource(relativePath) {
    const ipc = bridge();
    if (ipc) {
      try {
        const file = await ipc.readInput(relativePath);
        if (!file?.contentType?.startsWith('image/')) return null;
        return `data:${file.contentType};base64,${file.base64}`;
      } catch {
        return null;
      }
    }
    if (!/\.(png|jpe?g|webp)$/i.test(relativePath)) return null;
    return `${PREFIX}/input-file${query({ path: relativePath })}`;
  },

  /** Comparison Lab: métricas reais lado a lado (até 8 artefatos). */
  async compareArtifacts(paths) {
    const ipc = bridge();
    if (ipc) return ipc.compareArtifacts(paths);
    return request('/compare', { method: 'POST', body: { paths } });
  },

  /**
   * Providers (§9): como cada ferramenta externa será usada — local (loopback),
   * remota (só com autorização gravada) ou desativada — e o estado real medido
   * agora (versão, endpoint, executável, requisitos não atendidos).
   */
  async providers() {
    const ipc = bridge();
    if (ipc) return ipc.providers();
    return request('/providers');
  },

  /**
   * Altera um provider. Segredos são recusados pelo serviço (nunca gravados);
   * endpoint remoto exige `authorization.granted` vindo de decisão humana.
   */
  /**
   * Configura um provider (modo, caminho do executável, endpoint, checkpoint).
   *
   * **Só no aplicativo desktop.** Pelo transporte HTTP o servidor recusa com
   * `IPC_ONLY_OPERATION`: gravar caminho de executável é o equivalente a dizer
   * "rode este binário", e o produto não aceita essa decisão de uma requisição
   * que não vem do canal verificado do Electron. O cliente devolve
   * `{ ipcOnly: true, ok: false, reason }` para a interface explicar em vez de
   * lançar erro cru.
   */
  async configureProvider(payload) {
    const ipc = bridge();
    if (ipc) return ipc.configureProvider(payload);
    const refusal = await requestIpcOnly('/providers', { method: 'POST', body: payload });
    if (refusal) return refusal;
    return request('/providers', { method: 'POST', body: payload });
  },

  /** Só planeja (§10): passos, candidatos, custos, licenças e bloqueios. */
  async plan({ workflowId, destination = null, options = {}, brief = null }) {
    const ipc = bridge();
    if (ipc) return ipc.plan({ workflowId, destination, options, brief });
    return request('/plan', { method: 'POST', body: { workflowId, destination, options, brief } });
  },

  /** Executa o que é executável; passos bloqueados permanecem bloqueados. */
  async run({ workflowId, destination = null, options = {}, brief = null, params = {} }) {
    const ipc = bridge();
    if (ipc) return ipc.run({ workflowId, destination, options, brief, params });
    return request('/run', { method: 'POST', body: { workflowId, destination, options, brief, params } });
  },

  async runs() {
    const ipc = bridge();
    if (ipc) return ipc.runs();
    const payload = await request('/runs');
    return payload.runs ?? [];
  },

  async readRun(runId) {
    const ipc = bridge();
    if (ipc) return ipc.readRun(runId);
    return request(`/runs/${encodeURIComponent(runId)}`);
  },

  /** Revisão humana: aprovar retoma do checkpoint; rejeitar mantém bloqueado. */
  /** Execuções em andamento neste processo (progresso + cancelamento real). */
  async activeRuns() {
    const ipc = bridge();
    if (ipc) return ipc.activeRuns();
    const data = await request('/runs/active');
    return data?.active ?? [];
  },

  /**
   * Cancela um run. Se ele está em execução neste processo, o sinal vai para o
   * engine e o passo para no próximo ponto de verificação; se a execução já não
   * existe aqui, o estado gravado é corrigido e a resposta diz isso
   * (`stale: true`) — o produto nunca finge que parou algo que não parou.
   */
  async cancelRun(runId, { reason = null, cancelledBy = null } = {}) {
    const ipc = bridge();
    if (ipc) return ipc.cancelRun({ runId, reason, cancelledBy });
    return request(`/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST', body: { reason, cancelledBy } });
  },

  /** Retoma um run interrompido a partir dos checkpoints válidos. */
  async resumeRun(runId, { reason = null } = {}) {
    const ipc = bridge();
    if (ipc) return ipc.resumeRun({ runId, reason });
    return request(`/runs/${encodeURIComponent(runId)}/resume`, { method: 'POST', body: { reason } });
  },

  /**
   * Registra a decisão humana sobre um passo.
   *
   * **Só no aplicativo desktop.** A revisão é proveniência: diz quem aprovou qual
   * artefato (SHA-256) e quando. Por HTTP a autoria viria do corpo da requisição —
   * qualquer script local assinaria no lugar da pessoa — então o servidor recusa e
   * o cliente devolve `{ ipcOnly: true, ok: false, reason }`.
   */
  async reviewStep(runId, { stepId, approved, reviewer = null, note = null }) {
    const ipc = bridge();
    if (ipc) return ipc.reviewStep({ runId, stepId, approved, reviewer, note });
    const route = `/runs/${encodeURIComponent(runId)}/review`;
    const refusal = await requestIpcOnly(route, { method: 'POST', body: { stepId, approved, reviewer, note } });
    if (refusal) return refusal;
    return request(route, {
      method: 'POST',
      body: { stepId, approved, reviewer, note },
    });
  },

  /** Exporta os artefatos de um run para um destino (perfil + SHA-256). */
  async exportRun(runId, { destination, asset = null }) {
    const ipc = bridge();
    if (ipc) return ipc.exportRun({ runId, destination, asset });
    return request(`/runs/${encodeURIComponent(runId)}/export`, {
      method: 'POST',
      body: { destination, asset },
    });
  },

  /** Preview procedural de VFX (PNG em base64, determinístico por semente). */
  async vfxPreview({ preset = 'explosion', size = 96, frameCount = 8, seed = 'lia-forge' } = {}) {
    const ipc = bridge();
    if (ipc) return ipc.vfxPreview({ preset, size, frameCount, seed });
    return request(`/vfx-preview${query({ preset, size, frameCount, seed })}`);
  },

  async assets() {
    const ipc = bridge();
    if (ipc) return ipc.listAssets();
    return request('/assets');
  },

  async upsertAsset(record) {
    const ipc = bridge();
    if (ipc) return ipc.upsertAsset(record);
    return request('/assets', { method: 'POST', body: record });
  },

  /** Registra uma versão do asset (artefatos escolhidos no Comparison Lab, por exemplo). */
  async addAssetVersion(assetId, version) {
    const ipc = bridge();
    if (ipc) return ipc.addAssetVersion({ assetId, ...version });
    return request(`/assets/${encodeURIComponent(assetId)}/versions`, { method: 'POST', body: version });
  },

  async declareAssetRights(assetId, declaration) {
    const ipc = bridge();
    if (ipc) return ipc.declareAssetRights({ assetId, ...declaration });
    return request(`/assets/${encodeURIComponent(assetId)}/rights`, { method: 'POST', body: declaration });
  },

  async attachRunToAsset(assetId, runId) {
    const ipc = bridge();
    if (ipc) return ipc.attachRunToAsset({ assetId, runId });
    return request(`/assets/${encodeURIComponent(assetId)}/attach-run`, { method: 'POST', body: { runId } });
  },

  async rightsReport() {
    const ipc = bridge();
    if (ipc) return ipc.rightsReport();
    return request('/rights');
  },

  /**
   * Fonte de imagem de um artefato gravado no run.
   *
   * No navegador é a URL HTTP (só dentro de `.lia-forge/runs/`); no desktop não
   * há servidor, então os bytes voltam por IPC e viram data URL. Devolve null
   * quando o artefato não é uma imagem ou não pode ser lido.
   */
  async artifactSource(relativePath) {
    const ipc = bridge();
    if (ipc) {
      try {
        const artifact = await ipc.readArtifact(relativePath);
        if (!artifact?.contentType?.startsWith('image/')) return null;
        return `data:${artifact.contentType};base64,${artifact.base64}`;
      } catch {
        return null;
      }
    }
    if (!/\.(png|jpe?g|webp)$/i.test(relativePath)) return null;
    return `${PREFIX}/artifact${query({ path: relativePath })}`;
  },
};

export default liaForgeApi;
