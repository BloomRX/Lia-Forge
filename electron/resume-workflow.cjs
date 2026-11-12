const RESUMABLE_RUN_STATUSES = new Set(['planned', 'running', 'failed', 'blocked', 'cancelled']);
const RESUMABLE_STEP_STATUSES = new Set(['planned', 'running', 'validated', 'failed', 'blocked', 'cancelled']);

function resumableRunKind(run) {
  if (run?.workflowId !== 'render-spritesheet-from-existing-3d'
    || !RESUMABLE_RUN_STATUSES.has(run.status)
    || run?.plan?.workflowId !== run.workflowId
    || run?.plan?.metadata?.kind !== 'blender-spritesheet'
    || run?.plan?.metadata?.stageIndex !== 4
    || typeof run?.plan?.metadata?.sourceRelative !== 'string'
    || !Array.isArray(run?.plan?.steps) || run.plan.steps.length !== 1
    || !Array.isArray(run.steps) || run.steps.length !== 1) return false;

  const planStep = run.plan.steps[0];
  const savedStep = run.steps[0];
  return planStep?.id === 'render-and-pack'
    && planStep?.adapter === 'blender-spritesheet'
    && savedStep?.id === planStep.id
    && RESUMABLE_STEP_STATUSES.has(savedStep.status)
    && Array.isArray(planStep.inputContracts)
    && planStep.inputContracts.some((contract) => contract?.id === 'model' && contract.kind === 'file')
    && Array.isArray(planStep.outputContracts)
    && planStep.outputContracts.length === 2
    && planStep.outputContracts.some((contract) => contract?.id === 'spritesheet' && contract.validator === 'png-rgba8')
    && planStep.outputContracts.some((contract) => contract?.id === 'spritesheet-metadata' && contract.validator === 'spritesheet-manifest')
    && planStep.execution?.kind === 'process'
    && (!planStep.authorization || planStep.authorization.required !== true);
}

module.exports = { resumableRunKind };
