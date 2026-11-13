#!/usr/bin/env node
/**
 * Smoke da estrutura de projeto: criar/abrir a pasta de trabalho sem tocar no
 * que já existe (§3 passo 1 da jornada e §5 preservação de `.spriteforge/` e
 * `.lia.json`).
 *
 * O que é verificado: a leitura não escreve nada, a criação faz apenas
 * `input/` e `.lia-forge/runs/`, conteúdo pré-existente (incluindo o store
 * legado e o manifesto do destino Lia Desktop) sobrevive byte a byte, o serviço
 * do Studio informa o mesmo estado e raízes inválidas são recusadas com motivo.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  inspectProjectStructure,
  ensureProjectStructure,
  PROJECT_DIRECTORIES,
} from '../shared/integrations/project-structure.mjs';
import { createStudioService } from '../shared/services/studio-service.mjs';
import { encodePngRgba } from '../shared/qa/png-codec.mjs';
import { createImage } from '../shared/imaging/core.mjs';

const findings = [];
function check(condition, message) {
  assert.ok(condition, message);
  findings.push(message);
}

const baseDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-project-'));
const projectRoot = path.join(baseDirectory, 'Meu Jogo');

try {
  // --------------------------------------------------- 1. leitura não escreve
  const before = await inspectProjectStructure(projectRoot);
  check(before.exists === false && before.writable === false, 'pasta inexistente é reportada como tal');
  check(before.counts.inputs === 0 && before.counts.runs === 0, 'contagens zeradas sem pasta');
  check(/nada foi criado/i.test(before.note), 'a leitura diz que não criou nada');
  const created = await fs.readdir(baseDirectory);
  check(!created.includes('Meu Jogo'), 'inspecionar não criou a pasta do projeto');

  // ------------------------------------------------------ 2. criação mínima
  const first = await ensureProjectStructure(projectRoot);
  check(first.created.length === 2, `apenas input/ e .lia-forge/runs/ são criados (${first.created.join(', ')})`);
  check(first.created.includes(PROJECT_DIRECTORIES.inputs) && first.created.includes(PROJECT_DIRECTORIES.runs),
    'as pastas criadas são as do contrato');
  check(first.existing.length === 0, 'nada existia antes');
  const structure = await fs.readdir(projectRoot);
  check(structure.sort().join(',') === ['.lia-forge', 'input'].sort().join(','), `a pasta nova contém só o essencial (${structure.join(', ')})`);

  const second = await ensureProjectStructure(projectRoot);
  check(second.created.length === 0 && second.existing.length === 2, 'chamar de novo não recria nada');
  check(/já existia/i.test(second.note), 'a resposta diz que a estrutura já existia');

  // ------------------------------------- 3. conteúdo pré-existente sobrevive
  const legacyStore = path.join(projectRoot, '.spriteforge');
  await fs.mkdir(legacyStore, { recursive: true });
  const legacyAssets = JSON.stringify({ schemaVersion: 1, assets: [{ id: 'aiko-antiga', name: 'Aiko (store antigo)' }] }, null, 2);
  await fs.writeFile(path.join(legacyStore, 'assets.json'), legacyAssets, 'utf8');
  await fs.writeFile(path.join(legacyStore, 'runs'), 'run-antigo\n', 'utf8');
  const liaManifest = JSON.stringify({ schemaVersion: 1, asset: 'aiko', stages: [{ id: 'spritesheet', artifacts: ['spritesheet.png'] }] }, null, 2);
  await fs.writeFile(path.join(projectRoot, '.lia.json'), liaManifest, 'utf8');
  const image = createImage(48, 48, [18, 12, 26, 0]);
  for (let pixel = 0; pixel < 48 * 48; pixel += 7) image.rgba.set([236, 90, 200, 255], pixel * 4);
  await fs.writeFile(path.join(projectRoot, 'input', 'sprite.png'), encodePngRgba(image.rgba, 48, 48));
  await fs.writeFile(path.join(projectRoot, 'brief-do-usuario.md'), '# direção de arte\n\nneon roxo, silhueta alta.\n', 'utf8');
  const beforeBytes = {
    legacyAssets: await fs.readFile(path.join(legacyStore, 'assets.json'), 'utf8'),
    liaManifest: await fs.readFile(path.join(projectRoot, '.lia.json'), 'utf8'),
    brief: await fs.readFile(path.join(projectRoot, 'brief-do-usuario.md'), 'utf8'),
  };

  const third = await ensureProjectStructure(projectRoot);
  check(third.created.length === 0, 'abrir um projeto que já tem conteúdo não cria nada novo');
  check(third.preserved.some((item) => item.path === '.lia.json'), 'o manifesto .lia.json é listado como preservado');
  check(third.preserved.some((item) => item.path === '.spriteforge'), 'o store legado .spriteforge/ é listado como preservado');
  check(third.preserved.some((item) => item.path === '.spriteforge/assets.json'), 'o arquivo do store legado é listado como preservado');
  check((await fs.readFile(path.join(legacyStore, 'assets.json'), 'utf8')) === beforeBytes.legacyAssets, '.spriteforge/assets.json sobrevive byte a byte');
  check((await fs.readFile(path.join(projectRoot, '.lia.json'), 'utf8')) === beforeBytes.liaManifest, '.lia.json sobrevive byte a byte');
  check((await fs.readFile(path.join(projectRoot, 'brief-do-usuario.md'), 'utf8')) === beforeBytes.brief, 'arquivo do usuário que não é do produto também não é tocado');

  const inspected = await inspectProjectStructure(projectRoot);
  check(inspected.exists && inspected.writable, 'projeto existente e gravável');
  check(inspected.counts.inputs === 1, `entrada do usuário contada (${inspected.counts.inputs})`);
  check(inspected.files.liaManifest.exists && inspected.files.liaManifest.bytes === Buffer.byteLength(beforeBytes.liaManifest),
    'o manifesto é detectado com o tamanho real');
  check(inspected.directories.legacyState.exists, 'o diretório legado é detectado');
  check(inspected.name === 'Meu Jogo', `o nome do projeto é o nome da pasta (${inspected.name})`);

  // --------------------------------------------- 4. o serviço informa o mesmo
  const service = createStudioService({ projectRoot });
  const info = await service.projectInfo();
  check(info.root === path.resolve(projectRoot), 'o serviço informa a raiz real do projeto');
  check(info.counts.inputs === 1 && info.counts.runs === 0, `contagens do serviço (${info.counts.inputs} entrada, ${info.counts.runs} runs)`);
  check(info.legacy.spriteforge === true && info.legacy.liaManifest === true, 'o serviço detecta o conteúdo legado');
  check(/preservado/.test(info.legacy.note), 'o serviço diz que o conteúdo legado é preservado');
  check(info.activeRuns === 0, 'nenhuma execução em andamento neste processo');

  const inputs = await service.listInputs();
  check(inputs.entries.length === 1 && inputs.entries[0].kind === 'image', 'a entrada do usuário aparece na lista do Studio');

  // ------------------------------------------------------- 5. raízes inválidas
  const asFile = path.join(baseDirectory, 'arquivo.txt');
  await fs.writeFile(asFile, 'não sou pasta', 'utf8');
  await assert.rejects(() => ensureProjectStructure(asFile), /não é uma pasta/, 'arquivo como raiz é recusado');
  const link = path.join(baseDirectory, 'atalho');
  await fs.symlink(projectRoot, link);
  await assert.rejects(() => ensureProjectStructure(link), /symlink/, 'symlink como raiz é recusado (a pasta real é que vale)');
  await assert.rejects(() => ensureProjectStructure(''), /inválida/, 'raiz vazia é recusada (não vira o diretório atual)');
  await assert.rejects(() => inspectProjectStructure('   '), /inválida/, 'leitura também recusa raiz vazia');
  const repositoryFiles = await fs.readdir(path.resolve('..'));
  check(!repositoryFiles.includes('input'), 'nenhuma pasta de projeto foi criada fora do caminho informado');

  console.log('Project structure smoke test passed (criação mínima de input/ e .lia-forge/runs/, .spriteforge/ e .lia.json preservados byte a byte, serviço informando o mesmo estado, raízes inválidas recusadas).');
  for (const finding of findings) console.log(`  · ${finding}`);
} finally {
  await fs.rm(baseDirectory, { recursive: true, force: true });
}
