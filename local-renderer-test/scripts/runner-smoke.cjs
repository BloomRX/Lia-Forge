#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  ACTIONS,
  buildBlenderArguments,
  createUniqueOutputDirectory,
  makeRunDirectoryName,
  parseArguments,
  resolveSubject,
} = require('./run-render.cjs');
const { getManifestIssues, readManifest } = require('./check-source-license.cjs');

function makeReviewedManifest(template, subjectId, modelRelativePath) {
  const manifest = structuredClone(template);
  manifest.termsReview.status = 'reviewed_by_user';
  manifest.termsReview.currentOfficialTermsVerified = true;
  manifest.termsReview.reviewedAt = '2026-11-02';
  const subject = manifest.subjects.find((entry) => entry.id === subjectId);
  subject.sourceUrl = 'https://assets.example.test/character';
  subject.sourceVersion = 'not supplied by source';
  subject.sourceFormat = 'FBX as shown in the user interface';
  subject.characterTitle = 'User-verified sample character';
  subject.downloadFormatActuallyShown = 'FBX Binary, verified by user';
  subject.licenseRecord.status = 'reviewed_by_user';
  subject.licenseRecord.sourceUrl = subject.sourceUrl;
  subject.licenseRecord.exactTermsUrlReviewed = 'https://terms.example.test/current';
  subject.licenseRecord.termsReviewDate = '2026-11-02';
  subject.licenseRecord.localRenderingConfirmed = true;
  const blend = subject.files.find((file) => file.role === 'consolidated-blend');
  blend.path = modelRelativePath;
  blend.status = 'provided';
  subject.actionMapping = ACTIONS.map((rendererAction) => ({
    rendererAction,
    sourceClipTitle: `User-verified ${rendererAction} clip`,
    sourceFilePath: `assets/${subjectId}/source/actions/${rendererAction}.fbx`,
    blenderActionName: rendererAction,
    confirmedByUser: true,
  }));
  return manifest;
}

function run() {
  const fakeWindowsRoot = String.raw`C:\Users\Ána Maria\Lia Forge\local-renderer-test`;
  const male = resolveSubject('mixamo-male', fakeWindowsRoot, path.win32);
  assert.equal(male.id, 'mixamo-male');
  assert.equal(male.modelRelativePath, 'assets/mixamo-male/combined.blend');
  assert.equal(male.modelPath, String.raw`C:\Users\Ána Maria\Lia Forge\local-renderer-test\assets\mixamo-male\combined.blend`);

  const custom = resolveSubject('RoboV2', fakeWindowsRoot, path.win32);
  assert.equal(custom.id, 'custom-RoboV2');
  assert.equal(custom.modelRelativePath, 'assets/custom/RoboV2/combined.blend');
  assert.equal(custom.modelPath, String.raw`C:\Users\Ána Maria\Lia Forge\local-renderer-test\assets\custom\RoboV2\combined.blend`);
  assert.throws(() => resolveSubject('../escape', fakeWindowsRoot, path.win32), /slug simples/);

  const inputPath = String.raw`C:\Users\Ána Maria\Projeto com espaços\combined.blend`;
  const scriptPath = String.raw`C:\Users\Ána Maria\Repo Lia\scripts\blender_spritesheet.py`;
  const outputPath = String.raw`C:\Users\Ána Maria\Repo Lia\local-renderer-test\output\run 01`;
  const args = buildBlenderArguments({
    rendererScriptPath: scriptPath,
    modelPath: inputPath,
    outputDirectory: outputPath,
    assetName: 'mixamo-male',
  });
  assert.equal(args.filter((value) => value === '--input').length, 1);
  assert.equal(args[args.indexOf('--input') + 1], inputPath);
  assert.equal(args[args.indexOf('--python') + 1], scriptPath);
  assert.equal(args[args.indexOf('--output-dir') + 1], outputPath);
  assert.equal(args[args.indexOf('--animations-json') + 1], '["idle","walk","run"]');

  const fixedDate = new Date('2026-11-02T12:34:56.789Z');
  const firstRunName = makeRunDirectoryName('mixamo-male', fixedDate, 'run-a-123');
  const secondRunName = makeRunDirectoryName('mixamo-male', fixedDate, 'run-b-456');
  assert.notEqual(firstRunName, secondRunName);
  assert.match(firstRunName, /^mixamo-male-2026-11-02T12-34-56-789Z-/);
  assert.throws(() => resolveSubject(parseArguments(['--subject', '../unsafe']).subject, fakeWindowsRoot, path.win32), /slug simples/);
  assert.deepEqual(parseArguments(['--subject', 'mixamo-female', '--check-only']), {
    help: false,
    subject: 'mixamo-female',
    checkOnly: true,
  });

  const manifestPath = path.join(__dirname, '..', 'manifests', 'source-license-manifest.json');
  const template = readManifest(manifestPath);
  assert.equal(template.schemaVersion, 2);
  const original = JSON.stringify(template);
  const defaultIssues = getManifestIssues(template, 'mixamo-male', 'assets/mixamo-male/combined.blend');
  assert.ok(defaultIssues.some((issue) => issue.includes('termos oficiais')));
  assert.ok(defaultIssues.some((issue) => issue.includes('localRenderingConfirmed')));
  assert.equal(JSON.stringify(template), original, 'a validação do manifesto não deve alterá-lo');

  const reviewed = makeReviewedManifest(template, 'mixamo-male', 'assets/mixamo-male/combined.blend');
  assert.deepEqual(getManifestIssues(reviewed, 'mixamo-male', 'assets/mixamo-male/combined.blend'), []);
  assert.ok(getManifestIssues(reviewed, 'mixamo-male', 'assets/mixamo-female/combined.blend')
    .some((issue) => issue.includes('path do combined.blend')));

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lia-renderer-runner-smoke-'));
  try {
    const ids = ['same-id', 'same-id', 'new-id'];
    const nextId = () => ids.shift();
    const firstDirectory = createUniqueOutputDirectory(tempRoot, 'mixamo-male', { date: fixedDate, makeId: nextId });
    fs.writeFileSync(path.join(firstDirectory, 'keep.txt'), 'preserve');
    const secondDirectory = createUniqueOutputDirectory(tempRoot, 'mixamo-male', { date: fixedDate, makeId: nextId });
    assert.notEqual(firstDirectory, secondDirectory);
    assert.equal(fs.readFileSync(path.join(firstDirectory, 'keep.txt'), 'utf8'), 'preserve');
    assert.ok(fs.statSync(secondDirectory).isDirectory());
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log('local renderer runner smoke passed (sem Blender, sem assets e sem render).');
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
