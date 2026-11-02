#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_ACTIONS = Object.freeze(['idle', 'walk', 'run']);
const EXTERNAL_PROVIDERS = /mixamo|epic|fab|unreal/i;

function normalizeRelativePath(value) {
  return typeof value === 'string' ? value.replace(/\\/g, '/') : '';
}

function actionNameMatches(actualName, expectedName) {
  const actual = String(actualName || '').toLocaleLowerCase('en-US').match(/[a-z0-9]+/g) || [];
  const expected = String(expectedName || '').toLocaleLowerCase('en-US').match(/[a-z0-9]+/g) || [];
  if (expected.length === 0 || actual.length < expected.length) return false;
  for (let start = 0; start <= actual.length - expected.length; start += 1) {
    if (expected.every((token, index) => token === actual[start + index])) return true;
  }
  return false;
}

function getManifestIssues(manifest, subjectId, expectedModelRelativePath = null) {
  const issues = [];
  if (!manifest || manifest.schemaVersion !== 2) {
    return ['manifesto de origem/licença precisa usar schemaVersion 2'];
  }

  const subjects = Array.isArray(manifest.subjects) ? manifest.subjects : [];
  const subject = subjects.find((entry) => entry?.id === subjectId);
  if (!subject) return [`sujeito “${subjectId}” não está cadastrado em manifests/source-license-manifest.json`];

  const license = subject.licenseRecord || {};
  const terms = manifest.termsReview || {};
  const provider = String(subject.provider || '');
  const sourceUrl = subject.sourceUrl || license.sourceUrl;

  if (EXTERNAL_PROVIDERS.test(provider)
    && (terms.status !== 'reviewed_by_user' || terms.currentOfficialTermsVerified !== true)) {
    issues.push('revisão atual dos termos oficiais não foi registrada pelo usuário');
  }
  if (license.status !== 'reviewed_by_user') issues.push('licenseRecord.status precisa ser reviewed_by_user');
  if (license.localRenderingConfirmed !== true) issues.push('localRenderingConfirmed precisa ser true para autorizar este render local');
  if (!String(sourceUrl || '').trim()) issues.push('URL/identificador exato da origem do sujeito não foi registrado');
  if (!String(license.exactTermsUrlReviewed || '').trim()) issues.push('URL exata dos termos ou base de licença revisada não foi registrada');
  if (!String(license.termsReviewDate || '').trim()) issues.push('data da revisão de licença não foi registrada');
  if (!String(subject.sourceVersion || '').trim()) {
    issues.push('sourceVersion não foi registrada; se a origem não publica versão, escreva “not supplied by source”');
  }

  if (/mixamo/i.test(provider)) {
    if (!String(subject.characterTitle || '').trim()) issues.push('título exato do personagem Mixamo não foi registrado');
    if (!String(subject.downloadFormatActuallyShown || '').trim()) issues.push('formato realmente exibido/escolhido no download não foi registrado');
  }
  if (/epic|fab|unreal/i.test(provider)) {
    if (!String(subject.characterTitle || '').trim()) issues.push('título exato da listagem/asset Unreal não foi registrado');
    if (!String(subject.downloadFormatActuallyShown || '').trim()) issues.push('formato realmente obtido/exportado não foi registrado');
  }

  const files = Array.isArray(subject.files) ? subject.files : [];
  const modelFile = files.find((file) => file?.role === 'consolidated-blend');
  if (!modelFile) {
    issues.push('registro do arquivo consolidated-blend está ausente');
  } else {
    const recordedPath = normalizeRelativePath(modelFile.path);
    if (expectedModelRelativePath && recordedPath !== normalizeRelativePath(expectedModelRelativePath)) {
      issues.push(`path do combined.blend no manifesto deve ser ${expectedModelRelativePath}`);
    }
    if (modelFile.status !== 'provided') issues.push('status do combined.blend no manifesto precisa ser provided');
  }

  const mappings = Array.isArray(subject.actionMapping) ? subject.actionMapping : [];
  for (const action of REQUIRED_ACTIONS) {
    const entries = mappings.filter((entry) => entry?.rendererAction === action);
    if (entries.length !== 1) {
      issues.push(`deve haver exatamente um registro para a action ${action}`);
      continue;
    }
    const mapping = entries[0];
    if (!String(mapping.sourceClipTitle || '').trim()) issues.push(`título real do clip de origem ${action} não foi registrado`);
    if (!String(mapping.sourceFilePath || '').trim()) issues.push(`arquivo de origem do clip ${action} não foi registrado`);
    const normalizedSourcePath = normalizeRelativePath(mapping.sourceFilePath);
    if (normalizedSourcePath && (!normalizedSourcePath.startsWith('assets/') || normalizedSourcePath.split('/').includes('..'))) {
      issues.push(`sourceFilePath de ${action} precisa ser relativo e permanecer sob assets/`);
    }
    if (!String(mapping.blenderActionName || '').trim()) issues.push(`nome real da action no Blender para ${action} não foi registrado`);
    else if (!actionNameMatches(mapping.blenderActionName, action)) {
      issues.push(`blenderActionName ${JSON.stringify(mapping.blenderActionName)} não corresponde ao token ${action} do renderer atual`);
    }
    if (mapping.confirmedByUser !== true) issues.push(`mapeamento ${action} precisa de confirmedByUser: true após inspecionar o clip real`);
  }

  return issues;
}

function readManifest(manifestPath = path.join(__dirname, '..', 'manifests', 'source-license-manifest.json')) {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function main(argv = process.argv.slice(2)) {
  const [subjectId] = argv;
  if (!subjectId) {
    console.error('Uso: node local-renderer-test/scripts/check-source-license.cjs <subject-id>');
    return 2;
  }

  let manifest;
  try {
    manifest = readManifest();
  } catch (error) {
    console.error(`Não foi possível ler o manifesto de procedência: ${error.message}`);
    return 2;
  }

  const issues = getManifestIssues(manifest, subjectId);
  if (issues.length) {
    console.error(`Render bloqueado para ${subjectId}; procedência/licença incompleta (sem decisão jurídica automática):`);
    for (const issue of issues) console.error(`- ${issue}`);
    return 1;
  }
  console.log(`Registro de procedência preenchido para ${subjectId}. Esta checagem lê apenas declarações do manifesto; não consulta nem interpreta termos jurídicos.`);
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { REQUIRED_ACTIONS, actionNameMatches, getManifestIssues, normalizeRelativePath, readManifest };
