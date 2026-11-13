/**
 * Roteiro de produção do Lia Forge — a jornada de 12 passos entre abrir a pasta
 * do projeto e guardar o resultado no inventário.
 *
 * Fica em `shared/` de propósito: é lógica pura, sem React e sem módulo do Node,
 * então a interface (navegador), os testes em Node e qualquer consumidor futuro
 * (CLI, Electron) derivam o roteiro do **mesmo** lugar — sem duas versões que
 * possam divergir.
 *
 * Regra dura: cada estado é derivado de dados reais. Um passo só aparece como
 * `done` quando existe o artefato, a decisão ou o registro que o comprova. O que
 * só uma pessoa pode fazer (instalar ferramenta, autorizar envio, importar na
 * engine) é marcado como `human` e nunca como concluído.
 *
 * Estados: `done` (há evidência) · `now` (é o próximo passo do usuário) ·
 * `human` (só o usuário decide) · `optional` (não é necessário neste objetivo) ·
 * `todo` (ainda não chegou a vez).
 */
export function buildJourneySteps({
  project = null,
  inputs = [],
  requiresInput = false,
  workflowId = null,
  brief = '',
  destination = null,
  plan = null,
  preflight = null,
  run = null,
  liveRun = null,
  comparison = null,
  exportResult = null,
  registeredVersion = null,
  assets = [],
} = {}) {
  const entries = inputs ?? [];
  const hasProject = Boolean(project?.exists) && project?.writable !== false;
  const blockedSteps = plan?.blockedSteps ?? [];
  const pendingInputs = plan?.pendingInputs ?? [];
  const needsPrompt = pendingInputs.some((item) => item.kind === 'prompt' || item.requiresParam === 'prompt');
  const finished = Boolean(run?.summary?.finished);
  const storedAsset = (assets ?? []).some((asset) => (asset.versions?.length ?? 0) > 0 || (asset.provenance?.length ?? 0) > 0);
  const verifiedOnDestination = exportResult?.bundle?.verifiedOnDestination === true;

  const steps = [
    {
      id: 'project',
      title: 'Abrir a pasta do projeto',
      state: hasProject ? 'done' : 'now',
      detail: hasProject ? project.root : 'Nenhuma pasta gravável aberta: sem ela nada pode ser gravado.',
    },
    {
      id: 'references',
      title: 'Enviar referências e modelos',
      state: entries.length ? 'done' : requiresInput ? 'now' : 'todo',
      detail: entries.length
        ? `${entries.length} arquivo(s) em input/, medidos antes de entrar no pipeline.`
        : requiresInput
          ? 'Este objetivo precisa de uma imagem ou modelo seu em input/.'
          : 'Opcional para este objetivo; quando houver, o arquivo é copiado e verificado.',
    },
    {
      id: 'objective',
      title: 'Escolher o objetivo',
      state: plan || run ? 'done' : hasProject ? 'now' : 'todo',
      detail: plan || run ? `Objetivo planejado: ${workflowId ?? 'workflow'}.` : 'Escolha o que você quer criar; o catálogo diz o que existe nesta máquina.',
    },
    {
      id: 'brief',
      title: 'Descrever em uma frase',
      state: String(brief ?? '').trim().length >= 3 ? 'done' : needsPrompt ? 'now' : 'todo',
      detail: String(brief ?? '').trim().length >= 3
        ? 'Sua descrição é a entrada de texto dos passos de conceito.'
        : needsPrompt
          ? 'O plano pediu o texto: sem ele o passo de geração não começa.'
          : 'Uma frase curta já basta para dar direção ao plano.',
    },
    {
      id: 'requirements',
      title: 'Conferir requisitos e ferramentas',
      state: blockedSteps.length ? 'human' : plan || run ? 'done' : 'todo',
      detail: blockedSteps.length
        ? `${blockedSteps.length} passo(s) sem provider aqui: ${blockedSteps[0].reason ?? blockedSteps[0].id}. Instalar ou autorizar é decisão sua.`
        : preflight?.canStart === false
          ? 'Há capacidades sem provider nesta máquina; o plano diz quais e o que só você pode decidir.'
          : 'O que o plano usa existe e está pronto nesta máquina.',
    },
    {
      id: 'plan',
      title: 'Ler o plano antes de executar',
      state: plan ? 'done' : 'todo',
      detail: plan ? `${plan.steps?.length ?? 0} passo(s), candidatos, licenças e custo visíveis.` : 'Planejar não gasta nada e não toca em ferramenta externa.',
    },
    {
      id: 'execute',
      title: 'Executar',
      state: run ? 'done' : plan ? 'now' : 'todo',
      detail: run ? `Run ${run.runId}.` : 'Executar só começa com o plano na tela.',
    },
    {
      id: 'follow',
      title: 'Acompanhar (ou cancelar)',
      state: liveRun ? 'now' : finished ? 'done' : run ? 'now' : 'todo',
      detail: liveRun
        ? 'Execução em andamento: o progresso é gravado a cada passo e pode ser cancelado.'
        : finished
          ? 'Run encerrado e gravado em .lia-forge/runs/.'
          : 'Durante a execução dá para ver o passo atual e cancelar sem perder o que já foi feito.',
    },
    {
      id: 'review',
      title: 'Revisar os artefatos',
      state: run?.status === 'blocked' ? 'now' : run && finished ? 'done' : 'todo',
      detail: run?.status === 'blocked'
        ? 'Um passo parou de propósito esperando o seu olhar; a aprovação fica amarrada ao SHA-256 do arquivo.'
        : run && finished
          ? 'Revisões gravadas com o hash dos artefatos.'
          : 'Revisão humana é gate: nenhum arquivo é entregue como pronto sem ela.',
    },
    {
      id: 'compare',
      title: 'Comparar variações',
      state: comparison ? 'done' : 'optional',
      detail: comparison
        ? `${comparison.entries?.length ?? 0} artefato(s) medidos lado a lado; o Comparison Lab mede e você decide qual versão guardar.`
        : 'Opcional: o Comparison Lab mostra as métricas e você decide qual versão guardar.',
    },
    {
      id: 'export',
      title: `Exportar para ${destination ?? 'o destino'}`,
      state: exportResult ? 'done' : run?.status === 'succeeded' ? 'now' : 'todo',
      detail: exportResult
        ? `${exportResult.bundle?.files?.length ?? 0} arquivo(s) no pacote; verificado no destino: ${verifiedOnDestination ? 'sim' : 'não'}.`
        : 'A exportação libera quando o run conclui; o pacote confere com o perfil publicado do destino.',
    },
    {
      id: 'keep',
      title: 'Guardar no projeto',
      state: registeredVersion || storedAsset ? 'done' : exportResult ? 'now' : 'todo',
      detail: registeredVersion
        ? `Versão ${registeredVersion.version ?? 'nova'} registrada no asset "${registeredVersion.assetId}".`
        : storedAsset
          ? 'Há asset com versões ou proveniência no inventário do projeto.'
          : 'Guardar registra artefatos, origem e direitos — sem isso o resultado se perde entre runs.',
    },
  ];

  return steps.map((step, position) => ({ ...step, index: position + 1 }));
}

/**
 * Resumo do roteiro para quem não quer percorrer os 12 itens: quantos passos têm
 * evidência, qual é o próximo e quantos dependem só do usuário. Usado pelo painel
 * da interface e pelos testes — os dois leem o mesmo cálculo.
 */
export function journeyProgress(steps = []) {
  const list = steps ?? [];
  const done = list.filter((step) => step.state === 'done').length;
  const human = list.filter((step) => step.state === 'human');
  const next = list.find((step) => step.state === 'now') ?? null;
  return {
    total: list.length,
    done,
    percent: list.length ? Math.round((done / list.length) * 100) : 0,
    next: next ? { index: next.index, id: next.id, title: next.title } : null,
    humanDecisions: human.map((step) => ({ index: step.index, id: step.id, title: step.title, detail: step.detail })),
  };
}
