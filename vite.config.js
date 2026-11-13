import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { getComfyUiStatus, listComfyUiWorkflows, readComfyUiWorkflow } from './scripts/comfyui-client.mjs';

const MAX_STORE_BYTES = 24 * 1024 * 1024;

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function projectAssetStore() {
  const projectRoot = path.resolve(process.env.SPRITEFORGE_PROJECT_ROOT || process.cwd());
  const storeFile = path.join(projectRoot, '.spriteforge', 'assets.json');

  async function assertStorePathInsideProject() {
    const rootReal = await fs.realpath(projectRoot);
    let probe = storeFile;
    while (true) {
      try {
        const realPath = await fs.realpath(probe);
        if (!isInside(rootReal, realPath)) throw new Error('SpriteForge store path escapes the project through a symlink');
        return;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const parent = path.dirname(probe);
        if (parent === probe) throw new Error('SpriteForge store path is outside the project');
        probe = parent;
      }
    }
  }

  return {
    name: 'spriteforge-project-asset-store',
    configureServer(server) {
      server.middlewares.use('/api/spriteforge/assets', async (request, response, next) => {
        const method = request.method || 'GET';
        if (method !== 'GET' && method !== 'PUT') {
          response.statusCode = 405;
          response.setHeader('Allow', 'GET, PUT');
          response.end('Method not allowed');
          return;
        }

        // Keep browser requests same-origin. Requests without Origin are allowed for local tooling.
        const origin = request.headers.origin;
        if (origin) {
          try {
            const originHost = new URL(origin).host;
            const forwardedHost = String(request.headers['x-forwarded-host'] || '').split(',')[0].trim();
            const requestHost = forwardedHost || request.headers.host;
            if (!requestHost || originHost.toLowerCase() !== String(requestHost).toLowerCase()) {
              response.statusCode = 403;
              response.end('Cross-origin access is not allowed');
              return;
            }
          } catch {
            response.statusCode = 403;
            response.end('Invalid Origin header');
            return;
          }
        }

        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');

        if (method === 'GET') {
          try {
            await assertStorePathInsideProject();
            const raw = await fs.readFile(storeFile, 'utf8');
            const store = JSON.parse(raw);
            if (!Array.isArray(store.assets)) throw new Error('Invalid asset store');
            response.statusCode = 200;
            response.end(JSON.stringify({ assets: store.assets, updatedAt: store.updatedAt || null, projectRoot }));
          } catch (error) {
            if (error.code === 'ENOENT') {
              response.statusCode = 200;
              response.end(JSON.stringify({ assets: null, updatedAt: null, projectRoot }));
              return;
            }
            response.statusCode = 500;
            response.end(JSON.stringify({ error: `Could not read SpriteForge asset store: ${error.message}` }));
          }
          return;
        }

        const contentType = String(request.headers['content-type'] || '').toLowerCase();
        if (!contentType.startsWith('application/json')) {
          response.statusCode = 415;
          response.end(JSON.stringify({ error: 'Content-Type must be application/json' }));
          return;
        }

        try {
          let body = '';
          for await (const chunk of request) {
            body += chunk;
            if (Buffer.byteLength(body) > MAX_STORE_BYTES) {
              response.statusCode = 413;
              response.end(JSON.stringify({ error: 'Asset store exceeds the 24 MB limit' }));
              return;
            }
          }
          const payload = JSON.parse(body);
          const assets = payload?.assets;
          if (!Array.isArray(assets) || assets.length > 500) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: 'Expected an assets array with at most 500 items' }));
            return;
          }
          const ids = new Set();
          for (const asset of assets) {
            if (!asset || typeof asset !== 'object' || typeof asset.id !== 'string' || !asset.id.trim() || !['character', 'item'].includes(asset.type)) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Every asset needs a non-empty id and type character or item' }));
              return;
            }
            if (ids.has(asset.id)) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: `Duplicate asset id: ${asset.id}` }));
              return;
            }
            ids.add(asset.id);
          }
          const store = { schemaVersion: 1, assets, updatedAt: new Date().toISOString() };
          await assertStorePathInsideProject();
          await fs.mkdir(path.dirname(storeFile), { recursive: true });
          await assertStorePathInsideProject();
          const temporaryFile = `${storeFile}.${process.pid}.${randomUUID()}.tmp`;
          await fs.writeFile(temporaryFile, `${JSON.stringify(store, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
          try {
            await fs.rename(temporaryFile, storeFile);
          } catch (error) {
            await fs.rm(temporaryFile, { force: true });
            throw error;
          }
          response.statusCode = 200;
          response.end(JSON.stringify({ ok: true, updatedAt: store.updatedAt }));
        } catch (error) {
          if (!response.headersSent) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: error.message || 'Invalid JSON body' }));
          }
        }
      });
    },
  };
}

function comfyUiApi() {
  const prefix = '/api/lia-forge/comfyui';
  return {
    name: 'lia-forge-comfyui-read-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        let pathname;
        try {
          pathname = new URL(request.url || '/', 'http://vite.local').pathname;
        } catch {
          return next();
        }
        if (!pathname.startsWith(prefix)) return next();
        if (request.method !== 'GET') {
          response.statusCode = 405;
          response.setHeader('Allow', 'GET');
          response.end('Method not allowed');
          return;
        }
        const origin = request.headers.origin;
        if (origin) {
          try {
            const originHost = new URL(origin).host;
            const forwardedHost = String(request.headers['x-forwarded-host'] || '').split(',')[0].trim();
            const requestHost = forwardedHost || request.headers.host;
            if (!requestHost || originHost.toLowerCase() !== String(requestHost).toLowerCase()) {
              response.statusCode = 403;
              response.end('Cross-origin access is not allowed');
              return;
            }
          } catch {
            response.statusCode = 403;
            response.end('Invalid Origin header');
            return;
          }
        }

        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        try {
          let result;
          if (pathname === `${prefix}/status`) result = await getComfyUiStatus();
          else if (pathname === `${prefix}/workflows`) result = await listComfyUiWorkflows();
          else {
            const workflowMatch = pathname.match(new RegExp(`^${prefix}/workflows/([a-z0-9-]+)$`));
            if (!workflowMatch) {
              response.statusCode = 404;
              response.end(JSON.stringify({ error: 'Unknown Lia Forge ComfyUI API route.' }));
              return;
            }
            result = await readComfyUiWorkflow(workflowMatch[1]);
          }
          response.statusCode = 200;
          response.end(JSON.stringify(result));
        } catch (error) {
          response.statusCode = 500;
          response.end(JSON.stringify({ error: error.message || 'ComfyUI request failed.' }));
        }
      });
    },
  };
}

const LIA_FORGE_STUDIO_PREFIX = '/api/lia-forge/studio';
const MAX_ARTIFACT_BYTES = 6 * 1024 * 1024;
const MAX_BODY_BYTES = 1024 * 1024;
// Upload de referência do usuário: o limite é maior, mas continua finito e só
// vale para a rota de entradas (o resto da API mantém 1 MB).
const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;
const ARTIFACT_CONTENT_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

/** Mesma proteção de origem usada pelos outros plugins (o preview usa proxy). */
function isSameOriginRequest(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const forwardedHost = String(request.headers['x-forwarded-host'] || '').split(',')[0].trim();
    const requestHost = forwardedHost || request.headers.host;
    return Boolean(requestHost) && originHost.toLowerCase() === String(requestHost).toLowerCase();
  } catch {
    return false;
  }
}

function readJsonBody(request, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        request.destroy();
        reject(new Error(`Corpo da requisição excede ${Math.round(maxBytes / (1024 * 1024))} MB.`));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('JSON inválido no corpo da requisição.'));
      }
    });
    request.on('error', reject);
  });
}

/**
 * API HTTP do Studio (F8 — §11): expõe o mesmo `createStudioService` que o
 * Electron usa, só que por rotas same-origin para o navegador/preview.
 *
 * Não é um segundo sistema: é a fachada única acessada por outro transporte.
 * Nada aqui instala, baixa, compra ou envia dados; artefatos só são servidos de
 * dentro de `<projeto>/.lia-forge/runs/`, sem seguir symlink.
 */
function liaForgeStudioApi() {
  const projectRoot = path.resolve(process.env.SPRITEFORGE_PROJECT_ROOT || process.cwd());
  const runsRoot = path.join(projectRoot, '.lia-forge', 'runs');
  const inputsRoot = path.join(projectRoot, 'input');
  let servicePromise = null;

  function studio() {
    if (!servicePromise) {
      servicePromise = import('./shared/services/studio-service.mjs')
        .then((module) => module.createStudioService({ projectRoot }));
    }
    return servicePromise;
  }

  return {
    name: 'lia-forge-studio-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        let url;
        try {
          url = new URL(request.url || '/', 'http://vite.local');
        } catch {
          return next();
        }
        const pathname = url.pathname;
        if (!pathname.startsWith(LIA_FORGE_STUDIO_PREFIX)) return next();

        const method = request.method || 'GET';
        if (!isSameOriginRequest(request)) {
          response.statusCode = 403;
          response.end('Cross-origin access is not allowed');
          return;
        }
        response.setHeader('Cache-Control', 'no-store');

        const json = (status, payload) => {
          response.statusCode = status;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(JSON.stringify(payload));
        };

        const route = pathname.slice(LIA_FORGE_STUDIO_PREFIX.length) || '/';
        try {
          const service = await studio();

          // ------------------------------------------------ artefato (imagem)
          if (route === '/artifact') {
            if (method !== 'GET') return json(405, { error: 'Method not allowed' });
            const relative = url.searchParams.get('path') || '';
            const absolute = path.resolve(projectRoot, relative);
            if (!isInside(runsRoot, absolute)) return json(403, { error: 'Só artefatos dentro de .lia-forge/runs/ podem ser servidos.' });
            const stats = await fs.lstat(absolute).catch(() => null);
            if (!stats || !stats.isFile() || stats.isSymbolicLink()) return json(404, { error: 'Artefato não encontrado.' });
            if (stats.size > MAX_ARTIFACT_BYTES) return json(413, { error: 'Artefato maior que 6 MB; abra no explorador de arquivos.' });
            const bytes = await fs.readFile(absolute);
            response.statusCode = 200;
            response.setHeader('Content-Type', ARTIFACT_CONTENT_TYPES[path.extname(absolute).toLowerCase()] ?? 'application/octet-stream');
            response.setHeader('Content-Length', String(bytes.length));
            response.end(bytes);
            return undefined;
          }

          if (route === '/overview') {
            if (method !== 'GET') return json(405, { error: 'Method not allowed' });
            return json(200, await service.overview());
          }

          if (route === '/workflows') {
            if (method !== 'GET') return json(405, { error: 'Method not allowed' });
            return json(200, { workflows: await service.workflows() });
          }

          if (route === '/preflight') {
            if (method !== 'GET') return json(405, { error: 'Method not allowed' });
            const raw = url.searchParams.get('capabilities');
            const capabilityIds = raw ? raw.split(',').map((item) => item.trim()).filter(Boolean) : null;
            return json(200, await service.preflight({ capabilityIds }));
          }

          // ------------------------------- entradas (referências do usuário)
          if (route === '/inputs') {
            if (method === 'GET') return json(200, await service.listInputs());
            if (method === 'POST') {
              const body = await readJsonBody(request, MAX_UPLOAD_BYTES);
              if (!body.filename) return json(400, { error: 'filename é obrigatório.' });
              if (typeof body.base64 !== 'string' || !body.base64.length) return json(400, { error: 'base64 é obrigatório.' });
              const bytes = Buffer.from(body.base64, 'base64');
              return json(200, await service.saveInput({ filename: String(body.filename), bytes, note: body.note ? String(body.note) : null }));
            }
            return json(405, { error: 'Method not allowed' });
          }

          if (route === '/input-file') {
            if (method !== 'GET') return json(405, { error: 'Method not allowed' });
            const relative = url.searchParams.get('path') || '';
            let bytes;
            try {
              // O serviço é o único lugar que resolve e confina entradas.
              bytes = await service.readInput(relative);
            } catch (error) {
              const message = String(error?.message ?? '');
              if (message.includes('fora de input/')) return json(403, { error: 'Só arquivos dentro de input/ podem ser servidos.' });
              if (message.includes('grande demais')) return json(413, { error: message });
              return json(404, { error: 'Entrada não encontrada.' });
            }
            const type = ARTIFACT_CONTENT_TYPES[path.extname(relative).toLowerCase()] ?? 'application/octet-stream';
            response.statusCode = 200;
            response.setHeader('Content-Type', type);
            response.setHeader('Content-Length', String(bytes.length));
            response.setHeader('Cache-Control', 'no-store');
            response.end(Buffer.from(bytes));
            return undefined;
          }

          if (route === '/compare') {
            if (method !== 'POST') return json(405, { error: 'Method not allowed' });
            const body = await readJsonBody(request);
            if (!Array.isArray(body.paths) || !body.paths.length) return json(400, { error: 'paths é obrigatório (lista de caminhos relativos ao projeto).' });
            return json(200, await service.compareArtifacts({ paths: body.paths.map((item) => String(item)) }));
          }

          // Providers (§9): escolha real entre execução local, remota autorizada
          // e desativado. Configuração gravada no projeto, sem segredos.
          if (route === '/providers') {
            if (method === 'GET') return json(200, await service.providers());
            if (method === 'POST') {
              const body = await readJsonBody(request);
              if (!body.id) return json(400, { error: 'id do provider é obrigatório (blender | comfyui).' });
              return json(200, await service.configureProvider(body));
            }
            return json(405, { error: 'Method not allowed' });
          }

          if (route === '/plan') {
            if (method !== 'POST') return json(405, { error: 'Method not allowed' });
            const body = await readJsonBody(request);
            if (!body.workflowId) return json(400, { error: 'workflowId é obrigatório.' });
            return json(200, await service.plan({
              workflowId: String(body.workflowId),
              destination: body.destination ? String(body.destination) : null,
              options: body.options ?? {},
              brief: body.brief ? String(body.brief) : null,
            }));
          }

          if (route === '/run') {
            if (method !== 'POST') return json(405, { error: 'Method not allowed' });
            const body = await readJsonBody(request);
            if (!body.workflowId) return json(400, { error: 'workflowId é obrigatório.' });
            const result = await service.run({
              workflowId: String(body.workflowId),
              destination: body.destination ? String(body.destination) : null,
              options: body.options ?? {},
              brief: body.brief ? String(body.brief) : null,
              params: body.params ?? {},
            });
            return json(200, result);
          }

          if (route === '/vfx-preview') {
            if (method !== 'GET') return json(405, { error: 'Method not allowed' });
            return json(200, await service.vfxPreview({
              preset: url.searchParams.get('preset') || 'explosion',
              size: Number(url.searchParams.get('size') || 96),
              frameCount: Number(url.searchParams.get('frameCount') || 8),
              seed: url.searchParams.get('seed') || 'lia-forge',
            }));
          }

          if (route === '/runs') {
            if (method !== 'GET') return json(405, { error: 'Method not allowed' });
            return json(200, { runs: await service.listRuns() });
          }

          // Execuções em andamento neste processo: é o que a interface usa para
          // mostrar progresso e oferecer cancelamento de verdade.
          if (route === '/runs/active') {
            if (method !== 'GET') return json(405, { error: 'Method not allowed' });
            return json(200, { active: service.activeRuns() });
          }

          const runMatch = route.match(/^\/runs\/([A-Za-z0-9._-]+)(?:\/(review|export|cancel|resume))?$/);
          if (runMatch) {
            const [, runId, action] = runMatch;
            if (!action) {
              if (method !== 'GET') return json(405, { error: 'Method not allowed' });
              const snapshot = await service.readRun(runId);
              if (!snapshot) return json(404, { error: `Run "${runId}" não encontrado.` });
              return json(200, snapshot);
            }
            if (method !== 'POST') return json(405, { error: 'Method not allowed' });
            const body = await readJsonBody(request);
            if (action === 'cancel' || action === 'resume') {
              try {
                if (action === 'cancel') {
                  return json(200, await service.cancelRun({
                    runId,
                    reason: body.reason ? String(body.reason) : 'cancelado pelo usuário',
                    cancelledBy: body.cancelledBy ? String(body.cancelledBy) : 'usuário do Studio',
                  }));
                }
                return json(200, await service.resumeRun({ runId, reason: body.reason ? String(body.reason) : null }));
              } catch (error) {
                const message = String(error?.message ?? error);
                return json(message.includes('não encontrado') ? 404 : 400, { error: message });
              }
            }
            if (action === 'review') {
              if (!body.stepId) return json(400, { error: 'stepId é obrigatório.' });
              return json(200, await service.reviewStep({
                runId,
                stepId: String(body.stepId),
                approved: body.approved === true,
                reviewer: body.reviewer ? String(body.reviewer) : 'usuário do Studio',
                note: body.note ? String(body.note) : null,
              }));
            }
            if (!body.destination) return json(400, { error: 'destination é obrigatório.' });
            return json(200, await service.exportRun({
              runId,
              destination: String(body.destination),
              asset: body.asset ?? null,
            }));
          }

          if (route === '/assets') {
            if (method === 'GET') return json(200, { assets: await service.listAssets(), rights: await service.rightsReport() });
            if (method === 'POST') {
              const body = await readJsonBody(request);
              if (!body.id) return json(400, { error: 'id é obrigatório.' });
              return json(200, await service.upsertAsset(body));
            }
            return json(405, { error: 'Method not allowed' });
          }

          if (route === '/rights') {
            if (method !== 'GET') return json(405, { error: 'Method not allowed' });
            return json(200, await service.rightsReport());
          }

          const assetMatch = route.match(/^\/assets\/([A-Za-z0-9._-]+)\/(rights|attach-run|versions)$/);
          if (assetMatch) {
            if (method !== 'POST') return json(405, { error: 'Method not allowed' });
            const [, assetId, action] = assetMatch;
            const body = await readJsonBody(request);
            if (action === 'rights') return json(200, await service.declareAssetRights(assetId, body));
            if (action === 'versions') {
              if (!Array.isArray(body.artifacts) || !body.artifacts.length) return json(400, { error: 'artifacts é obrigatório (lista de artefatos da versão).' });
              return json(200, await service.addAssetVersion(assetId, {
                runId: body.runId ? String(body.runId) : null,
                note: body.note ? String(body.note) : null,
                artifacts: body.artifacts,
              }));
            }
            if (!body.runId) return json(400, { error: 'runId é obrigatório.' });
            return json(200, await service.attachRunToAsset({ assetId, runId: String(body.runId) }));
          }

          return json(404, { error: 'Rota desconhecida da API do Studio Lia Forge.' });
        } catch (error) {
          // Configuração inválida vinda do usuário é 400, não falha do servidor.
          if (error?.code === 'PROVIDER_CONFIG_INVALID') return json(400, { error: error.message });
          // Entrada inválida do usuário (nome, formato, tamanho, conteúdo) é 400.
          if (/^saveInput:|^compareArtifacts:|^readInput:/.test(String(error?.message ?? ''))) return json(400, { error: error.message });
          return json(error?.statusCode === 404 ? 404 : 500, { error: error?.message || 'Falha na API do Studio.' });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), projectAssetStore(), comfyUiApi(), liaForgeStudioApi()],
  server: {
    host: '0.0.0.0',
    // The Arena preview uses a per-session proxy hostname rather than localhost.
    allowedHosts: true,
  },
});
