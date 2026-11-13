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

function bridge() {
  if (typeof window === 'undefined') return null;
  return window.liaForge?.studio ?? null;
}

async function request(route, { method = 'GET', body = null } = {}) {
  const response = await fetch(`${PREFIX}${route}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
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
  async configureProvider(payload) {
    const ipc = bridge();
    if (ipc) return ipc.configureProvider(payload);
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
  async reviewStep(runId, { stepId, approved, reviewer = null, note = null }) {
    const ipc = bridge();
    if (ipc) return ipc.reviewStep({ runId, stepId, approved, reviewer, note });
    return request(`/runs/${encodeURIComponent(runId)}/review`, {
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
