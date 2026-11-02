#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { findExternalTool } = require('../../electron/external-tools.cjs');
const { getManifestIssues, readManifest } = require('./check-source-license.cjs');

const BUILTIN_SUBJECTS = Object.freeze([
  'mixamo-male',
  'mixamo-female',
  'unreal-manny',
  'unreal-quinn',
]);
const SUBJECT_SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const ACTIONS = Object.freeze(['idle', 'walk', 'run']);
const FRAME_SIZE = Object.freeze({ width: 48, height: 48 });
const REPO_ROOT = path.resolve(__dirname, '../..');
const LOCAL_ROOT = path.resolve(__dirname, '..');

function resolveSubject(subjectSlug, localRoot = LOCAL_ROOT, pathApi = path) {
  if (typeof subjectSlug !== 'string' || !SUBJECT_SLUG.test(subjectSlug)) {
    throw new Error('O sujeito precisa ser um slug simples (letras, números, ponto, hífen ou sublinhado; sem separadores de caminho).');
  }
  const isBuiltin = BUILTIN_SUBJECTS.includes(subjectSlug);
  const subjectId = isBuiltin ? subjectSlug : `custom-${subjectSlug}`;
  const relativeDirectory = isBuiltin ? subjectSlug : pathApi.join('custom', subjectSlug);
  const relativeDirectoryParts = relativeDirectory.split(/[\\/]+/).filter(Boolean);
  const modelRelativePath = `assets/${relativeDirectoryParts.join('/')}/combined.blend`;
  const modelPath = pathApi.resolve(localRoot, 'assets', ...relativeDirectoryParts, 'combined.blend');
  return {
    requestedSlug: subjectSlug,
    id: subjectId,
    assetName: subjectId,
    relativeDirectory: relativeDirectoryParts.join('/'),
    modelRelativePath,
    modelPath,
  };
}

function buildBlenderArguments({ rendererScriptPath, modelPath, outputDirectory, assetName }) {
  for (const [key, value] of Object.entries({ rendererScriptPath, modelPath, outputDirectory, assetName })) {
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`Argumento de Blender ausente: ${key}`);
  }
  return [
    '--background',
    '--python', rendererScriptPath,
    '--',
    '--input', modelPath,
    '--output-dir', outputDirectory,
    '--asset-name', assetName,
    '--asset-type', 'character',
    '--frame-width', String(FRAME_SIZE.width),
    '--frame-height', String(FRAME_SIZE.height),
    '--animations-json', JSON.stringify(ACTIONS),
  ];
}

function makeRunDirectoryName(subjectId, date = new Date(), uniqueId = crypto.randomUUID()) {
  const safeSubject = String(subjectId).replace(/[^A-Za-z0-9._-]/g, '-');
  const timestamp = date.toISOString().replace(/[:.]/g, '-');
  const suffix = String(uniqueId).replace(/[^A-Za-z0-9]/g, '').slice(0, 10) || crypto.randomBytes(5).toString('hex');
  return `${safeSubject}-${timestamp}-${suffix}`;
}

function createUniqueOutputDirectory(outputRoot, subjectId, options = {}) {
  const date = options.date || new Date();
  const makeId = options.makeId || crypto.randomUUID;
  fs.mkdirSync(outputRoot, { recursive: true });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const directoryName = makeRunDirectoryName(subjectId, date, makeId());
    const candidate = path.join(outputRoot, directoryName);
    try {
      fs.mkdirSync(candidate, { recursive: false });
      return candidate;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('Não foi possível reservar um diretório de saída único; nenhuma saída anterior foi sobrescrita.');
}

function sha256File(filePath) {
  const digest = crypto.createHash('sha256');
  const descriptor = fs.openSync(filePath, 'r');
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, chunk, 0, chunk.length, null);
      if (bytesRead > 0) digest.update(chunk.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return digest.digest('hex');
}

function inspectPreflight({ subject, manifest, localRoot = LOCAL_ROOT, blenderExecutable = null, blenderVersion = null }) {
  const issues = getManifestIssues(manifest, subject.id, subject.modelRelativePath);
  let modelStat = null;
  try {
    modelStat = fs.statSync(subject.modelPath);
    if (!modelStat.isFile()) issues.push(`Entrada não é um arquivo: ${subject.modelPath}`);
    else if (modelStat.size === 0) issues.push(`Arquivo de entrada está vazio: ${subject.modelPath}`);
  } catch {
    issues.push(`Arquivo ausente: ${subject.modelPath}`);
  }

  const subjectRecord = Array.isArray(manifest?.subjects)
    ? manifest.subjects.find((entry) => entry?.id === subject.id)
    : null;
  const modelRecord = subjectRecord?.files?.find((entry) => entry?.role === 'consolidated-blend');
  let modelSha256 = null;
  if (modelStat?.isFile() && modelStat.size > 0 && modelRecord) {
    modelSha256 = sha256File(subject.modelPath);
    if (Number.isSafeInteger(modelRecord.sizeBytes) && modelRecord.sizeBytes !== modelStat.size) {
      issues.push('Tamanho do combined.blend difere do sizeBytes registrado no manifesto.');
    }
    if (typeof modelRecord.sha256 === 'string' && modelRecord.sha256.trim()
      && modelSha256.toLowerCase() !== modelRecord.sha256.trim().toLowerCase()) {
      issues.push('SHA-256 do combined.blend difere do hash registrado no manifesto.');
    }
  }
  if (!blenderExecutable) issues.push('Blender não foi encontrado pelo helper do projeto (PATH/instalações Steam conhecidas).');
  if (blenderVersion && !blenderVersion.ok) issues.push(`Blender --version falhou: ${blenderVersion.error || blenderVersion.text || 'sem detalhes'}`);

  return {
    ready: issues.length === 0,
    issues,
    modelStat: modelStat?.isFile() ? modelStat : null,
    modelSha256,
    subjectRecord,
    modelRecord,
    blenderExecutable,
    blenderVersion,
    localRoot,
  };
}

function queryBlenderVersion(executable) {
  const result = spawnSync(executable, ['--version'], {
    encoding: 'utf8',
    timeout: 20000,
    windowsHide: true,
    shell: false,
  });
  const text = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (result.error) return { ok: false, text, error: result.error.message, status: result.status };
  if (result.status !== 0 || !text) {
    return { ok: false, text, error: `exit code ${result.status ?? 'unknown'}`, status: result.status };
  }
  return { ok: true, text, error: null, status: result.status };
}

function printPreflight({ subject, preflight, checkOnly }) {
  console.log(`Sujeito: ${subject.id}`);
  console.log(`combined.blend: ${preflight.modelStat ? `${preflight.modelStat.size} bytes em ${subject.modelRelativePath}` : `ausente em ${subject.modelRelativePath}`}`);
  if (preflight.blenderExecutable) {
    console.log(`Blender: ${preflight.blenderExecutable}`);
    if (preflight.blenderVersion?.text) console.log(`Versão: ${preflight.blenderVersion.text.split(/\r?\n/)[0]}`);
  } else {
    console.log('Blender: não detectado');
  }
  if (preflight.issues.length) {
    console.log('Estado: BLOQUEADO');
    for (const issue of preflight.issues) console.log(`- ${issue}`);
  } else {
    console.log(checkOnly ? 'Estado: PRONTO PARA A EXECUÇÃO REAL (nenhum render foi iniciado).' : 'Estado: pronto para executar.');
  }
}

function streamBlender(executable, args, cwd, logPath) {
  return new Promise((resolve, reject) => {
    const log = fs.createWriteStream(logPath, { flags: 'wx' });
    let logError = null;
    let spawnError = null;
    log.once('error', (error) => { logError = error; });
    let child;
    try {
      child = spawn(executable, args, {
        cwd,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      log.end();
      reject(error);
      return;
    }
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      log.write('[stdout] ');
      log.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      log.write('[stderr] ');
      log.write(chunk);
    });
    child.once('error', (error) => { spawnError = error; });
    child.once('close', (code, signal) => {
      log.end(() => {
        if (logError) reject(logError);
        else if (spawnError) reject(spawnError);
        else resolve({ code, signal });
      });
    });
  });
}

function makeRunProvenance({ subject, preflight, blenderVersion, outputDirectory, status, error = null }) {
  const record = preflight.subjectRecord || {};
  const license = record.licenseRecord || {};
  const stats = preflight.modelStat;
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status,
    visualReview: 'required',
    subject: {
      id: subject.id,
      provider: record.provider || null,
      title: record.characterTitle || null,
      sourceUrl: record.sourceUrl || license.sourceUrl || null,
      sourceVersion: record.sourceVersion || null,
      sourceFormat: record.sourceFormat || record.downloadFormatActuallyShown || null,
    },
    license: {
      status: license.status || 'pending',
      termsUrlReviewed: license.exactTermsUrlReviewed || null,
      termsReviewDate: license.termsReviewDate || null,
      localRenderingConfirmed: license.localRenderingConfirmed === true,
      commercialRightsConfirmed: license.commercialRightsConfirmed ?? null,
      redistributionRightsConfirmed: license.redistributionRightsConfirmed ?? null,
    },
    input: {
      relativePath: subject.modelRelativePath,
      sizeBytes: stats?.size ?? null,
      sha256: preflight.modelSha256 || null,
      sourceVersion: preflight.modelRecord?.sourceVersion || null,
    },
    animations: Array.isArray(record.actionMapping) ? record.actionMapping.map((entry) => ({ ...entry })) : [],
    renderer: {
      inputCount: 1,
      script: 'scripts/blender_spritesheet.py',
      blenderExecutableName: preflight.blenderExecutable ? path.basename(preflight.blenderExecutable) : null,
      blenderVersion: blenderVersion?.text || null,
      frameSize: FRAME_SIZE,
      actionOrder: ACTIONS,
    },
    outputDirectory: path.relative(LOCAL_ROOT, outputDirectory).replace(/\\/g, '/'),
    outputFiles: ['spritesheet.png', 'spritesheet.json', 'validation-report.json', 'validation.log', 'run-provenance.json', 'blender.log', 'blender-version.txt'],
    error,
  };
}

function writeRunProvenance(outputDirectory, provenance) {
  const filePath = path.join(outputDirectory, 'run-provenance.json');
  fs.writeFileSync(filePath, `${JSON.stringify(provenance, null, 2)}\n`, { flag: 'wx' });
  return filePath;
}

function parseArguments(argv) {
  let subject = null;
  let checkOnly = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--subject') {
      subject = argv[index + 1] || null;
      index += 1;
    } else if (argument === '--check-only') {
      checkOnly = true;
    } else if (argument === '--help' || argument === '-h') {
      return { help: true, subject, checkOnly };
    } else {
      throw new Error(`Argumento desconhecido: ${argument}`);
    }
  }
  if (!subject) throw new Error('Informe --subject <nome>.');
  return { help: false, subject, checkOnly };
}

function printHelp() {
  console.log('Uso: node local-renderer-test/scripts/run-render.cjs --subject <mixamo-male|mixamo-female|unreal-manny|unreal-quinn|slug-custom> [--check-only]');
  console.log('Slug não reservado vira custom-<slug> e usa assets/custom/<slug>/combined.blend.');
}

async function execute(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    console.error(error.message);
    printHelp();
    return 2;
  }
  if (options.help) {
    printHelp();
    return 0;
  }

  let subject;
  try {
    subject = resolveSubject(options.subject);
  } catch (error) {
    console.error(error.message);
    return 2;
  }

  let manifest;
  try {
    manifest = readManifest(path.join(LOCAL_ROOT, 'manifests', 'source-license-manifest.json'));
  } catch (error) {
    console.error(`Não foi possível ler manifests/source-license-manifest.json: ${error.message}`);
    return 2;
  }

  const blenderExecutable = findExternalTool('blender');
  let blenderVersion = null;
  const initial = inspectPreflight({ subject, manifest, localRoot: LOCAL_ROOT, blenderExecutable });
  if (options.checkOnly && blenderExecutable) blenderVersion = queryBlenderVersion(blenderExecutable);
  else if (initial.issues.length === 0 && blenderExecutable) blenderVersion = queryBlenderVersion(blenderExecutable);
  const preflight = inspectPreflight({ subject, manifest, localRoot: LOCAL_ROOT, blenderExecutable, blenderVersion });
  printPreflight({ subject, preflight, checkOnly: options.checkOnly });

  if (options.checkOnly) return 0;
  if (!preflight.ready) return 1;

  const rendererScriptPath = path.join(REPO_ROOT, 'scripts', 'blender_spritesheet.py');
  if (!fs.existsSync(rendererScriptPath)) {
    console.error(`Renderer ausente no checkout: ${rendererScriptPath}`);
    return 1;
  }

  const outputRoot = path.join(LOCAL_ROOT, 'output');
  let outputDirectory;
  try {
    outputDirectory = createUniqueOutputDirectory(outputRoot, subject.id);
    fs.writeFileSync(path.join(outputDirectory, 'blender-version.txt'), `${blenderVersion.text}\n`, { flag: 'wx' });
  } catch (error) {
    console.error(`Não foi possível preparar um diretório de saída sem sobrescrever resultados: ${error.message}`);
    return 1;
  }

  let status = 'render_failed';
  let failure = null;
  try {
    const args = buildBlenderArguments({
      rendererScriptPath,
      modelPath: subject.modelPath,
      outputDirectory,
      assetName: subject.assetName,
    });
    const result = await streamBlender(blenderExecutable, args, REPO_ROOT, path.join(outputDirectory, 'blender.log'));
    if (result.code !== 0) throw new Error(`Blender encerrou com código ${result.code ?? result.signal ?? 'desconhecido'}. Consulte blender.log.`);
    if (sha256File(subject.modelPath) !== preflight.modelSha256) {
      throw new Error('O combined.blend mudou durante o render; outputs parciais foram preservados, mas não serão aprovados.');
    }

    const verifierPath = path.join(__dirname, 'verify-output.cjs');
    const verify = spawnSync(process.execPath, [verifierPath, outputDirectory, subject.modelPath, blenderExecutable, subject.assetName], {
      encoding: 'utf8',
      windowsHide: true,
      shell: false,
      maxBuffer: 8 * 1024 * 1024,
    });
    const validationLog = `${verify.stdout || ''}${verify.stderr || ''}`;
    fs.writeFileSync(path.join(outputDirectory, 'validation.log'), validationLog, { flag: 'wx' });
    if (verify.stdout) process.stdout.write(verify.stdout);
    if (verify.stderr) process.stderr.write(verify.stderr);
    if (verify.error) throw new Error(`Não foi possível executar o verificador: ${verify.error.message}`);
    if (verify.status !== 0) throw new Error(`Verificação automatizada encerrou com código ${verify.status}; consulte validation.log.`);

    status = 'automated_checks_passed_visual_review_required';
    const provenancePath = writeRunProvenance(outputDirectory, makeRunProvenance({
      subject,
      preflight,
      blenderVersion,
      outputDirectory,
      status,
    }));
    console.log(`Resultados preservados em ${outputDirectory}`);
    console.log(`Abra spritesheet.png e revise visualmente; evidência de procedência: ${provenancePath}`);
    return 0;
  } catch (error) {
    failure = error.message;
    try {
      writeRunProvenance(outputDirectory, makeRunProvenance({
        subject,
        preflight,
        blenderVersion,
        outputDirectory,
        status,
        error: failure,
      }));
    } catch (provenanceError) {
      console.error(`Também não foi possível registrar run-provenance.json: ${provenanceError.message}`);
    }
    console.error(`Execução não aprovada: ${failure}`);
    console.error(`Outputs/logs parciais, se produzidos, foram preservados em ${outputDirectory}`);
    return 1;
  }
}

if (require.main === module) {
  execute().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  ACTIONS,
  BUILTIN_SUBJECTS,
  FRAME_SIZE,
  buildBlenderArguments,
  createUniqueOutputDirectory,
  inspectPreflight,
  makeRunDirectoryName,
  parseArguments,
  resolveSubject,
};
