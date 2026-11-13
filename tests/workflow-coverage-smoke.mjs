/**
 * Cobertura dos workflows do Lia Forge (requisitos §12 e §12.1).
 *
 * O que este smoke prova, executando de verdade em um projeto temporário:
 *   1. os 8 workflows do catálogo são planejados (§12.1: mínimo de 8);
 *   2. os 5 que só usam adapters internos chegam a `succeeded` — incluindo os
 *      gates de revisão humana, a retomada por checkpoint e o reaproveitamento
 *      de um rig já revisado por outro run;
 *   3. os 3 que dependem de ferramenta externa (ComfyUI/Blender) terminam
 *      `blocked` com motivo nomeado e ação que não pode ser automatizada —
 *      nunca `failed` (falha seria defeito nosso) e nunca "disponível";
 *   4. a validação declarada no plano é executada: nenhum passo concluído fica
 *      com validador pendurado por falta de payload;
 *   5. a exportação por destino continua funcionando depois de tudo isso.
 *
 * Vocabulário de evidência (não é intercambiável):
 *   - `executado`  → o código rodou aqui, neste ambiente, e gravou artefatos;
 *   - `bloqueado`  → não executou porque falta ferramenta/entrada do usuário,
 *                    com o motivo registrado no run;
 *   - nada aqui afirma "validado no destino" (engine de jogo) nem "aprovado".
 *
 * Nada instala, baixa, compra ou envia: só código do checkout.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createStudioService } from '../shared/services/studio-service.mjs';
import { createImage } from '../shared/imaging/core.mjs';
import { encodePngRgba, analyzePngContent } from '../shared/qa/png-codec.mjs';
import { WORKFLOW_IDS } from '../shared/orchestrator/planner.mjs';
import { buildGlbFixture } from './glb-fixtures.mjs';

function check(condition, message) {
  assert.ok(condition, message);
}

/** Sprite 48×48 com 6 regiões conexas (cabeça, torso, 2 braços, 2 pernas). */
function makeSprite() {
  const image = createImage(48, 48);
  const paint = (x0, y0, width, height, color) => {
    for (let y = y0; y < y0 + height; y += 1) {
      for (let x = x0; x < x0 + width; x += 1) image.rgba.set(color, (y * 48 + x) * 4);
    }
  };
  paint(18, 2, 12, 10, [240, 210, 190, 255]);
  paint(16, 13, 16, 16, [200, 60, 160, 255]);
  paint(9, 14, 6, 13, [180, 50, 140, 255]);
  paint(33, 14, 6, 13, [180, 50, 140, 255]);
  paint(17, 30, 6, 15, [90, 40, 120, 255]);
  paint(25, 30, 6, 15, [90, 40, 120, 255]);
  return image;
}

const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-workflow-coverage-'));
/** @type {{workflow:string, caso:string, status:string, passos:string, evidencia:string}[]} */
const matrix = [];

function record(workflow, caso, snapshot, evidencia) {
  const passos = snapshot.steps.map((step) => `${step.id}=${step.state}`).join(' ');
  matrix.push({ workflow, caso, status: snapshot.status, passos, evidencia });
  return passos;
}

/** Validações declaradas: nada de validador pulado em passo que executou. */
function assertValidations(workflowId, snapshot) {
  for (const step of snapshot.steps) {
    if (step.state !== 'succeeded') continue;
    const validations = step.validations ?? [];
    if (validations.length === 0) continue; // reaproveitado de checkpoint
    for (const validation of validations) {
      check(
        validation.status === 'passed',
        `${workflowId}/${step.id}: validador "${validation.validator}" deveria ter passado, obtido "${validation.status}" (${validation.reason ?? validation.problems ?? ''})`,
      );
      check(validation.checked === undefined || validation.checked >= 1, `${workflowId}/${step.id}: nada foi verificado por "${validation.validator}"`);
    }
  }
}

/** Aprova todos os gates de revisão pendentes até o run concluir (máx. 6). */
async function approveReviews(service, runId, snapshot, workflowId) {
  let current = snapshot;
  for (let round = 0; round < 6; round += 1) {
    const pending = current.steps.find((step) => step.state === 'blocked' && step.review?.status === 'review-missing');
    if (!pending) return current;
    const reviewed = await service.reviewStep({ runId, stepId: pending.id, approved: true, reviewer: 'smoke-de-cobertura', note: 'partes conferidas' });
    check(reviewed.resumed === true, `${workflowId}: aprovar "${pending.id}" retoma o run`);
    check(reviewed.decision.sha256?.length === 64, `${workflowId}: a revisão ancora o SHA-256 do artefato`);
    current = reviewed.result;
  }
  return current;
}

try {
  await fs.mkdir(path.join(projectRoot, 'input'), { recursive: true });
  const sprite = makeSprite();
  await fs.writeFile(path.join(projectRoot, 'input', 'sprite.png'), encodePngRgba(sprite.rgba, sprite.width, sprite.height));

  const service = createStudioService({ projectRoot });

  // ---------------------------------------------------- 1. catálogo completo
  const listed = await service.workflows();
  check(listed.length === WORKFLOW_IDS.length, `catálogo tem ${WORKFLOW_IDS.length} workflows`);
  check(listed.length >= 8, `§12.1 exige no mínimo 8 workflows (obtidos: ${listed.length})`);
  const executableIds = listed.filter((workflow) => workflow.executableNow).map((workflow) => workflow.id);

  // ------------------------------------------- 2. workflows só com internos
  // 2.1 UI/VFX: sem revisão, sem ferramenta externa.
  const vfx = await service.run({
    workflowId: 'ui-vfx-sheet',
    destination: 'godot-4',
    options: { vfx: { preset: 'impact', size: 64, frameCount: 8 } },
  });
  check(vfx.snapshot.status === 'succeeded', `ui-vfx-sheet succeeded (${vfx.snapshot.status})`);
  assertValidations('ui-vfx-sheet', vfx.snapshot);
  record('ui-vfx-sheet', 'execução direta', vfx.snapshot, 'executado (adapters internos)');

  // 2.2 Variações/retexture: determinístico, sem IA.
  const retexture = await service.run({
    workflowId: 'variation-retexture',
    destination: 'godot-4',
    params: { sourceImage: 'input/sprite.png' },
  });
  check(retexture.snapshot.status === 'succeeded', `variation-retexture succeeded (${retexture.snapshot.status})`);
  assertValidations('variation-retexture', retexture.snapshot);
  const atlasStep = retexture.snapshot.steps.find((step) => step.id === 'atlas');
  check(atlasStep.outputs.length === 2, 'o atlas vem com o manifesto de grade gravado');
  record('variation-retexture', 'execução direta', retexture.snapshot, 'executado (adapters internos)');

  // 2.3 Personagem 2D: dois gates de revisão + retomada por checkpoint.
  const character = await service.run({
    workflowId: '2d-character-parts',
    destination: 'godot-4',
    brief: 'Aiko, Guarda Florestal',
    params: { sourceImage: 'input/sprite.png' },
  });
  check(character.snapshot.status === 'blocked', `2d-character-parts para no gate de revisão (${character.snapshot.status})`);
  check(
    character.snapshot.steps.find((step) => step.id === 'decompose').review?.status === 'review-missing',
    'o gate de revisão é explícito no passo',
  );
  record('2d-character-parts', 'parou no gate', character.snapshot, 'executado até o gate de revisão');

  const characterDone = await approveReviews(service, character.runId, character.snapshot, '2d-character-parts');
  check(characterDone.status === 'succeeded', `2d-character-parts conclui após as revisões (${characterDone.status})`);
  assertValidations('2d-character-parts', characterDone);
  record('2d-character-parts', 'revisão + retomada', characterDone, 'executado (revisão humana aprovada, retomada por checkpoint)');

  // O contrato publicado do spritesheet humanoide continua de pé (§7).
  const renderStep = characterDone.steps.find((step) => step.id === 'render');
  const sheetPath = renderStep.outputs.find((output) => /\.png$/i.test(output));
  const sheetBytes = await fs.readFile(path.join(projectRoot, sheetPath));
  const sheetAnalysis = analyzePngContent(sheetBytes, { grid: renderStep.metrics.grid });
  check(sheetAnalysis.blank === false, 'o atlas do personagem tem conteúdo real');
  check(renderStep.metrics.grid.frameWidth === 48 && renderStep.metrics.grid.frameHeight === 48, 'frame 48×48 preservado');

  // 2.4 Animação 2D reutilizando o rig já revisado de outro run.
  const animationBlocked = await service.run({ workflowId: '2d-animation', destination: 'godot-4' });
  check(animationBlocked.snapshot.status === 'blocked', `2d-animation sem run de origem bloqueia (${animationBlocked.snapshot.status})`);
  const blockedRig = animationBlocked.snapshot.steps.find((step) => step.id === 'rig');
  check(blockedRig.error?.code === 'WORKFLOW_BLOCKED', 'o motivo do bloqueio é nomeado');
  check(/run de origem/i.test(blockedRig.error.message), 'a mensagem diz o que fazer para destravar');
  const { plan: animationPlan } = await service.plan({ workflowId: '2d-animation', destination: 'godot-4' });
  check(
    animationPlan.userActions.some((action) => action.kind === 'provide-input' && action.canBeAutomated === false),
    'a ação pendente é declarada como decisão humana (não automatizável)',
  );
  record('2d-animation', 'sem run de origem', animationBlocked.snapshot, 'bloqueado (falta entrada do usuário; motivo registrado)');

  const animation = await service.run({
    workflowId: '2d-animation',
    destination: 'godot-4',
    options: { fromRun: character.runId },
  });
  const animationDone = await approveReviews(service, animation.runId, animation.snapshot, '2d-animation');
  check(animationDone.status === 'succeeded', `2d-animation conclui reaproveitando o rig revisado (${animationDone.status})`);
  assertValidations('2d-animation', animationDone);
  const reusedRig = animationDone.steps.find((step) => step.id === 'rig');
  check(reusedRig.outputs.length === 1, 'o rig de origem foi carregado do run anterior');
  record('2d-animation', 'rig de outro run', animationDone, 'executado (rig revisado reaproveitado entre runs)');

  // 2.5 Personagem modular: peças intercambiáveis, animações compartilhadas.
  const modular = await service.run({
    workflowId: '2d-modular-character',
    destination: 'godot-4',
    params: { sourceImage: 'input/sprite.png' },
  });
  const modularDone = await approveReviews(service, modular.runId, modular.snapshot, '2d-modular-character');
  check(modularDone.status === 'succeeded', `2d-modular-character conclui após revisão (${modularDone.status})`);
  assertValidations('2d-modular-character', modularDone);
  const variants = modularDone.steps.find((step) => step.id === 'variants');
  check(variants.metrics.sharedAnimations === true, 'as animações são compartilhadas entre variantes (sem pipeline por variante)');
  check(variants.validations.some((item) => item.validator === 'rig2d-structural' && item.checked >= 1), 'cada variante modular foi validada como rig');
  record('2d-modular-character', 'revisão + retomada', modularDone, 'executado (adapters internos)');

  // ------------------------------- 3. workflows que dependem de ferramenta
  for (const workflowId of ['2d-art-concept', '3d-object-render', '3d-character-spritesheet']) {
    const run = await service.run({
      workflowId,
      destination: 'godot-4',
      params: { sourceImage: 'input/sprite.png' },
    });
    check(run.snapshot.status === 'blocked', `${workflowId} bloqueia por ferramenta/entrada ausente (${run.snapshot.status})`);
    check(
      run.snapshot.steps.every((step) => step.state !== 'failed'),
      `${workflowId}: nenhum passo pode aparecer como falha — falta de ferramenta é bloqueio nomeado`,
    );
    const blocked = run.snapshot.steps.filter((step) => step.state === 'blocked');
    check(blocked.length >= 1, `${workflowId} registra ao menos um passo bloqueado`);
    for (const step of blocked) {
      check(step.error?.message?.length > 10, `${workflowId}/${step.id}: bloqueio sem motivo nomeado`);
      check(step.error.requiresUserDecision === true, `${workflowId}/${step.id}: o bloqueio exige decisão humana`);
    }
    const { plan } = await service.plan({ workflowId, destination: 'godot-4' });
    check(plan.blocked === true, `${workflowId}: o plano já avisa o bloqueio antes de executar`);
    check(
      plan.userActions.every((action) => action.canBeAutomated === false),
      `${workflowId}: nenhuma ação pendente é oferecida como automatizável`,
    );
    check(!executableIds.includes(workflowId), `${workflowId} não pode aparecer como executável agora`);
    record(workflowId, 'ferramenta ausente', run.snapshot, 'bloqueado (motivo + ação humana; nada foi instalado ou baixado)');
  }

  // 3.1 O passo de inspeção GLB existe e funciona; falta o modelo do usuário.
  const objectPlan = await service.plan({ workflowId: '3d-object-render', destination: 'godot-4' });
  check(objectPlan.plan.steps[0].adapter === 'glb-inspect', 'a inspeção GLB é interna e está presente');
  check(objectPlan.plan.pendingInputs.some((item) => item.param === 'model'), 'o plano pede o modelo do usuário');
  const objectWithModel = await service.plan({ workflowId: '3d-object-render', destination: 'godot-4', options: { model: 'input/modelo.glb' } });
  check(objectWithModel.plan.pendingInputs.length === 0, 'informar o modelo remove a pendência de entrada');
  check(objectWithModel.plan.blocked === true, 'o render continua bloqueado: Blender não está instalado neste ambiente');

  // 3.2 Com o modelo fornecido pelo usuário, o que é interno executa de verdade
  // e só o que depende de Blender continua bloqueado — a fronteira é visível.
  await fs.writeFile(path.join(projectRoot, 'input', 'modelo.glb'), buildGlbFixture());
  const objectRun = await service.run({
    workflowId: '3d-object-render',
    destination: 'godot-4',
    params: { model: 'input/modelo.glb' },
  });
  const inspected = objectRun.snapshot.steps.find((step) => step.id === 'inspect');
  check(inspected.state === 'succeeded', `inspeção GLB executa com o modelo do usuário (${inspected.state})`);
  check(inspected.metrics.triangleCount > 0, 'o relatório estrutural tem conteúdo medido');
  check(
    inspected.validations.some((item) => item.validator === 'glb-structural' && item.status === 'passed'),
    'o validador declarado rodou sobre o modelo lido',
  );
  const blenderStep = objectRun.snapshot.steps.find((step) => step.id === 'render');
  check(blenderStep.state === 'blocked', 'o render continua bloqueado: Blender não está instalado');
  check(/blender/i.test(blenderStep.error.message), 'o motivo nomeia a ferramenta ausente');
  check(objectRun.snapshot.status === 'blocked', 'o run não finge que terminou');
  record('3d-object-render', 'modelo fornecido', objectRun.snapshot, 'inspeção executada; render bloqueado (Blender ausente)');

  // 3.3 Id de run é nome de pasta: caminho relativo é recusado antes de ler.
  const traversal = await service.run({ workflowId: '2d-animation', destination: 'godot-4', options: { fromRun: '../../../etc' } })
    .then((result) => ({ ok: true, status: result.snapshot.status }))
    .catch((error) => ({ ok: false, message: error.message }));
  check(traversal.ok === false && /fromRun inválido/.test(traversal.message), `fromRun com traversal é recusado (${traversal.message ?? traversal.status})`);

  // ------------------------------------------------- 4. exportação por destino
  const exported = await service.exportRun({ runId: character.runId, destination: 'godot-4' });
  check(exported.bundle.files.length > 0, 'a exportação produz arquivos');
  check(exported.bundle.files.every((file) => file.sha256?.length === 64), 'cada arquivo exportado carrega SHA-256');
  check(exported.bundle.verifiedOnDestination === false, 'nada afirma validação no destino sem execução na engine de jogo');
  check(typeof exported.compatibility?.compatible === 'boolean', 'a compatibilidade declarada é conferida contra o perfil do destino');

  // ------------------------------------------------------- 5. resumo impresso
  const executados = matrix.filter((row) => row.status === 'succeeded').length;
  const bloqueados = matrix.filter((row) => row.status === 'blocked').length;
  for (const row of matrix) {
    console.log(`  · ${row.workflow.padEnd(24)} ${row.caso.padEnd(20)} ${row.status.padEnd(9)} ${row.evidencia}`);
  }
  check(executados >= 5, `pelo menos 5 casos executados até o fim (${executados})`);
  check(bloqueados >= 4, `bloqueios nomeados registrados (${bloqueados})`);

  console.log(
    `Workflow coverage smoke test passed (${WORKFLOW_IDS.length} workflows no catálogo; `
    + `${executados} casos succeeded, ${bloqueados} blocked com motivo; validações declaradas executadas; revisão + retomada + rig entre runs ok).`,
  );
} finally {
  await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => {});
}
