/**
 * Configuração de providers do Lia Forge (§9 — backends e alternativas).
 *
 * O produto precisa oferecer escolha real entre executar **local**, executar
 * **remoto** (worker próprio, GPU alugada, serviço hospedado ou Colab) e
 * **desativar** um provider — sem obrigar nenhum caminho e sem nunca contatar
 * um servidor remoto por conta própria.
 *
 * Regras duras deste módulo:
 *   - nada é instalado, baixado ou comprado aqui: só configuração;
 *   - segredos nunca são gravados (token/apiKey/senha/credencial são recusados;
 *     apenas uma *referência* a credencial do cofre do usuário é aceita);
 *   - endpoint remoto exige autorização humana explícita registrada (quem,
 *     quando e o escopo: envio de dados + custo);
 *   - o caminho local só aceita loopback: apontar o adapter "local" para outra
 *     máquina seria envio de dados disfarçado;
 *   - escrita atômica e confinada a `<projeto>/.lia-forge/providers.json`.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const PROVIDER_STORE_SCHEMA_VERSION = 1;
export const PROVIDER_MODES = Object.freeze(['local-loopback', 'remote', 'disabled']);
export const BLENDER_MODES = Object.freeze(['auto', 'path', 'disabled']);
export const PROVIDER_FILE = path.join('.lia-forge', 'providers.json');

/** Campos que nunca podem ser gravados em disco por esta configuração. */
const FORBIDDEN_FIELDS = Object.freeze([
  'token', 'tokens', 'apikey', 'api_key', 'password', 'secret', 'secrets',
  'credential', 'credentials', 'authorizationheader', 'cookie', 'cookies',
]);

const LOOPBACK_HOSTS = Object.freeze(['127.0.0.1', '::1', '[::1]', 'localhost', '0.0.0.0']);

export class ProviderConfigError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ProviderConfigError';
    this.code = 'PROVIDER_CONFIG_INVALID';
    Object.assign(this, details);
  }
}

export function isLoopbackEndpoint(endpoint) {
  try {
    return LOOPBACK_HOSTS.includes(new URL(endpoint).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Valida uma URL de endpoint: HTTP(S), sem credenciais, query ou fragmento. */
export function normalizeEndpoint(value, { field = 'endpoint' } = {}) {
  if (value === null || value === undefined || value === '') return null;
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new ProviderConfigError(`${field} precisa ser uma URL HTTP ou HTTPS válida.`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new ProviderConfigError(`${field} precisa usar http ou https.`);
  if (url.username || url.password) throw new ProviderConfigError(`${field} não pode conter credenciais; use uma referência ao seu cofre.`);
  if (url.search || url.hash) throw new ProviderConfigError(`${field} não pode conter query nem fragmento.`);
  return url.origin;
}

function assertNoSecrets(input) {
  for (const key of Object.keys(input ?? {})) {
    if (FORBIDDEN_FIELDS.includes(key.toLowerCase().replace(/[-_\s]/g, ''))) {
      throw new ProviderConfigError(`O campo "${key}" é um segredo e nunca é gravado aqui. Use credentialRef (referência ao seu cofre) e mantenha o valor fora do projeto.`);
    }
  }
}

export function defaultProviderConfig() {
  return {
    schemaVersion: PROVIDER_STORE_SCHEMA_VERSION,
    updatedAt: null,
    providers: {
      comfyui: {
        // local-loopback: servidor ComfyUI na própria máquina (nenhum dado sai).
        // remote: worker/hosted/GPU alugada/Colab — exige autorização gravada.
        // disabled: não contatar nada.
        mode: 'local-loopback',
        endpoint: null,
        checkpoint: null,
        workflowId: null,
        credentialRef: null,
        maxCostUnits: null,
        authorization: { granted: false, grantedAt: null, grantedBy: null, scope: null },
      },
      blender: {
        // auto: descobre no PATH/aplicativos instalados; path: caminho informado
        // pelo usuário; disabled: não usar Blender.
        mode: 'auto',
        executable: null,
        scriptPath: null,
        frameSize: '48x48',
      },
    },
  };
}

/**
 * @param {object} options
 * @param {string} options.projectRoot raiz do projeto (escrita confinada aqui)
 * @param {() => Date} [options.now]
 */
export function createProviderStore({ projectRoot, now = () => new Date() } = {}) {
  if (!projectRoot) throw new ProviderConfigError('createProviderStore: projectRoot é obrigatório.');
  const root = path.resolve(projectRoot);
  const file = path.join(root, PROVIDER_FILE);

  async function read() {
    let raw = null;
    try {
      raw = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        // Arquivo corrompido: nunca sobrescrever em silêncio — devolve o padrão
        // e informa, para o usuário decidir o que fazer com o original.
        return { ...defaultProviderConfig(), corrupt: { message: error.message, file: path.relative(root, file) } };
      }
      return defaultProviderConfig();
    }
    const base = defaultProviderConfig();
    const providers = base.providers;
    for (const [id, stored] of Object.entries(raw?.providers ?? {})) {
      if (!providers[id]) continue;
      providers[id] = { ...providers[id], ...stored };
      if (id === 'comfyui') {
        providers[id].authorization = { ...base.providers.comfyui.authorization, ...(stored?.authorization ?? {}) };
      }
    }
    return { schemaVersion: PROVIDER_STORE_SCHEMA_VERSION, updatedAt: raw?.updatedAt ?? null, providers };
  }

  async function write(config) {
    const target = path.join(root, '.lia-forge');
    await fs.mkdir(target, { recursive: true });
    const serialized = `${JSON.stringify(config, null, 2)}\n`;
    const temporary = path.join(target, `providers.${process.pid}.${randomUUID()}.tmp`);
    await fs.writeFile(temporary, serialized, { encoding: 'utf8', flag: 'wx' });
    try {
      await fs.rename(temporary, file);
    } catch (error) {
      await fs.rm(temporary, { force: true });
      throw error;
    }
    return config;
  }

  /**
   * Aplica uma alteração de configuração validada.
   *
   * @param {object} input
   * @param {string} input.id 'comfyui' | 'blender'
   * @param {string} [input.mode]
   * @param {string|null} [input.endpoint]
   * @param {string|null} [input.checkpoint]
   * @param {string|null} [input.workflowId]
   * @param {string|null} [input.credentialRef]
   * @param {number|null} [input.maxCostUnits]
   * @param {string|null} [input.executable]
   * @param {string|null} [input.frameSize]
   * @param {{granted?:boolean, grantedBy?:string, scope?:string}} [input.authorization]
   * @param {string} [input.decidedBy]
   */
  async function configure(input = {}) {
    assertNoSecrets(input);
    const id = String(input.id ?? '');
    const current = await read();
    if (!current.providers[id]) {
      throw new ProviderConfigError(`Provider desconhecido "${id}". Disponíveis: ${Object.keys(current.providers).join(', ')}.`);
    }
    const next = structuredClone(current.providers[id]);
    const decidedBy = String(input.decidedBy ?? 'usuário').slice(0, 120);

    if (id === 'comfyui') {
      if (input.mode !== undefined) {
        if (!PROVIDER_MODES.includes(input.mode)) throw new ProviderConfigError(`Modo inválido "${input.mode}". Use: ${PROVIDER_MODES.join(', ')}.`);
        next.mode = input.mode;
      }
      if (input.endpoint !== undefined) next.endpoint = normalizeEndpoint(input.endpoint);
      if (input.checkpoint !== undefined) next.checkpoint = input.checkpoint === null ? null : String(input.checkpoint).slice(0, 200);
      if (input.workflowId !== undefined) next.workflowId = input.workflowId === null ? null : String(input.workflowId).slice(0, 120);
      if (input.credentialRef !== undefined) next.credentialRef = input.credentialRef === null ? null : String(input.credentialRef).slice(0, 200);
      if (input.maxCostUnits !== undefined) {
        if (input.maxCostUnits !== null && (!Number.isFinite(input.maxCostUnits) || input.maxCostUnits < 0)) {
          throw new ProviderConfigError('maxCostUnits precisa ser um número não negativo (ou null para não definir teto).');
        }
        next.maxCostUnits = input.maxCostUnits;
      }
      if (next.mode === 'local-loopback' && next.endpoint && !isLoopbackEndpoint(next.endpoint)) {
        throw new ProviderConfigError('O modo local só aceita endpoint da própria máquina (loopback). Para outra máquina, use o modo remoto com autorização explícita.');
      }
      if (next.mode === 'remote') {
        if (!next.endpoint) throw new ProviderConfigError('O modo remoto exige um endpoint HTTPS do worker/hosted.');
        if (isLoopbackEndpoint(next.endpoint)) throw new ProviderConfigError('O modo remoto recusa loopback: para servidor local use o modo local-loopback.');
      }
      if (input.authorization !== undefined) {
        const granted = input.authorization?.granted === true;
        next.authorization = {
          granted,
          grantedAt: granted ? now().toISOString() : null,
          grantedBy: granted ? String(input.authorization?.grantedBy ?? decidedBy).slice(0, 120) : null,
          scope: granted ? String(input.authorization?.scope ?? 'send_data+cost').slice(0, 200) : null,
        };
      }
      if (next.mode === 'remote' && next.authorization.granted !== true) {
        // Não é erro: fica pendente. O produto mostra a pendência e não contata.
        next.authorization = { ...next.authorization, granted: false };
      }
    }

    if (id === 'blender') {
      if (input.mode !== undefined) {
        if (!BLENDER_MODES.includes(input.mode)) throw new ProviderConfigError(`Modo inválido "${input.mode}". Use: ${BLENDER_MODES.join(', ')}.`);
        next.mode = input.mode;
      }
      if (input.executable !== undefined) next.executable = input.executable === null ? null : String(input.executable).slice(0, 400);
      if (input.scriptPath !== undefined) next.scriptPath = input.scriptPath === null ? null : String(input.scriptPath).slice(0, 400);
      if (input.frameSize !== undefined) next.frameSize = String(input.frameSize ?? '48x48').slice(0, 12);
      if (next.mode === 'path' && !next.executable) throw new ProviderConfigError('O modo "path" exige o caminho do executável do Blender instalado por você.');
    }

    const updated = {
      schemaVersion: PROVIDER_STORE_SCHEMA_VERSION,
      updatedAt: now().toISOString(),
      providers: { ...current.providers, [id]: next },
    };
    await write(updated);
    return Object.freeze({ id, provider: next, updatedAt: updated.updatedAt });
  }

  return Object.freeze({ file: path.relative(root, file), read, configure, write });
}

export default createProviderStore;
