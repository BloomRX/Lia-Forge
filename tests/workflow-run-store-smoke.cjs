const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { listWorkflowRuns, persistWorkflowRun, readWorkflowRun } = require('../electron/workflow-run-store.cjs');

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-forge-run-store-'));
  assert.deepEqual(await listWorkflowRuns(root), []);

  const run = {
    id: randomUUID(),
    workflowId: 'store-smoke',
    assetId: 'asset-one',
    status: 'failed',
    progress: 50,
    createdAt: '2026-10-28T12:00:00.000Z',
    updatedAt: '2026-10-28T12:01:00.000Z',
    resumeFrom: 'render',
    steps: [{ id: 'model', status: 'validated' }, { id: 'render', status: 'failed' }],
  };
  await persistWorkflowRun(root, run);
  assert.deepEqual(await readWorkflowRun(root, run.id), run);
  assert.deepEqual(await listWorkflowRuns(root), [{
    id: run.id,
    workflowId: run.workflowId,
    assetId: run.assetId,
    status: run.status,
    progress: run.progress,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    resumeFrom: run.resumeFrom,
    error: null,
  }]);

  await assert.rejects(readWorkflowRun(root, '../../escape'), /ID da execução inválido/);
  await assert.rejects(persistWorkflowRun(root, { ...run, id: 'not-a-uuid' }), /ID da execução inválido/);
  console.log('Workflow run store smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
