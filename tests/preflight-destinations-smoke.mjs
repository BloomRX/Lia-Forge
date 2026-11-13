/**
 * Smoke de preflight compartilhado (F3), perfis de destino (F7) e backend
 * remoto (§9): o que a máquina tem, o que cada capacidade precisa, o que está
 * bloqueado e o que só o usuário pode decidir.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCapabilityRegistry } from '../shared/capabilities/registry.mjs';
import { buildPreflightReport, runPreflight } from '../shared/qa/preflight.mjs';
import {
  adaptSpritesheetManifestForDestination,
  buildExportBundle,
  checkDestinationCompatibility,
  listDestinations,
  resolveDestination,
} from '../shared/destinations/profiles.mjs';
import { createAdapterRegistry } from '../electron/adapters/index.mjs';
import { runValidator } from '../shared/qa/validators.mjs';
import { createImage } from '../shared/imaging/core.mjs';
import { encodePngRgba } from '../shared/qa/png-codec.mjs';

const registry = createCapabilityRegistry();

function dependencies(findBlender = null) {
  return {
    findExternalTool: (name) => (name === 'blender' ? findBlender : null),
    taskRegistry: { start: () => ({ child: {} }) },
    assertPathInsideProject: async (value) => value,
    buildBlenderSpritesheetArgs: () => [],
    runProcess: async () => {},
    validateSpritesheetFiles: () => ({ frameCount: 24, sheetWidth: 384, sheetHeight: 144 }),
    validateStageOutputs: () => {},
    getWorkflowClient: async () => ({
      getComfyUiEndpoint: () => 'http://127.0.0.1:8188',
      getComfyUiStatus: async () => ({ available: false }),
    }),
    hash: (bytes) => createHash('sha256').update(bytes).digest('hex'),
  };
}

// --- preflight sem ferramentas externas ------------------------------------
const adapters = createAdapterRegistry(dependencies()).all();
const report = await runPreflight({ registry, adapters, machine: { os: 'linux', ramMb: 3939, vramMb: null, gpu: null, diskMb: 20000 } });

assert.equal(report.schemaVersion, 1);
assert.equal(report.capabilities.length, registry.list().length);
assert.match(report.note, /Nenhuma ferramenta foi instalada/);

const concept = report.capabilities.find((item) => item.id === 'image2d.generate-concept');
assert.notEqual(concept.status, 'ready', 'ComfyUI indisponível não pode aparecer como pronto');
assert.ok(concept.blockers.length > 0);
assert.ok(concept.unknowns.some((item) => /GPU/.test(item)), 'ausência de probe de GPU precisa aparecer como desconhecido');

const transform = report.capabilities.find((item) => item.id === 'image2d.transform');
assert.equal(transform.status, 'ready', 'capacidade interna com código executado deve ficar pronta');
assert.deepEqual(transform.readyProviders, ['local-image-ops']);

const to2d = report.capabilities.find((item) => item.id === 'render3d.to2d');
assert.equal(to2d.status, 'missing', 'sem Blender detectado, 3D→2D é ausente, não disponível');
assert.ok(to2d.providers.includes('blender-spritesheet'));

const installAction = report.userActions.find((action) => action.kind === 'install' && action.capabilityId === 'render3d.to2d');
assert.ok(installAction, 'falta de ferramenta precisa virar ação de instalação para o usuário');
assert.match(installAction.detail, /não instala nem baixa/);
assert.equal(installAction.canBeAutomated, false);

const proposed = report.capabilities.find((item) => item.id === 'image2d.decompose-layers');
assert.equal(proposed.status, 'missing');
assert.ok(proposed.blockers.some((item) => /decisão humana/.test(item)));

// Com um executável presente, a capacidade muda de estado (e o resto não).
// O caminho apontado é um binário que existe de verdade neste ambiente (o
// próprio Node): a descoberta verifica executabilidade no disco, então um
// caminho fictício seria — corretamente — reportado como ausente.
const withBlender = await runPreflight({ registry, adapters: createAdapterRegistry(dependencies(process.execPath)).all(), machine: { os: 'linux', ramMb: 16384 } });
assert.equal(withBlender.capabilities.find((item) => item.id === 'render3d.to2d').status, 'ready');
assert.equal(withBlender.summary.toolsAvailable > report.summary.toolsAvailable, true);

// relatório puro (sem descobertas) nunca afirma disponibilidade
const bare = buildPreflightReport({ registry, adapters, machine: {}, capabilityIds: ['render.atlas'] });
assert.equal(bare.capabilities.length, 1);
assert.equal(bare.capabilities[0].status, 'unknown');
assert.equal(bare.canStart, false);

// --- destinos: perfis, compatibilidade e pacote ----------------------------
const destinations = listDestinations();
assert.ok(destinations.length >= 6);
for (const destination of destinations) {
  assert.ok(destination.id && destination.label && destination.importNotes);
  assert.ok(Array.isArray(destination.spriteFormats));
  assert.equal(typeof destination.verified, 'boolean');
  assert.ok(destination.evidence.length > 0, `${destination.id} sem evidência declarada`);
}
assert.equal(resolveDestination('lia-desktop').verified, true, 'único destino verificado por testes neste checkout');
assert.throws(() => resolveDestination('unreal-5'), TypeError);

const atlasPng = encodePngRgba(createImage(8, 8, [200, 60, 160, 255]).rgba, 8, 8);
const compatible = checkDestinationCompatibility({ destinationId: 'godot-4', artifacts: [{ id: 'atlas', format: 'png' }] });
assert.equal(compatible.compatible, true);

const needsConversion = checkDestinationCompatibility({ destinationId: 'unreal-2d', artifacts: [{ id: 'model', format: 'glb' }] });
assert.equal(needsConversion.compatible, false);
assert.equal(needsConversion.conversionsNeeded[0].to, 'fbx');

const blocked = checkDestinationCompatibility({ destinationId: 'video-timeline', artifacts: [{ id: 'model', format: 'glb' }] });
assert.equal(blocked.compatible, false);
assert.ok(blocked.blockers.length > 0);

const bundle = buildExportBundle({
  destinationId: 'godot-4',
  artifacts: [{ id: 'atlas', format: 'png', role: 'spritesheet', relativePath: 'atlas.png', bytes: atlasPng }],
  hash: (bytes) => createHash('sha256').update(bytes).digest('hex'),
  asset: { id: 'asset-1', name: 'Aiko', type: 'character' },
  workflowRunId: 'run-1',
});
assert.equal(bundle.files.length, 1);
assert.equal(bundle.files[0].sha256.length, 64);
assert.equal(bundle.files[0].bytes, atlasPng.length);
assert.equal(bundle.verifiedOnDestination, false, 'nada foi importado em engine de terceiros');
const profileCheck = runValidator('destination-profile', { bundle });
assert.equal(profileCheck.ok, true, 'pacote real construído pelo exportador é aprovado');
assert.equal(profileCheck.metrics.verifiedOnDestination, false, 'o validador não afirma importação real na engine');
assert.equal(profileCheck.metrics.fps, 60, 'o fps conferido é o publicado para o destino');

// Conformidade com o perfil publicado, não só estrutura do manifesto.
const formatoRecusado = runValidator('destination-profile', {
  bundle: { ...bundle, files: [{ ...bundle.files[0], path: 'sprite.psd', format: 'psd' }] },
});
assert.equal(formatoRecusado.ok, false, 'formato que o destino não importa é recusado');
assert.match(formatoRecusado.problems.join(' '), /não importa/);

const perfilAdulterado = runValidator('destination-profile', {
  bundle: { ...bundle, profile: { ...bundle.profile, fps: 240, axes: 'z-up' } },
});
assert.equal(perfilAdulterado.ok, false, 'pacote com perfil diferente do publicado é recusado');
assert.match(perfilAdulterado.problems.join(' '), /fps do pacote/);

const destinoInexistente = runValidator('destination-profile', { bundle: { ...bundle, destination: 'engine-que-nao-existe' } });
assert.equal(destinoInexistente.ok, false, 'destino fora do catálogo é recusado');
assert.match(destinoInexistente.problems.join(' '), /não existe no catálogo/);

const comBloqueio = runValidator('destination-profile', {
  bundle: { ...bundle, compatibility: { blockers: ['sprite.tga: formato não aceito'], conversions: [], accepted: [] } },
});
assert.equal(comBloqueio.ok, false, 'bloqueio de compatibilidade declarado impede a aprovação');

assert.throws(() => buildExportBundle({ destinationId: 'godot-4', artifacts: [], hash: () => 'x' }), /nenhum artefato/);

// adaptação para destino não altera pixels
const manifest = { frameWidth: 48, frameHeight: 48, columns: 8, rows: 3, fps: 12, frames: [{ x: 0, y: 0, durationMs: 80 }] };
const adapted = adaptSpritesheetManifestForDestination({ manifest, destinationId: 'godot-4' });
assert.equal(adapted.pixelDataUnchanged, true);
assert.equal(adapted.timingUnchanged, true, 'duração é tempo de relógio: não pode ser reescalada sem pedido');
assert.equal(adapted.frames[0].durationMs, 80);
assert.equal(adapted.fps, 60);
assert.equal(adapted.destinationFrameDelayMs, 16.67);
assert.equal(adapted.pivot, 'bottom-center');

console.log(`Preflight + destinations smoke test passed (${report.summary.capabilities} capacidades, ${destinations.length} destinos).`);
