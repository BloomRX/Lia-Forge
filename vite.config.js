import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { getComfyUiStatus, listComfyUiWorkflows, readComfyUiWorkflow } from './scripts/comfyui-client.mjs';
import {
  TOKEN_HEADER,
  TOKEN_MODULE_ROUTE,
  createHttpApiPolicy,
  resolveBindHost,
  viteAllowedHosts,
} from './shared/http/api-policy.mjs';

const MAX_STORE_BYTES = 24 * 1024 * 1024;

/**
 * Política de segurança da superfície HTTP (P0-1 da revisão integrada).
 *
 * Uma instância por processo do dev-server: o token vale enquanto este processo
 * existir e é o mesmo para os três plugins. O bind é loopback por padrão; a
 * lista de hosts é fechada (nunca `allowedHosts: true`).
 */
const HTTP_POLICY = createHttpApiPolicy();

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

        // PUT grava o store: é operação mutável e exige Origin da mesma origem e
        // o token da sessão. GET lê dados do projeto e exige Origin — antes a
        // ausência de Origin era aceita como "ferramenta local", e é justamente o
        // formato de uma requisição forjada (curl de outra máquina, form POST de
        // outro site, DNS rebinding).
        const storeDecision = HTTP_POLICY.classify({
          method,
          route: '/assets',
          origin: request.headers.origin ?? null,
          host: request.headers.host ?? null,
          forwardedHost: String(request.headers['x-forwarded-host'] || '').split(',')[0].trim() || null,
          token: request.headers[TOKEN_HEADER] ?? null,
        });
        if (!storeDecision.allow) {
          response.statusCode = storeDecision.status;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(JSON.stringify({ error: storeDecision.reason, code: storeDecision.code }));
          return;
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
        // Mesma política do Studio: host fechado + Origin da mesma origem. São
        // rotas de leitura (o ComfyUI local só é consultado, nunca acionado),
        // então não exigem token — mas deixaram de aceitar ausência de Origin.
        const comfyDecision = HTTP_POLICY.classify({
          method: request.method || 'GET',
          route: '/read',
          origin: request.headers.origin ?? null,
          host: request.headers.host ?? null,
          forwardedHost: String(request.headers['x-forwarded-host'] || '').split(',')[0].trim() || null,
        });
        if (!comfyDecision.allow) {
          response.statusCode = comfyDecision.status;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(JSON.stringify({ error: comfyDecision.reason, code: comfyDecision.code }));
          return;
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
 *
 * Segurança (P0-1 da revisão integrada): toda requisição passa por
 * `HTTP_POLICY.classify` antes de qualquer rota — host fechado (DNS rebinding),
 * `Origin` obrigatório em operação mutável (CSRF) e token de sessão. Três
 * operações são exclusivas do IPC e devolvem 403 aqui: configurar provider,
 * autorizar provider e registrar revisão humana. O produto não oferece por HTTP
 * aquilo que exige decisão verificável da pessoa no app.
 */
/**
 * Entrega o token da sessão à página servida por este servidor.
 *
 * É um módulo ESM **virtual** na mesma origem (`/@lia-forge/session-token.js`),
 * não um valor embutido no HTML: assim ele não aparece em snapshot de DOM nem em
 * log de proxy que registre HTML, e o Electron (que usa IPC, não HTTP) nunca o
 * pede. Virtual (resolveId + load) em vez de middleware por duas razões: funciona
 * também em SSR/`middlewareMode`, que é como a interface é testada, e não existe
 * arquivo no disco para alguém servir por engano em produção.
 *
 * Só é servido para `Host` permitido e com `Sec-Fetch-Site` que não indique
 * navegação vinda de outro site.
 */
const TOKEN_MODULE_ID = `\0virtual:${TOKEN_MODULE_ROUTE.slice(1)}`;

function liaForgeSessionToken() {
  return {
    name: 'lia-forge-session-token',
    enforce: 'pre',
    resolveId(id) {
      if (id === TOKEN_MODULE_ROUTE || id.endsWith(TOKEN_MODULE_ROUTE)) return TOKEN_MODULE_ID;
      return null;
    },
    load(id) {
      return id === TOKEN_MODULE_ID ? HTTP_POLICY.tokenModuleSource() : null;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = (() => {
          try {
            return new URL(request.url || '/', 'http://vite.local').pathname;
          } catch {
            return '/';
          }
        })();
        if (pathname !== TOKEN_MODULE_ROUTE) return next();
        if (!HTTP_POLICY.isHostAllowed(String(request.headers['x-forwarded-host'] || '').split(',')[0].trim() || request.headers.host)) {
          response.statusCode = 421;
          response.setHeader('Content-Type', 'text/plain; charset=utf-8');
          response.end('Host not allowed');
          return undefined;
        }
        const site = String(request.headers['sec-fetch-site'] || '').toLowerCase();
        if (site && site !== 'same-origin' && site !== 'none') {
          response.statusCode = 403;
          response.setHeader('Content-Type', 'text/plain; charset=utf-8');
          response.end('Cross-site request');
          return undefined;
        }
        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(HTTP_POLICY.tokenModuleSource());
        return undefined;
      });
    },
  };
}

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
        const route = pathname.slice(LIA_FORGE_STUDIO_PREFIX.length) || '/';

        const method = request.method || 'GET';
        const forwardedHost = String(request.headers['x-forwarded-host'] || '').split(',')[0].trim() || null;
        const decision = HTTP_POLICY.classify({
          method,
          route,
          origin: request.headers.origin ?? null,
          host: request.headers.host ?? null,
          forwardedHost,
          token: request.headers[TOKEN_HEADER] ?? null,
        });
        if (!decision.allow) {
          response.statusCode = decision.status;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          response.end(JSON.stringify({ error: decision.reason, code: decision.code }));
          return;
        }
        response.setHeader('Cache-Control', 'no-store');

        const json = (status, payload) => {
          response.statusCode = status;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(JSON.stringify(payload));
        };

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

          // Projeto (§3, passo 1): onde está a pasta e o que há nela. No
          // navegador a raiz vem de SPRITEFORGE_PROJECT_ROOT; criar ou trocar de
          // projeto é ação do aplicativo desktop (dialog + pastas locais).
          if (route === '/project') {
            if (method !== 'GET') return json(405, { error: 'Method not allowed' });
            const info = await service.projectInfo();
            return json(200, {
              ...info,
              managedHere: false,
              managementNote: 'Nesta página a pasta do projeto vem da variável SPRITEFORGE_PROJECT_ROOT do servidor. Criar ou trocar de projeto é feito no aplicativo desktop, que cria apenas input/ e .lia-forge/runs/ e preserva todo o resto.',
            });
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

// `mode` vem do Vite: é o que permite `npm run dev:expose` (portável, inclusive
// no Windows) como opt-in de exposição de rede, ao lado de LIA_FORGE_HTTP_EXPOSE.
export default defineConfig(({ mode }) => {
  const bind = resolveBindHost(process.env, { mode });
  // O motivo do bind fica registrado assim que o servidor sobe: exposição de rede
  // é decisão explícita, nunca padrão silencioso.
  if (bind.exposed) {
    process.stderr.write(`[lia-forge] ${bind.reason}\n`);
  }
  return {
    plugins: [react(), liaForgeSessionToken(), projectAssetStore(), comfyUiApi(), liaForgeStudioApi()],
    server: {
      // Loopback por padrão; expor na rede exige opt-in nomeado. O preview desta
      // estação funciona porque o proxy fala com o servidor em loopback e o host
      // dele está na lista fechada da política.
      host: bind.host,
      // Lista fechada (nunca `true`): qualquer outro Host é recusado com 421,
      // o que impede que um nome de domínio apontado para esta máquina seja
      // atendido (DNS rebinding).
      allowedHosts: viteAllowedHosts(HTTP_POLICY),
    },
    preview: {
      host: bind.host,
      allowedHosts: viteAllowedHosts(HTTP_POLICY),
    },
  };
});
