/**
 * Smoke da autorização por run (P0-2 da revisão integrada).
 *
 * O que este arquivo prova, e o que não prova
 * -------------------------------------------
 * Prova: que o gate de autorização **roda** no fluxo real do produto (serviço →
 * engine), que o escopo é derivado do plano real deste run, que a autorização é
 * vinculada a ele por fingerprint e por ação protegida, que falha/ausência/
 * incompatibilidade/adulteração negam a execução, e que a superfície HTTP não
 * consegue conceder nada (sobe um processo Vite de verdade para isso).
 *
 * Não prova: segurança do sistema real instalado. O app empacotado usa IPC; a
 * validação do payload IPC é testada aqui como função (`readRunAuthorization`),
 * não com Electron real — nada aqui substitui teste no alvo (Windows). Também não
 * executa Blender nem provider remoto: os runs protegidos param no gate seguinte
 * (ferramenta ausente), que é o comportamento honesto neste ambiente.
 *
 * Reprodução do problema que motivou a correção (medida antes, com o código de
 * `cdb0e8d`):
 *   service.run({ workflowId: '2d-character-parts' })
 *     → snapshot.gates = {}            (nenhum gate de autorização registrado)
 *   `manager.execute(plan, { context, authorization })` era chamado SEM `scope`,
 *   e o gate do engine só roda `if (scope)`. Ou seja: `checkAuthorization` — que
 *   existe desde a fase F1–F3 e confere fingerprint, expiração e ações protegidas
 *   — nunca era alcançado pelo produto. `authorization` era decorativo, e a única
 *   coisa que de fato liberava envio remoto era a flag persistente
 *   `providers.comfyui.authorization.granted`.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { authorizationFingerprint } from '../shared/engine/gates.mjs';
import {
  NO_PROTECTED_ACTION_NOTE,
  PROTECTED_ACTIONS,
  authorizationForScope,
  bindAuthorizationToScope,
  buildRunScope,
  missingProtectedActions,
  policyAuthorizationForScope,
  readRunAuthorization,
  scopeRequiresAuthorization,
} from '../shared/engine/run-authorization.mjs';
import { createStudioService } from '../shared/services/studio-service.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
let failures = 0;

function check(label, assertion) {
  const ok = assertion === true;
  if (!ok) failures += 1;
  results.push(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — obtido: ${JSON.stringify(assertion)}`}`);
}

/** Workflow local: nenhuma ação protegida no plano. */
const LOCAL_WORKFLOW = '2d-character-parts';
/** Workflow com ações protegidas reais no plano (baixa pesos + custo). */
const PROTECTED_WORKFLOW = '3d-character-spritesheet';

// ------------------------------------------------------------------ política pura
{
  const plan = {
    id: 'wf-exemplo',
    steps: [
      { id: 'a', adapter: 'adapter-x', capability: 'cap.x' },
      { id: 'b', adapter: 'adapter-y', capability: 'cap.y' },
    ],
    protectedActions: ['cost', 'send_data'],
  };
  const scope = buildRunScope(plan, { destination: 'godot', inputs: { model: 'b'.repeat(64) }, costCeiling: 12 });

  check('escopo deriva do plano real (ordem dos passos)', JSON.stringify(scope.plan) === '["a","b"]');
  check('escopo lista os adapters do plano, ordenados', JSON.stringify(scope.adapters) === '["adapter-x","adapter-y"]');
  check('escopo lista as capacidades do plano', JSON.stringify(scope.capabilities) === '["cap.x","cap.y"]');
  check('escopo registra o destino escolhido', JSON.stringify(scope.destinations) === '["godot"]');
  check('escopo registra as ações protegidas do plano, ordenadas', JSON.stringify(scope.protectedActions) === '["cost","send_data"]');
  check('escopo vincula o SHA-256 das entradas fornecidas', JSON.stringify(scope.inputs) === `["model:${'b'.repeat(64)}"]`);
  check('escopo registra o teto de custo declarado', scope.costCeiling === 12);
  check('escopo é imutável', Object.isFrozen(scope));
  check('escopo sem destino não inventa destino', buildRunScope(plan).destinations.length === 0);
  check('escopo sem entradas não inventa entradas', buildRunScope(plan).inputs === null);

  check('escopo com ação protegida exige autorização', scopeRequiresAuthorization(scope) === true);
  check('escopo sem ação protegida não exige autorização humana', scopeRequiresAuthorization(buildRunScope({ id: 'x', steps: [], protectedActions: [] })) === false);
  check('escopo ausente não exige autorização (e não autoriza nada: o engine nega sem ela)', scopeRequiresAuthorization(null) === false);

  const fingerprint = authorizationFingerprint(scope);
  const full = bindAuthorizationToScope({ granted: true, grantedBy: 'ana', protectedActions: ['cost', 'send_data'] }, scope);
  check('autorização completa cobre as ações do escopo', JSON.stringify(missingProtectedActions(scope, full)) === '[]');
  check('autorização recebe o fingerprint do escopo quando não traz um', full.fingerprint === fingerprint);
  check('autorização preserva o fingerprint informado (é o que a pessoa viu)',
    bindAuthorizationToScope({ granted: true, grantedBy: 'ana', protectedActions: ['cost'], fingerprint: 'f'.repeat(64) }, scope).fingerprint === 'f'.repeat(64));
  check('autorização registra quem concedeu', full.grantedBy === 'ana');
  check('ações desconhecidas na autorização são descartadas (não ampliam nada)',
    JSON.stringify(bindAuthorizationToScope({ granted: true, grantedBy: 'ana', protectedActions: ['cost', 'format_disk'] }, scope).protectedActions) === '["cost"]');
  check('granted diferente de true não autoriza', bindAuthorizationToScope({ granted: 'yes', grantedBy: 'ana', protectedActions: ['cost'] }, scope) === null);
  check('ausência de autorização não autoriza', bindAuthorizationToScope(null, scope) === null);

  const partial = bindAuthorizationToScope({ granted: true, grantedBy: 'ana', protectedActions: ['cost'] }, scope);
  check('autorização parcial deixa a ação faltante nomeada', JSON.stringify(missingProtectedActions(scope, partial)) === '["send_data"]');
  check('autorização genérica (sem ações) não cobre nada', JSON.stringify(missingProtectedActions(scope, bindAuthorizationToScope({ granted: true, grantedBy: 'ana' }, scope))) === '["cost","send_data"]');

  const policy = policyAuthorizationForScope(buildRunScope({ id: 'x', steps: [], protectedActions: [] }));
  check('registro da política diz quem o produziu', policy.grantedBy === 'policy:no-protected-action');
  check('registro da política traz o motivo por escrito', policy.scopeNote === NO_PROTECTED_ACTION_NOTE && NO_PROTECTED_ACTION_NOTE.length > 40);
  check('registro da política não concede ação protegida nenhuma', policy.protectedActions.length === 0);
  check('registro da política é vinculado ao fingerprint do escopo', policy.fingerprint === authorizationFingerprint(buildRunScope({ id: 'x', steps: [], protectedActions: [] })));
  check('escopo sem ação protegida recebe o registro da política', authorizationForScope(buildRunScope({ id: 'x', steps: [], protectedActions: [] }), null).grantedBy === 'policy:no-protected-action');
  check('escopo com ação protegida NÃO recebe registro da política', authorizationForScope(scope, null) === null);
  check('a lista de ações protegidas é a do engine', JSON.stringify(PROTECTED_ACTIONS) === '["send_data","cost","install_software","download_models_or_weights"]');
}

// ------------------------------------------------------- validação do payload IPC
{
  const valid = readRunAuthorization({
    granted: true,
    grantedBy: '  ana  ',
    protectedActions: ['cost', 'cost', 'download_models_or_weights'],
    fingerprint: 'A'.repeat(64),
    costCeiling: 10,
    scope: 'render do personagem',
  });
  check('payload IPC válido é aceito', valid.authorization.granted === true);
  check('autoria é normalizada (sem espaços)', valid.authorization.grantedBy === 'ana');
  check('ações duplicadas viram uma só', JSON.stringify(valid.authorization.protectedActions) === '["cost","download_models_or_weights"]');
  check('fingerprint é normalizado para minúsculas', valid.authorization.fingerprint === 'a'.repeat(64));
  check('momento da decisão é gravado pelo processo, não pelo chamador', Number.isNaN(Date.parse(valid.authorization.grantedAt)) === false);
  check('teto de custo é repassado ao serviço', valid.costCeiling === 10);

  check('ausência de autorização devolve null (não inventa)', readRunAuthorization(null).authorization === null);
  check('payload undefined devolve null', readRunAuthorization(undefined).authorization === null);
  for (const [label, payload] of [
    ['não objeto', 'autorizado'],
    ['array', [{ granted: true }]],
    ['granted ausente', { grantedBy: 'ana', protectedActions: ['cost'] }],
    ['granted false', { granted: false, grantedBy: 'ana', protectedActions: ['cost'] }],
    ['granted truthy não booleano', { granted: 'true', grantedBy: 'ana', protectedActions: ['cost'] }],
    ['autoria ausente', { granted: true, protectedActions: ['cost'] }],
    ['autoria vazia', { granted: true, grantedBy: '   ', protectedActions: ['cost'] }],
    ['ações ausentes (autorização genérica)', { granted: true, grantedBy: 'ana' }],
    ['ações vazias', { granted: true, grantedBy: 'ana', protectedActions: [] }],
    ['ação desconhecida', { granted: true, grantedBy: 'ana', protectedActions: ['delete_everything'] }],
    ['fingerprint malformado', { granted: true, grantedBy: 'ana', protectedActions: ['cost'], fingerprint: 'abc123' }],
    ['expiração inválida', { granted: true, grantedBy: 'ana', protectedActions: ['cost'], expiresAt: 'amanhã' }],
    ['teto de custo negativo', { granted: true, grantedBy: 'ana', protectedActions: ['cost'], costCeiling: -5 }],
    ['teto de custo não numérico', { granted: true, grantedBy: 'ana', protectedActions: ['cost'], costCeiling: 'caro' }],
  ]) {
    let threw = false;
    try {
      readRunAuthorization(payload);
    } catch (error) {
      threw = error instanceof TypeError && error.message.length > 10;
    }
    check(`payload IPC recusado: ${label}`, threw === true);
  }
}

// ---------------------------------------------------------------- fluxo real (serviço → engine)
const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-authz-'));
const service = createStudioService({ projectRoot });
const runFile = (runId) => path.join(projectRoot, '.lia-forge', 'runs', runId, 'run.json');
const readRunFile = (runId) => fs.readFile(runFile(runId), 'utf8').then((text) => JSON.parse(text));
const authorizationGate = (snapshot) => (snapshot.gates ?? []).find((gate) => gate.gate === 'authorization') ?? null;
const executedSteps = (snapshot) => (snapshot.steps ?? []).filter((step) => step.state !== 'blocked' && step.state !== 'pending');

try {
  const localPlan = (await service.plan({ workflowId: LOCAL_WORKFLOW })).plan;
  const protectedPlan = (await service.plan({ workflowId: PROTECTED_WORKFLOW })).plan;
  const protectedScope = buildRunScope(protectedPlan, {});
  const protectedFingerprint = authorizationFingerprint(protectedScope);

  check('o plano local realmente não tem ação protegida', localPlan.protectedActions.length === 0);
  check('o plano protegido realmente tem ações protegidas', JSON.stringify(protectedPlan.protectedActions) === '["download_models_or_weights","cost"]');

  // --- positivo: run local roda e o gate fica registrado (antes: gates vazio)
  const local = await service.run({ workflowId: LOCAL_WORKFLOW, params: {} });
  check('run local registra o gate de autorização', authorizationGate(local.snapshot)?.ok === true);
  check('run local não para no gate de autorização', local.authorizationRequired === false);
  check('run local diz quem o dispensou de autorização humana', (await readRunFile(local.runId)).authorization?.grantedBy === 'policy:no-protected-action');
  check('run local grava o motivo da dispensa (auditável)', (await readRunFile(local.runId)).authorization?.scopeNote === NO_PROTECTED_ACTION_NOTE);
  check('run local grava o fingerprint do escopo', (await readRunFile(local.runId)).authorization?.fingerprint === authorizationFingerprint(buildRunScope(localPlan, { inputs: {} })));
  check('run local devolve o escopo que autorizou', local.authorizationScope?.workflowId === LOCAL_WORKFLOW);

  // --- negativo: run protegido sem autorização não executa nada
  const denied = await service.run({ workflowId: PROTECTED_WORKFLOW });
  check('run protegido sem autorização fica bloqueado', denied.snapshot.status === 'blocked');
  check('e o gate registra a recusa', authorizationGate(denied.snapshot)?.ok === false);
  check('e o gate nomeia o motivo (authorization-missing)', authorizationGate(denied.snapshot)?.code === 'authorization-missing');
  check('nenhum passo executou', executedSteps(denied.snapshot).length === 0);
  check('a resposta diz que falta autorização', denied.authorizationRequired === true);
  check('e lista as ações que faltam', JSON.stringify(denied.missingProtectedActions) === '["cost","download_models_or_weights"]');
  check('e o motivo é legível para a pessoa', String(denied.authorizationReason).includes('download_models_or_weights'));
  check('e o fingerprint a autorizar é devolvido', denied.authorizationFingerprint === authorizationFingerprint(protectedScope));
  check('a recusa fica gravada no run.json', (await readRunFile(denied.runId)).authorization?.granted === false);
  // Passo bloqueado sem motivo é passo que a interface não tem como explicar.
  check('cada passo bloqueado diz por que não executou',
    (denied.snapshot.steps ?? []).every((step) => step.error?.message?.length > 10));
  check('e marca que a saída é uma decisão humana',
    (denied.snapshot.steps ?? []).every((step) => step.error?.requiresUserDecision === true));
  check('e o motivo gravado no passo é o do gate',
    (denied.snapshot.steps ?? []).every((step) => step.error?.code === 'authorization-missing'));
  check('o run registra em log por que bloqueou',
    (denied.snapshot.logs ?? []).some((entry) => entry.details?.code === 'authorization-missing'));

  // --- negativo: autorização genérica ("pode tudo") não vale
  const generic = await service.run({
    workflowId: PROTECTED_WORKFLOW,
    authorization: { granted: true, grantedBy: 'ana', fingerprint: protectedFingerprint },
  });
  check('autorização sem ações nomeadas é recusada', generic.snapshot.status === 'blocked');
  check('e continua listando o que falta', JSON.stringify(generic.missingProtectedActions) === '["cost","download_models_or_weights"]');

  // --- negativo: autorização parcial
  const partial = await service.run({
    workflowId: PROTECTED_WORKFLOW,
    authorization: { granted: true, grantedBy: 'ana', protectedActions: ['cost'], fingerprint: protectedFingerprint },
  });
  check('autorização parcial é recusada', partial.snapshot.status === 'blocked');
  check('e nomeia só a ação que falta', JSON.stringify(partial.missingProtectedActions) === '["download_models_or_weights"]');

  // --- negativo: fingerprint de outro escopo
  const wrongFingerprint = await service.run({
    workflowId: PROTECTED_WORKFLOW,
    authorization: { granted: true, grantedBy: 'ana', protectedActions: ['cost', 'download_models_or_weights'], fingerprint: 'a'.repeat(64) },
  });
  check('autorização com fingerprint de outro escopo é recusada', wrongFingerprint.snapshot.status === 'blocked');
  check('e o motivo é escopo mudado', authorizationGate(wrongFingerprint.snapshot)?.code === 'authorization-scope-changed');
  check('e nenhum passo executou', executedSteps(wrongFingerprint.snapshot).length === 0);

  // --- negativo: autorização expirada
  const expired = await service.run({
    workflowId: PROTECTED_WORKFLOW,
    authorization: {
      granted: true, grantedBy: 'ana', protectedActions: ['cost', 'download_models_or_weights'],
      fingerprint: protectedFingerprint, expiresAt: new Date(Date.now() - 60_000).toISOString(),
    },
  });
  check('autorização expirada é recusada', expired.snapshot.status === 'blocked');
  check('e nenhum passo executou', executedSteps(expired.snapshot).length === 0);

  // --- negativo: escopo mudou depois de autorizar (destino diferente)
  const authorizedForNoDestination = await service.run({
    workflowId: PROTECTED_WORKFLOW,
    authorization: { granted: true, grantedBy: 'ana', protectedActions: ['cost', 'download_models_or_weights'], fingerprint: protectedFingerprint },
    destination: 'aseprite',
  });
  check('autorização vale só para o escopo que ela cobre (destino novo ⇒ recusa)', authorizedForNoDestination.snapshot.status === 'blocked');
  check('e o motivo é escopo mudado', authorizationGate(authorizedForNoDestination.snapshot)?.code === 'authorization-scope-changed');
  check('o escopo do run registra o destino escolhido', authorizedForNoDestination.authorizationScope?.destinations?.[0] === 'aseprite');

  // --- positivo: autorização completa e vinculada passa no gate
  const granted = await service.run({
    workflowId: PROTECTED_WORKFLOW,
    authorization: { granted: true, grantedBy: 'ana', protectedActions: ['cost', 'download_models_or_weights'], fingerprint: protectedFingerprint },
  });
  check('run protegido com autorização completa passa no gate', authorizationGate(granted.snapshot)?.ok === true);
  // O run não completa neste ambiente (não há Blender nem provider remoto, e isso
  // não é autorizado nesta tarefa). O que importa aqui é que ele passou pela
  // autorização e parou no obstáculo seguinte, real e nomeado — não no gate.
  check('e avança além da autorização: para no obstáculo seguinte, nomeado',
    (granted.snapshot.steps ?? []).some((step) => step.error?.code === 'WORKFLOW_BLOCKED'));
  check('e o obstáculo seguinte não é a autorização',
    !(granted.snapshot.steps ?? []).some((step) => step.error?.code === 'authorization-missing'));
  check('e diz que exigia autorização', granted.authorizationRequired === true);
  check('e devolve o fingerprint que autorizou', granted.authorizationFingerprint === protectedFingerprint);
  const grantedRun = await readRunFile(granted.runId);
  check('a decisão humana fica gravada com autoria', grantedRun.authorization?.grantedBy === 'ana');
  check('e com as ações que ela cobriu', JSON.stringify(grantedRun.authorization?.protectedActions) === '["cost","download_models_or_weights"]');
  check('e com o escopo que ela cobriu', grantedRun.scope?.workflowId === PROTECTED_WORKFLOW);
  check('o snapshot não grava segredo da autorização', !JSON.stringify(grantedRun.authorization).match(/apiKey|token|secret|password/i));

  // --- retomada: reusa a autorização gravada, revalidada contra o escopo atual
  const resumed = await service.resumeRun({ runId: granted.runId, reason: 'retomar com a mesma decisão' });
  check('retomada de run autorizado continua autorizada', authorizationGate(resumed.result)?.ok === true);

  // --- retomada após adulteração do run.json: negada
  const tamperedFile = runFile(granted.runId);
  const tampered = await readRunFile(granted.runId);
  tampered.authorization.protectedActions = [];
  await fs.writeFile(tamperedFile, `${JSON.stringify(tampered, null, 2)}\n`, 'utf8');
  const afterTamper = await service.resumeRun({ runId: granted.runId, reason: 'retomar depois de adulterar o registro' });
  // O contraste com a checagem acima ("retomada de run autorizado continua
  // autorizada") é o que fecha a prova: mesmo run, mesmo plano, só o registro de
  // autorização adulterado — e a resposta muda de autorizada para negada.
  check('adulterar a autorização gravada faz a retomada negar no gate', authorizationGate(afterTamper.result)?.ok === false);
  check('e o gate da retomada negada nomeia autorização ausente', authorizationGate(afterTamper.result)?.code === 'authorization-missing');
  check('e nenhum passo executa na retomada negada', executedSteps(afterTamper.result).length === 0);

  // --- retomada de run que nunca foi autorizado continua negada
  const deniedResumed = await service.resumeRun({ runId: denied.runId, reason: 'tentar retomar sem autorizacao' });
  check('retomar um run nunca autorizado continua bloqueado', deniedResumed.result?.status === 'blocked');
  check('e continua negando no gate de autorização', authorizationGate(deniedResumed.result)?.ok === false);
} finally {
  await fs.rm(projectRoot, { recursive: true, force: true });
}

// ------------------------------------------- superfície HTTP não concede autorização
{
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-authz-http-'));
  const port = 5211;
  const origin = `http://127.0.0.1:${port}`;
  const api = `${origin}/api/lia-forge/studio`;
  const child = spawn(process.execPath, [
    path.join(repositoryRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
    '--host', '127.0.0.1', '--port', String(port), '--strictPort',
  ], {
    cwd: repositoryRoot,
    env: { ...process.env, SPRITEFORGE_PROJECT_ROOT: projectRoot },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  child.stdout.on('data', (chunk) => { serverLog += String(chunk); });
  child.stderr.on('data', (chunk) => { serverLog += String(chunk); });

  try {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      try {
        const response = await fetch(`${api}/overview`, { headers: { origin } });
        if (response.ok) break;
      } catch { /* ainda subindo */ }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const tokenSource = await fetch(`${origin}/@lia-forge/session-token.js`, { headers: { 'sec-fetch-site': 'same-origin' } }).then((response) => response.text());
    const token = /export const sessionToken = "([^"]+)"/.exec(tokenSource)?.[1] ?? null;
    const headers = { 'content-type': 'application/json', origin, 'x-lia-forge-token': token };

    // Fingerprint do escopo real deste servidor: é o que uma pessoa veria na
    // tela antes de autorizar. O teste o envia no corpo para provar que nem assim
    // a rota HTTP concede.
    const localService = createStudioService({ projectRoot });
    const protectedPlan = (await localService.plan({ workflowId: PROTECTED_WORKFLOW })).plan;
    const fingerprint = authorizationFingerprint(buildRunScope(protectedPlan, {}));

    // Mesmo com token válido, Origin correto e uma autorização "completa" no
    // corpo, a rota HTTP não encaminha o campo: o run protegido bloqueia.
    const response = await fetch(`${api}/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        workflowId: PROTECTED_WORKFLOW,
        authorization: { granted: true, grantedBy: 'atacante', protectedActions: ['cost', 'download_models_or_weights'], fingerprint },
      }),
    });
    const body = await response.json().catch(() => ({}));
    check('POST /run com token válido é aceito pela política', response.status === 200);
    check('mas a superfície HTTP NÃO concede autorização pelo corpo', body.authorizationRequired === true);
    check('e o run protegido fica bloqueado', body.snapshot?.status === 'blocked');
    check('e nenhuma ação protegida foi coberta', JSON.stringify(body.missingProtectedActions) === '["cost","download_models_or_weights"]');
    check('e o run gravado não traz autoria do atacante',
      (await fs.readFile(path.join(projectRoot, '.lia-forge', 'runs', body.runId, 'run.json'), 'utf8')
        .then((text) => JSON.parse(text).authorization?.grantedBy !== 'atacante')) === true);

    // Run local pela mesma rota continua funcionando (não quebrou o fluxo legítimo).
    const localResponse = await fetch(`${api}/run`, {
      method: 'POST', headers, body: JSON.stringify({ workflowId: LOCAL_WORKFLOW, params: {} }),
    });
    const localBody = await localResponse.json().catch(() => ({}));
    check('run local pela HTTP continua executando', localResponse.status === 200 && localBody.authorizationRequired === false);
    check('e o gate de autorização fica registrado também por HTTP',
      (localBody.snapshot?.gates ?? []).some((gate) => gate.gate === 'authorization' && gate.ok === true));
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!child.killed) child.kill('SIGKILL');
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
  if (serverLog.includes('error')) results.push(`--- log do servidor ---\n${serverLog.slice(-500)}`);
}

console.log(results.join('\n'));
console.log(`\nrun-authorization-smoke: ${failures ? `FAIL (${failures} de ${results.length})` : `${results.length} checagens, passou`}`);
process.exit(failures ? 1 : 0);
