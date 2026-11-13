/**
 * Smoke do Asset Manager (F4 — requisito §4, responsabilidade 6).
 *
 * Verifica de verdade:
 *   - o registro normalizado preserva o schema publicado em
 *     `.spriteforge/assets.json` (schemaVersion 1, type character|item);
 *   - direitos nunca são inferidos: só o que uma pessoa declarou conta, e
 *     `unknown` não significa "livre para usar";
 *   - derivado de entrada restritiva herda a restrição (licenças);
 *   - versões carregam hash + validação (proveniência auditável);
 *   - o store é gravado no formato que `electron/main.cjs` e o plugin Vite já
 *     consomem (nenhum sistema paralelo).
 */

import assert from 'node:assert/strict';

import {
  ASSET_MANAGER_SCHEMA_VERSION,
  RIGHTS_STATES,
  classifyRights,
  createAssetManager,
  normalizeAssetRecord,
} from '../shared/assets/manager.mjs';

function check(condition, message) {
  assert.ok(condition, message);
}

// ------------------------------------------------------------- normalização

const normalized = normalizeAssetRecord({
  id: 'aiko-guarda-florestal',
  type: 'character',
  name: 'Aiko, Guarda Florestal',
  notes: 'Personagem de referência da Biblioteca visual.',
});
check(normalized.id === 'aiko-guarda-florestal', 'id preservado');
check(normalized.type === 'character', 'type character preservado');
check(normalized.schemaVersion === undefined,
  'registro não carrega schemaVersion (o campo vive no store, como no formato publicado)');
check(ASSET_MANAGER_SCHEMA_VERSION === 1, 'schemaVersion do manager é 1');
check(Array.isArray(normalized.versions) && normalized.versions.length === 0, 'versions inicia vazio');
check(Array.isArray(normalized.provenance) && normalized.provenance.length === 0, 'provenance inicia vazio');
check(normalized.rights.state === 'unknown', 'direitos iniciam unknown (nada declarado)');
check(normalized.rights.redistributable === false, 'unknown não é redistribuível');
check(normalized.createdAt === null, 'normalização é pura: não carimba data (quem carimba é o manager)');

let threw = false;
try {
  normalizeAssetRecord({ id: 'sprite', type: 'vehicle' });
} catch (error) {
  threw = true;
  check(/character\|item/.test(error.message), `type inválido é recusado com o motivo do store publicado: ${error.message}`);
}
check(threw, 'type fora de character|item lança erro (sem extensão silenciosa)');

threw = false;
try {
  normalizeAssetRecord({ id: '' });
} catch {
  threw = true;
}
check(threw, 'id vazio é recusado');

// ------------------------------------------------------------------ direitos

const owned = classifyRights({ declarations: [], generatedBy: 'user', thirdPartyInputs: [] });
check(owned.state === 'owned', 'criado pelo usuário sem entrada de terceiro = owned');
check(owned.redistributable === true, 'owned é redistribuível');

const permissive = classifyRights({ declarations: [{ license: 'MIT' }], generatedBy: 'tool' });
check(permissive.state === 'licensed', 'MIT declarado = licensed');
check(permissive.permissive.length === 1, 'MIT reconhecido como permissivo');
check(permissive.redistributable === true, 'licença permissiva permite redistribuição');

const noAssertion = classifyRights({ declarations: [{ license: 'NOASSERTION' }] });
check(noAssertion.state === 'license-pending', 'NOASSERTION = license-pending (não é "sem licença")');
check(noAssertion.redistributable === false, 'NOASSERTION não libera redistribuição');
check(!noAssertion.restricted.length, 'NOASSERTION não vira restrição inventada');
check(noAssertion.blockers.some((item) => item.includes('decisão humana')), 'NOASSERTION exige decisão humana e diz isso');

// hint curto casa como token, não como substring: sem falso positivo
const ncsa = classifyRights({ declarations: [{ license: 'University of Illinois/NCSA' }] });
check(!ncsa.restricted.length, `NCSA não é confundido com "nc" (obtido: ${ncsa.restricted.join(',')})`);
check(ncsa.state === 'license-pending', 'licença não reconhecida como permissiva fica pendente');
const ccByNc = classifyRights({ declarations: [{ license: 'CC-BY-NC-4.0' }] });
check(ccByNc.restricted.length === 1, 'CC-BY-NC-4.0 continua reconhecido como restritivo');

const restrictive = classifyRights({ declarations: [{ license: 'CC-BY-NC-4.0' }], generatedBy: 'tool' });
check(restrictive.state === 'restricted', 'licença não comercial = restricted');
check(restrictive.inheritRestriction === true, 'derivado herda a restrição');
check(restrictive.redistributable === false, 'restritivo não é redistribuível');
check(restrictive.blockers.some((item) => item.includes('CC-BY-NC-4.0')), 'bloqueio nomeia a licença');

const explicitBlock = classifyRights({ declarations: [{ license: 'BLOCKED' }] });
check(explicitBlock.state === 'blocked', 'bloqueio explícito vence qualquer outra leitura');

const unknown = classifyRights({ declarations: [], generatedBy: 'tool', thirdPartyInputs: [] });
check(unknown.state === 'unknown', 'gerado por ferramenta sem declaração = unknown');
check(unknown.blockers.some((item) => item.includes('nenhuma licença declarada')), 'unknown explica que nada foi declarado');

const blockedInput = classifyRights({
  declarations: [{ license: 'MIT' }],
  generatedBy: 'tool',
  thirdPartyInputs: [{ id: 'pesos', rights: 'blocked' }],
});
check(blockedInput.blockers.some((item) => item.includes('bloqueada')), 'entrada de terceiro bloqueada aparece como bloqueio');

check(RIGHTS_STATES.length === 6, `6 estados de direitos (${RIGHTS_STATES.length})`);

// ------------------------------------------------------------------- manager

const saves = [];
const manager = createAssetManager({
  store: null,
  save: async (payload) => { saves.push(payload); },
  now: () => new Date('2026-11-13T00:00:00.000Z'),
});

const created = await manager.upsert({ id: 'aiko', type: 'character', name: 'Aiko' });
check(created.id === 'aiko', 'upsert cria o asset');
check(typeof created.createdAt === 'string' && created.createdAt.length > 0, 'upsert carimba createdAt');
check(typeof created.updatedAt === 'string', 'upsert carimba updatedAt');
check(manager.count() === 1, 'count reflete a criação');
check(saves.length === 1, 'cada mutação grava o store uma vez');
check(saves[0].schemaVersion === 1 && Array.isArray(saves[0].assets) && typeof saves[0].updatedAt === 'string',
  'payload no formato publicado {schemaVersion, assets, updatedAt}');

await manager.upsert({ id: 'aiko', type: 'character', name: 'Aiko (revisada)' });
check(manager.count() === 1, 'upsert do mesmo id atualiza em vez de duplicar');
check(manager.get('aiko').name === 'Aiko (revisada)', 'nome atualizado');
check(manager.get('aiko').createdAt === created.createdAt, 'createdAt original preservado na atualização');

const version = await manager.addVersion('aiko', {
  runId: 'run-teste-1',
  artifacts: [{
    path: '.lia-forge/runs/run-teste-1/spritesheet.png',
    role: 'spritesheet',
    format: 'png',
    bytes: 12345,
    sha256: 'a'.repeat(64),
    validator: 'png-content',
    validated: true,
    contentMetrics: { coverage: 0.31, frames: 24 },
  }],
  note: 'Atlas 8x3, 24 frames de 48x48 (contrato preservado).',
});
check(version.version === 'v1', 'primeira versão numerada v1');
check(version.artifacts[0].sha256 === 'a'.repeat(64), 'hash do artefato registrado');
check(version.artifacts[0].validated === true, 'artefato marcado como validado');
check(version.artifacts[0].contentMetrics.frames === 24, 'métricas de conteúdo preservadas');
check(manager.get('aiko').versions.length === 1, 'versão anexada ao asset');

const provenance = await manager.addProvenance('aiko', {
  source: 'run',
  tool: 'Lia Forge (interno)',
  adapter: 'rig2d-software',
  adapterVersion: '1.0.0',
  license: 'GPL-3.0-or-later',
  outputRights: 'Direitos dos artefatos permanecem com o usuário',
  runId: 'run-teste-1',
});
check(provenance.provenance.adapter === 'rig2d-software', 'proveniência registra o adapter');
check(provenance.rights.state === 'license-pending',
  `ferramenta com licença declarada mas não permissiva = license-pending (obtido: ${provenance.rights.state})`);
check(provenance.rights.redistributable === false, 'proveniência não permissiva não libera redistribuição');
check(manager.get('aiko').provenance.length === 1, 'proveniência anexada ao asset');

const declared = await manager.declareRights('aiko', {
  license: 'CC0-1.0',
  declaredBy: 'usuario-teste',
  note: 'Arte própria, liberada pelo autor.',
});
check(declared.state === 'licensed', 'declaração humana de CC0 muda o estado');
check(declared.declaredBy === 'usuario-teste', 'quem declarou fica registrado');
check(declared.redistributable === true, 'CC0 é redistribuível');

const report = manager.rightsReport();
check(report.total === 1, 'relatório conta os assets');
check(report.byState.licensed === 1, 'relatório agrupa por estado');
check(report.redistributable.includes('aiko'), 'asset redistribuível listado');
check(typeof report.note === 'string' && report.note.length > 0, 'relatório explica o significado de unknown');

const store = manager.toStore();
check(store.schemaVersion === 1 && store.assets.length === 1 && typeof store.updatedAt === 'string',
  'toStore devolve o formato consumido por main.cjs e pelo plugin Vite');

// round-trip: um manager criado a partir do store gravado preserva tudo
const reloaded = createAssetManager({ store: store });
check(reloaded.count() === 1, 'store recarregado mantém o asset');
check(reloaded.get('aiko').versions.length === 1, 'versões sobrevivem ao round-trip');
check(reloaded.get('aiko').provenance.length === 1, 'proveniência sobrevive ao round-trip');
check(reloaded.get('aiko').rights.state === 'licensed', 'direitos declarados sobrevivem ao round-trip');

check(await manager.remove('aiko') === true, 'remove devolve true quando removeu');
check(await manager.remove('aiko') === false, 'remove devolve false quando não existe');
check(manager.count() === 0, 'asset removido');

threw = false;
try {
  await manager.addVersion('inexistente', { artifacts: [{ path: 'a.png' }] });
} catch {
  threw = true;
}
check(threw, 'addVersion em asset inexistente lança erro');

console.log('Asset manager smoke test passed (6 estados de direitos, store schema 1 preservado, round-trip ok).');
