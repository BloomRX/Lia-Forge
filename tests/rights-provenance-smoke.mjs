/**
 * Smoke de direitos, proveniência e integridade de artefato (P0-3/P0-4 da
 * revisão integrada).
 *
 * O que este arquivo prova, e o que não prova
 * -------------------------------------------
 * Prova: que direitos deixam de ser informativos e passam a ser gate na
 * exportação; que a decisão humana não é sobrescrita nem afrouxada pela
 * proveniência da ferramenta; que `validated` é derivado de validação realmente
 * executada sobre estes bytes (nunca literal); e que anexar run a asset exige run
 * concluído, sem passo reprovado e sem revisão pendente.
 *
 * Não prova: nenhuma conclusão jurídica. Estado de direitos aqui é o que uma
 * pessoa declarou, classificado por regras explícitas (`classifyRights`) — nada é
 * inferido, e "licensed" não é parecer sobre licença. Também não executa Blender,
 * provider remoto nem engine de jogo: os runs usados são os que rodam de verdade
 * neste ambiente.
 *
 * Reprodução dos problemas que motivaram a correção (medida antes, com o código
 * de `de5efb9`):
 *   1. asset com `license: 'NOASSERTION'` (estado `license-pending`) anexado a um
 *      run concluído → `exportRun` gravou o manifesto normalmente. Direitos não
 *      eram consultados em caminho nenhum de execução/anexação/exportação.
 *   2. `attachRunToAsset` marcava **todo** artefato com `validated: true` literal,
 *      sem ler `step.validations`, o estado do run ou a revisão.
 *   3. asset declarado `BLOCKED` por uma pessoa → `attachRunToAsset` recalculava
 *      os direitos com a licença do **código** do adapter ("mesma licença do
 *      repositório") e o estado virava `license-pending` com `blockers: []`:
 *      a decisão humana era apagada e o gate não tinha o que explicar. Com
 *      licença permissiva na proveniência o estado viraria `licensed` +
 *      `redistributable: true`, ou seja, exportável sem ninguém decidir.
 *   4. `classifyRights` podia devolver `redistributable: false` com
 *      `blockers: []` — bloqueio sem motivo nomeado.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { classifyRights, createAssetManager, normalizeAssetRecord } from '../shared/assets/manager.mjs';
import { encodePngRgba } from '../shared/qa/png-codec.mjs';
import { createStudioService, deriveArtifactValidation } from '../shared/services/studio-service.mjs';

const results = [];
let failures = 0;

function check(label, assertion) {
  const ok = assertion === true;
  if (!ok) failures += 1;
  results.push(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — obtido: ${JSON.stringify(assertion)}`}`);
}

/** PNG 48×48 com um boneco simples — entrada real, não fixture vazia. */
function spriteBytes() {
  const width = 48;
  const height = 48;
  const rgba = Buffer.alloc(width * height * 4, 0);
  const paint = (x, y, [r, g, b]) => {
    const at = (y * width + x) * 4;
    rgba[at] = r; rgba[at + 1] = g; rgba[at + 2] = b; rgba[at + 3] = 255;
  };
  for (let y = 8; y < 40; y += 1) for (let x = 14; x < 34; x += 1) paint(x, y, [226, 118, 78]);
  for (let y = 2; y < 10; y += 1) for (let x = 18; x < 30; x += 1) paint(x, y, [246, 214, 176]);
  return encodePngRgba(rgba, width, height);
}

// ------------------------------------------------------- classificação de direitos
{
  const unrecognized = classifyRights({ declarations: [{ license: 'mesma licença do repositório' }] });
  check('licença não reconhecida como permissiva fica pendente', unrecognized.state === 'license-pending');
  check('e não é redistribuível', unrecognized.redistributable === false);
  check('e o bloqueio tem motivo nomeado (antes: blockers vazio)', unrecognized.blockers.length > 0);
  check('e o motivo cita a licença declarada', unrecognized.blockers[0].includes('mesma licença do repositório'));

  const nothing = classifyRights({ declarations: [], generatedBy: null });
  check('sem declaração nenhuma o estado é unknown', nothing.state === 'unknown');
  check('unknown não é redistribuível', nothing.redistributable === false);
  check('unknown explica o que falta', nothing.blockers.some((item) => item.includes('nenhuma licença declarada')));

  const restricted = classifyRights({ declarations: [{ license: 'CC-BY-NC-4.0' }] });
  check('cláusula não comercial é restrição, não pendência', restricted.state === 'restricted');
  check('e herda a restrição', restricted.inheritRestriction === true);

  const blocked = classifyRights({ declarations: [{ license: 'BLOCKED', blocked: true }] });
  check('bloqueio explícito vence qualquer outra leitura', blocked.state === 'blocked');
  check('e não é redistribuível', blocked.redistributable === false);

  const permissive = classifyRights({ declarations: [{ license: 'CC0-1.0' }], generatedBy: 'user' });
  check('declaração permissiva de pessoa libera redistribuição', permissive.redistributable === true);

  // Registros anteriores ao campo `validation` continuam legíveis.
  const legacy = normalizeAssetRecord({
    id: 'antigo', type: 'character',
    versions: [{ version: 'v1', artifacts: [{ path: 'a.png', validated: true }] }],
  });
  check('registro antigo sem evidência normaliza com validation: null', legacy.versions[0].artifacts[0].validation === null);
  check('e mantém o campo validated que já existia', legacy.versions[0].artifacts[0].validated === true);
}

// ----------------------------------------------------- validated derivado de evidência
{
  const hash = 'c'.repeat(64);
  const succeeded = {
    id: 'render', state: 'succeeded', sha256: hash, finishedAt: '2026-11-14T00:00:00.000Z',
    validations: [{ validator: 'png-content', status: 'passed', checked: 1, metrics: { uniqueColors: 12 } }],
  };

  const ok = deriveArtifactValidation({ step: succeeded, sha256: hash, emittedCount: 1 });
  check('validador aprovado sobre o mesmo hash ⇒ validated true', ok.validated === true);
  check('e o validador que passou fica nomeado', ok.validator === 'png-content');
  check('e as métricas medidas são preservadas', ok.contentMetrics?.uniqueColors === 12);
  check('e a evidência diz o que foi executado', ok.validation.status === 'validated' && ok.validation.reason.includes('png-content'));
  check('e a evidência ancora o hash', ok.validation.sha256 === hash);

  const diverged = deriveArtifactValidation({ step: succeeded, sha256: 'd'.repeat(64), emittedCount: 1 });
  check('hash diferente do gravado ⇒ validated false', diverged.validated === false);
  check('e o motivo é divergência de hash', diverged.validation.status === 'hash-diverged');

  const secondOutput = deriveArtifactValidation({ step: succeeded, sha256: 'e'.repeat(64), emittedCount: 3 });
  check('passo com várias saídas: a que não tem hash gravado não é marcada como validada', secondOutput.validated === false);
  check('e o motivo explica que a validação cobriu o artefato principal', secondOutput.validation.reason.includes('várias saídas'));

  const noValidator = deriveArtifactValidation({ step: { ...succeeded, validations: [] }, sha256: hash, emittedCount: 1 });
  check('passo sem validador ⇒ validated false', noValidator.validated === false);
  check('e o motivo diz que nada foi conferido', noValidator.validation.status === 'not-validated');

  const skipped = deriveArtifactValidation({
    step: { ...succeeded, validations: [{ validator: 'glb-structural', status: 'skipped', reason: 'o passo não devolveu um modelo' }] },
    sha256: hash, emittedCount: 1,
  });
  check('validador pulado não conta como validação', skipped.validated === false);
  check('e o motivo nomeia o validador pulado', skipped.validation.reason.includes('glb-structural'));

  const failedValidation = deriveArtifactValidation({
    step: { ...succeeded, validations: [{ validator: 'png-content', status: 'failed', problems: ['atlas totalmente transparente'] }] },
    sha256: hash, emittedCount: 1,
  });
  check('validação reprovada ⇒ validated false', failedValidation.validated === false);
  check('e o motivo traz o problema medido', failedValidation.validation.reason.includes('atlas totalmente transparente'));

  const notSucceeded = deriveArtifactValidation({ step: { ...succeeded, state: 'failed' }, sha256: hash, emittedCount: 1 });
  check('passo não concluído ⇒ validated false', notSucceeded.validated === false);
  check('e o motivo nomeia o estado do passo', notSucceeded.validation.status === 'step-not-succeeded');

  const missing = deriveArtifactValidation({ step: null, sha256: hash, emittedCount: 1 });
  check('passo ausente no snapshot ⇒ validated false', missing.validated === false);
}

// ------------------------------------------------------------- fluxo real do serviço
const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-rights-'));
const service = createStudioService({ projectRoot });

/** Um run concluído de verdade (VFX + composição + entrega, sem gate humano). */
async function succeededRun() {
  const run = await service.run({ workflowId: 'ui-vfx-sheet', destination: 'godot-4', params: {} });
  assert.equal(run.snapshot.status, 'succeeded', `o run de VFX conclui neste ambiente (${run.snapshot.status})`);
  return run;
}

/** `listAssets` devolve array ou `{ assets }` conforme o chamador; o teste aceita os dois. */
async function listedAssets() {
  const listed = await service.listAssets();
  return listed?.assets ?? listed ?? [];
}

async function declare(assetId, declaration) {
  await service.upsertAsset({ id: assetId, type: 'character', name: assetId });
  return service.declareAssetRights(assetId, declaration);
}

try {
  // --- exportar sem nenhum asset vinculado: permitido, mas sem fingir liberação
  const alone = await succeededRun();
  const aloneExport = await service.exportRun({ runId: alone.runId, destination: 'godot-4' });
  check('run sem asset vinculado exporta (nenhuma declaração para conferir)', aloneExport.bundle.files.length > 0);
  check('e a resposta diz que nada foi declarado', aloneExport.rightsState === 'not-declared');
  check('e o manifesto não afirma direitos que ninguém declarou', aloneExport.bundle.rights === null);
  check('e a nota explica o que isso significa', String(aloneExport.rightsNote).includes('nada aqui afirma'));

  // --- direitos pendentes bloqueiam (reprodução 1)
  const pendingRun = await succeededRun();
  await declare('pendente', { license: 'NOASSERTION', declaredBy: 'ana' });
  await service.attachRunToAsset({ assetId: 'pendente', runId: pendingRun.runId });
  const pendingAsset = (await listedAssets()).find((entry) => entry.id === 'pendente');
  check('NOASSERTION deixa o asset license-pending', pendingAsset.rights.state === 'license-pending');
  let pendingError = null;
  try {
    // Destino diferente do que o passo `deliver` do run já gravou: assim a
    // existência (ou não) deste manifesto só pode ter vindo desta chamada.
    await service.exportRun({ runId: pendingRun.runId, destination: 'unity-2d' });
  } catch (error) {
    pendingError = error;
  }
  check('exportar com direitos pendentes é recusado (antes: gravava o manifesto)', pendingError instanceof Error);
  check('e o motivo nomeia o estado', /direitos license-pending bloqueiam/.test(pendingError?.message ?? ''));
  check('e o motivo não é vazio (antes: "bloqueiam …: .")', /: .+\./.test(pendingError?.message ?? '') && pendingError.message.includes('decisão humana'));
  check('e diz que nada foi gravado', /Nada foi gravado/.test(pendingError?.message ?? ''));
  check('nenhum manifesto foi gravado na recusa',
    await fs.stat(path.join(projectRoot, '.lia-forge', 'runs', pendingRun.runId, 'export', 'unity-2d', 'manifest.json'))
      .then(() => false).catch(() => true));

  // --- bloqueio explícito não é afrouxado pela proveniência (reprodução 3)
  const blockedRun = await succeededRun();
  await declare('bloqueado', { license: 'BLOCKED', blocked: true, declaredBy: 'ana', note: 'runtime Spine: exige licença de editor por usuário' });
  const afterAttach = await service.attachRunToAsset({ assetId: 'bloqueado', runId: blockedRun.runId });
  check('anexar run NÃO apaga o bloqueio declarado por pessoa', afterAttach.rights.state === 'blocked');
  check('e a autoria da declaração sobrevive', afterAttach.rights.declaredBy === 'ana');
  check('e a licença da ferramenta fica como evidência, não como estado',
    afterAttach.provenance.every((item) => typeof item.license === 'string') && afterAttach.rights.state === 'blocked');
  let blockedError = null;
  try {
    await service.exportRun({ runId: blockedRun.runId, destination: 'godot-4' });
  } catch (error) {
    blockedError = error;
  }
  check('exportar asset bloqueado é recusado', blockedError instanceof Error);
  check('e o motivo nomeia o bloqueio explícito', /declaração explícita de bloqueio/.test(blockedError?.message ?? ''));

  // --- declaração permissiva de pessoa libera, e vai no manifesto
  const licensedRun = await succeededRun();
  await declare('liberado', { license: 'CC0-1.0', declaredBy: 'ana', note: 'arte própria' });
  const licensedAsset = await service.attachRunToAsset({ assetId: 'liberado', runId: licensedRun.runId });
  check('CC0 declarado por pessoa mantém o asset redistribuível depois do attach', licensedAsset.rights.redistributable === true);
  const licensedExport = await service.exportRun({ runId: licensedRun.runId, destination: 'godot-4' });
  check('com direitos declarados a exportação é permitida', licensedExport.bundle.files.length > 0);
  check('e o estado vai no manifesto', licensedExport.bundle.rights?.state === 'licensed');
  check('e a licença declarada vai no manifesto', JSON.stringify(licensedExport.bundle.rights?.licenses) === '["CC0-1.0"]');
  check('e a autoria da declaração vai no manifesto', licensedExport.bundle.rights?.declaredBy === 'ana');
  check('e o manifesto gravado em disco é o mesmo',
    JSON.parse(await fs.readFile(path.join(projectRoot, licensedExport.path), 'utf8')).rights?.declaredBy === 'ana');

  // --- gate de estado do run
  const blocked3d = await service.run({ workflowId: '3d-character-spritesheet' });
  check('o run 3D fica bloqueado neste ambiente (sem Blender nem provider)', blocked3d.snapshot.status === 'blocked');
  let stateError = null;
  try {
    await service.exportRun({ runId: blocked3d.runId, destination: 'godot-4' });
  } catch (error) {
    stateError = error;
  }
  check('exportar run não concluído é recusado', /está "blocked"; exportar exige run concluído/.test(stateError?.message ?? ''));
  let attachStateError = null;
  try {
    await service.upsertAsset({ id: 'temporario', type: 'character', name: 'Temporário' });
    await service.attachRunToAsset({ assetId: 'temporario', runId: blocked3d.runId });
  } catch (error) {
    attachStateError = error;
  }
  check('anexar run não concluído a asset é recusado', /exige run concluído|revisão humana pendente/.test(attachStateError?.message ?? ''));

  // --- gate de revisão pendente + validated derivado em run revisado
  await fs.mkdir(path.join(projectRoot, 'input'), { recursive: true });
  const saved = await service.saveInput({ filename: 'heroina.png', bytes: spriteBytes() });
  check('a entrada real é aceita e medida', typeof saved.sha256 === 'string' && saved.sha256.length === 64);
  const character = await service.run({
    workflowId: '2d-character-parts',
    destination: 'godot-4',
    params: { sourceImage: saved.path ?? `input/${saved.name}` },
  });
  check('o run de personagem para no gate de revisão humana', character.snapshot.status === 'blocked');
  let reviewError = null;
  try {
    await service.upsertAsset({ id: 'heroina', type: 'character', name: 'Heroína' });
    await service.attachRunToAsset({ assetId: 'heroina', runId: character.runId });
  } catch (error) {
    reviewError = error;
  }
  check('anexar run com revisão pendente é recusado', /revisão humana pendente/.test(reviewError?.message ?? ''));
  check('e nomeia o passo que espera revisão', /"decompose"/.test(reviewError?.message ?? ''));
  let reviewExportError = null;
  try {
    await service.exportRun({ runId: character.runId, destination: 'godot-4' });
  } catch (error) {
    reviewExportError = error;
  }
  check('exportar run com revisão pendente é recusado com o motivo acionável',
    /revisão humana pendente/.test(reviewExportError?.message ?? ''));

  // aprova as revisões (decisão humana real, ancorada no hash do artefato)
  let current = character.snapshot;
  for (let round = 0; round < 6; round += 1) {
    const pending = current.steps.find((step) => step.state === 'blocked' && step.review?.status === 'review-missing');
    if (!pending) break;
    const reviewed = await service.reviewStep({ runId: character.runId, stepId: pending.id, approved: true, reviewer: 'smoke-direitos', note: 'partes conferidas' });
    assert.equal(reviewed.resumed, true, `aprovar "${pending.id}" retoma o run`);
    current = reviewed.result;
  }
  check('o run conclui depois das revisões', current.status === 'succeeded');

  const reviewed = await service.attachRunToAsset({ assetId: 'heroina', runId: character.runId });
  check('run concluído e revisado vira versão do asset', reviewed.versions.length === 1);
  const versionArtifacts = reviewed.versions[0].artifacts;
  check('a versão tem artefatos', versionArtifacts.length > 0);
  check('todo artefato carrega evidência de validação (nunca só o booleano)',
    versionArtifacts.every((artifact) => artifact.validation?.status && artifact.validation.reason.length > 10));
  check('nenhum artefato é validated sem validador aprovado no próprio passo',
    versionArtifacts.every((artifact) => !artifact.validated || String(artifact.validation?.reason ?? '').includes('Validado por')));
  check('todo artefato validado ancora o SHA-256 do arquivo',
    versionArtifacts.filter((artifact) => artifact.validated).every((artifact) => artifact.validation?.sha256 === artifact.sha256));
  const multiOutput = versionArtifacts.filter((artifact) => artifact.validation?.status === 'hash-diverged');
  check('saída secundária de passo com várias saídas não é marcada como validada (sem evidência para ela)',
    multiOutput.length > 0 ? multiOutput.every((artifact) => artifact.validated === false) : true);
  check('e o motivo é legível', multiOutput.length === 0 || multiOutput.every((artifact) => artifact.validation.reason.length > 30));

  // a evidência sobrevive no store publicado
  const store = JSON.parse(await fs.readFile(path.join(projectRoot, '.spriteforge', 'assets.json'), 'utf8'));
  const stored = store.assets.find((entry) => entry.id === 'heroina');
  check('o store publicado grava a evidência de validação',
    stored.versions[0].artifacts.every((artifact) => artifact.validation && typeof artifact.validation.status === 'string'));
  check('e o schemaVersion do store não muda', store.schemaVersion === 1);

  // --- integridade do byte exportado
  await service.declareAssetRights('heroina', { license: 'CC0-1.0', declaredBy: 'ana' });
  const cleanExport = await service.exportRun({ runId: character.runId, destination: 'godot-4' });
  check('run revisado com direitos declarados exporta', cleanExport.bundle.files.length > 0);
  const mainOutput = (await service.readRun(character.runId)).steps.find((step) => step.sha256)?.outputs?.[0];
  const target = path.isAbsolute(mainOutput) ? mainOutput : path.join(projectRoot, mainOutput);
  const bytes = await fs.readFile(target);
  bytes[bytes.length - 2] ^= 0xff;
  await fs.writeFile(target, bytes);
  let tamperError = null;
  try {
    await service.exportRun({ runId: character.runId, destination: 'godot-4' });
  } catch (error) {
    tamperError = error;
  }
  check('mudar 1 byte do artefato depois do run faz a exportação falhar', tamperError instanceof Error);
  check('e o motivo é divergência de hash, com os dois hashes', /mudou depois do run/.test(tamperError?.message ?? '') && /[0-9a-f]{12}…/.test(tamperError?.message ?? ''));
  check('e nada foi gravado na tentativa adulterada', /Nada foi gravado/.test(tamperError?.message ?? ''));
} catch (error) {
  // Erro inesperado no meio do fluxo não pode esconder as checagens já feitas:
  // sem isto a saída seria só a stack, e uma regressão pareceria "teste quebrou"
  // em vez de mostrar quais garantias deixaram de valer.
  failures += 1;
  results.push(`FAIL fluxo interrompido por erro não tratado: ${error?.message ?? error}`);
} finally {
  await fs.rm(projectRoot, { recursive: true, force: true });
}

// --------------------------------------------- store: proveniência não afrouxa nada
{
  const saves = [];
  const manager = createAssetManager({ store: { schemaVersion: 1, assets: [], updatedAt: null }, save: async (payload) => saves.push(payload) });
  manager.upsert({ id: 'spine', type: 'character', name: 'Personagem Spine' });
  manager.declareRights('spine', { license: 'BLOCKED', blocked: true, declaredBy: 'ana' });
  const first = await manager.addProvenance('spine', { adapter: 'rig2d-software', license: 'MIT', runId: 'r1' });
  check('proveniência com licença permissiva NÃO libera asset bloqueado', first.rights.state === 'blocked');
  check('e não o torna redistribuível', first.rights.redistributable === false);
  const second = await manager.addProvenance('spine', { adapter: 'model3d-generate', weightsLicense: 'CC-BY-NC-4.0', runId: 'r2' });
  check('pesos não comerciais continuam endurecendo o estado', second.rights.restricted.length > 0);
  check('o store gravado mantém a decisão humana', saves.at(-1).assets[0].rights.declaredBy === 'ana');
}

console.log(results.join('\n'));
console.log(`\nrights-provenance-smoke: ${failures ? `FAIL (${failures} de ${results.length})` : `${results.length} checagens, passou`}`);
process.exit(failures ? 1 : 0);
