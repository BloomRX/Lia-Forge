/**
 * Página "Pipeline de Produção" do Lia Forge (F8 — requisitos §3 e §11).
 *
 * Dois públicos na mesma tela, sem dois sistemas:
 *   - quem nunca ouviu falar de Blender ou ComfyUI escolhe um objetivo em
 *     linguagem simples, descreve o que quer e aperta executar; o que não pode
 *     ser automatizado aparece como decisão humana explícita;
 *   - quem quer auditar abre o plano e vê adapter, candidatos com estado real,
 *     requisitos, custo, licença, gates, logs, proveniência e SHA-256.
 *
 * Regra dura: nenhuma ferramenta ausente é apresentada como disponível, e nada
 * aqui instala, baixa, compra ou envia dados.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Box,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Clock3,
  Cpu,
  Download,
  Eye,
  FileJson,
  Gauge,
  HardDrive,
  Image as ImageIcon,
  Info,
  Layers3,
  ListChecks,
  Lock,
  Package,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Upload,
  FolderOpen,
  RotateCcw,
  FolderTree,
  Compass,
  CircleDashed,
  UserRound,
  GitCompareArrows,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { liaForgeApi } from './lia-forge-api.js';
// Roteiro de 12 passos: a derivação dos estados mora em shared/ui/journey.mjs
// (lógica pura, sem React), compartilhada com os testes e com o resumo usado aqui.
import { buildJourneySteps, journeyProgress, isResumableRun } from '../shared/ui/journey.mjs';

// Escolha real de backend (§9). Nada aqui instala, baixa, compra ou envia:
// são só as preferências gravadas em `.lia-forge/providers.json`.
const COMFY_MODES = [
  { id: 'local-loopback', label: 'Local (nesta máquina)', hint: 'Fala apenas com 127.0.0.1/localhost: nenhum dado sai do seu computador.' },
  { id: 'remote', label: 'Remoto (worker próprio, GPU alugada ou hosted)', hint: 'Envia o prompt para fora da máquina e pode gerar custo: só funciona com a sua autorização gravada.' },
  { id: 'disabled', label: 'Desativado', hint: 'Nenhum servidor é contatado; os passos de difusão ficam bloqueados com esse motivo.' },
];

const BLENDER_MODES = [
  { id: 'auto', label: 'Detectar automaticamente', hint: 'Procura no PATH e nos locais de instalação conhecidos do seu sistema.' },
  { id: 'path', label: 'Informar o caminho do executável', hint: 'Use quando o Blender estiver instalado em um lugar fora do PATH.' },
  { id: 'disabled', label: 'Desativado', hint: 'Os passos 3D ficam bloqueados com esse motivo.' },
];

const COMFY_WORKFLOWS = [
  { id: '', label: 'Padrão do adapter (concept sheet)' },
  { id: 'character-concept', label: 'Concept sheet · personagem' },
  { id: 'item-concept', label: 'Concept sheet · item' },
];

const STATE_LABELS = {
  ready: 'Pronto',
  unknown: 'Não verificado',
  missing: 'Não detectado',
  blocked: 'Bloqueado',
};

const RUN_STATE_LABELS = {
  pending: 'Na fila',
  ready: 'Pronto',
  running: 'Executando',
  succeeded: 'Concluído',
  failed: 'Falhou',
  skipped: 'Ignorado',
  blocked: 'Aguardando você',
  cancelled: 'Cancelado',
  paused: 'Pausado',
};

const VALIDATION_LABELS = {
  passed: 'aprovado',
  skipped: 'sem entrada para validar',
  failed: 'reprovado',
};

const COST_LABELS = {
  'not-applicable': 'Sem custo externo',
  free: 'Gratuito',
  unknown: 'Custo não verificado',
  paid: 'Pago',
};

/** Transforma o fluxo de eventos + logs do run em linhas legíveis e ordenadas. */
function timelineFor(run) {
  const events = (run?.events ?? []).map((event) => ({
    at: event.at,
    kind: event.type,
    level: event.type.includes('failed') || event.type.includes('blocked') ? 'error' : event.type.includes('retry') || event.type.includes('invalidated') ? 'warn' : 'info',
    text: event.message
      ?? (event.type === 'step-started'
        ? `Passo "${event.stepId}" iniciou com o adapter ${event.adapter ?? '—'} (tentativa ${event.attempt ?? 1}).`
        : event.type === 'step-progress'
          ? `Progresso em "${event.stepId}": ${event.percent ?? event.progress ?? 0}%${event.stage ? ` · ${event.stage}` : ''}${event.animation ? ` · ${event.animation}` : ''}`
          : event.type === 'run-started'
            ? `Run iniciado: ${event.steps ?? 0} passo(s)${event.resume ? ' (retomada de checkpoint)' : ''}.`
            : event.type === 'run-finished'
              ? `Run encerrado com status "${run?.status ?? '?'}" e ${run?.summary?.progress ?? 0}% de progresso.`
              : event.type),
  }));
  const logs = (run?.logs ?? []).map((entry) => ({
    at: entry.at,
    kind: entry.level,
    level: entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'info',
    text: entry.message,
    details: entry.details,
  }));
  return [...events, ...logs].sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

/**
 * Imagem de um artefato do run. Resolve a fonte de forma assíncrona porque no
 * desktop os bytes chegam por IPC (data URL) e no navegador por URL HTTP.
 */
function RunArtifactImage({ path: relativePath, alt }) {
  const [source, setSource] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setSource(null);
    setFailed(false);
    liaForgeApi.artifactSource(relativePath)
      .then((value) => { if (active) setSource(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [relativePath]);
  if (failed) return <p className="forge-note">Não consegui ler este artefato.</p>;
  if (!source) return <div className="forge-artifact-loading"><span className="spin" /></div>;
  return <img src={source} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

function StateBadge({ state, label = null }) {
  const tone = state === 'ready' || state === 'succeeded'
    ? 'is-ready'
    : state === 'blocked' || state === 'failed'
      ? 'is-blocked'
      : state === 'missing'
        ? 'is-missing'
        : 'is-unknown';
  return <span className={`forge-badge ${tone}`}>{label ?? STATE_LABELS[state] ?? RUN_STATE_LABELS[state] ?? state}</span>;
}

function Detail({ summary, children, open = false }) {
  const [expanded, setExpanded] = useState(open);
  return (
    <div className={`forge-detail ${expanded ? 'is-open' : ''}`}>
      <button type="button" className="forge-detail-toggle" onClick={() => setExpanded((value) => !value)}>
        <ChevronRight size={13} strokeWidth={2} />
        <span>{summary}</span>
      </button>
      {expanded ? <div className="forge-detail-body">{children}</div> : null}
    </div>
  );
}

function KeyValue({ label, value, mono = false }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="forge-kv">
      <span>{label}</span>
      <strong className={mono ? 'is-mono' : undefined}>{String(value)}</strong>
    </div>
  );
}

function MachinePanel({ machine, note }) {
  if (!machine) return null;
  return (
    <section className="panel forge-panel">
      <header className="forge-panel-head">
        <Cpu size={15} strokeWidth={1.8} />
        <h2>Esta máquina</h2>
        <span className="forge-panel-tag">medido agora</span>
      </header>
      <div className="forge-kv-grid">
        <KeyValue label="Sistema" value={`${machine.os} ${machine.release ?? ''} (${machine.arch})`} />
        <KeyValue label="CPU" value={`${machine.cpus} núcleo(s)${machine.cpuModel ? ` · ${machine.cpuModel}` : ''}`} />
        <KeyValue label="RAM" value={`${machine.ramMb} MB total · ${machine.freeRamMb} MB livres`} />
        <KeyValue label="Disco livre" value={machine.diskMb === null ? 'não medido' : `${machine.diskMb} MB`} />
        <KeyValue label="Node" value={machine.node} mono />
        <KeyValue label="VRAM" value={machine.vramMb === null ? 'não medida' : `${machine.vramMb} MB`} />
      </div>
      <p className="forge-note">
        <Lock size={13} strokeWidth={1.9} />
        {machine.gpuNote}
      </p>
      {note ? <p className="forge-note">{note}</p> : null}
    </section>
  );
}

/**
 * Providers & backends (§9): onde o usuário escolhe COMO cada ferramenta
 * externa será usada e vê o estado medido agora — nunca uma promessa.
 */
export function ProvidersPanel({ providers, busy, onConfigure }) {
  const comfy = providers?.comfyui ?? null;
  const blender = providers?.blender ?? null;
  const [mode, setMode] = useState(comfy?.mode ?? 'local-loopback');
  const [endpoint, setEndpoint] = useState(comfy?.endpoint ?? '');
  const [checkpoint, setCheckpoint] = useState(comfy?.checkpoint ?? '');
  const [templateId, setTemplateId] = useState(comfy?.workflowId ?? '');
  const [granted, setGranted] = useState(comfy?.authorization?.granted === true);
  const [grantedBy, setGrantedBy] = useState(comfy?.authorization?.grantedBy ?? '');
  const [maxCost, setMaxCost] = useState(comfy?.maxCostUnits ?? '');
  const [blenderMode, setBlenderMode] = useState(blender?.mode ?? 'auto');
  const [executable, setExecutable] = useState(blender?.configuredExecutable ?? blender?.executable ?? '');
  const [frameSize, setFrameSize] = useState(blender?.frameSize ?? '48x48');

  // A configuração gravada é a fonte de verdade: sincroniza os campos quando
  // ela muda (outro painel, outra janela, ou uma recusa do serviço).
  useEffect(() => {
    if (!comfy || !blender) return;
    setMode(comfy.mode);
    setEndpoint(comfy.endpoint ?? '');
    setCheckpoint(comfy.checkpoint ?? '');
    setTemplateId(comfy.workflowId ?? '');
    setGranted(comfy.authorization?.granted === true);
    setGrantedBy(comfy.authorization?.grantedBy ?? '');
    setMaxCost(comfy.maxCostUnits ?? '');
    setBlenderMode(blender.mode);
    setExecutable(blender.configuredExecutable ?? blender.executable ?? '');
    setFrameSize(blender.frameSize ?? '48x48');
  }, [providers?.updatedAt, comfy, blender]); // eslint-disable-line react-hooks/exhaustive-deps

  const modeHint = COMFY_MODES.find((item) => item.id === mode)?.hint ?? '';
  const blenderHint = BLENDER_MODES.find((item) => item.id === blenderMode)?.hint ?? '';

  const saveComfy = (event) => {
    event.preventDefault();
    const payload = {
      id: 'comfyui',
      mode,
      endpoint: endpoint.trim() || null,
      checkpoint: checkpoint.trim() || null,
      workflowId: templateId || null,
      maxCostUnits: maxCost === '' || maxCost === null ? null : Number(maxCost),
    };
    if (mode === 'remote') {
      payload.authorization = { granted, grantedBy: grantedBy.trim() || null, scope: 'send_data+cost' };
    }
    onConfigure(payload);
  };

  const saveBlender = (event) => {
    event.preventDefault();
    onConfigure({
      id: 'blender',
      mode: blenderMode,
      executable: blenderMode === 'path' ? (executable.trim() || null) : null,
      frameSize: frameSize.trim() || '48x48',
    });
  };

  return (
    <section className="panel forge-panel">
      <header className="forge-panel-head">
        <Server size={15} strokeWidth={1.8} />
        <h2>Providers &amp; backends</h2>
        <span className="forge-panel-tag">{providers?.updatedAt ? 'configuração gravada' : 'padrão de fábrica'}</span>
      </header>

      <div className="forge-tool-list">
        <article className="forge-tool">
          <header>
            <strong>ComfyUI (difusão 2D)</strong>
            <StateBadge
              state={comfy?.connected ? 'ready' : mode === 'disabled' ? 'unknown' : 'missing'}
              label={comfy?.connected ? 'Conectado' : mode === 'remote' ? (comfy?.authorization?.granted ? 'Remoto autorizado' : 'Remoto sem autorização') : 'Não conectado'}
            />
          </header>
          {comfy?.detail ? <p className="forge-tool-detail">{comfy.detail}</p> : null}
          <form className="forge-form" onSubmit={saveComfy}>
            <label className="is-wide">
              <span>Onde executar</span>
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                {COMFY_MODES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <em className="forge-note">{modeHint}</em>
            </label>
            <label className="is-wide">
              <span>Endpoint</span>
              <input
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                placeholder={mode === 'remote' ? 'https://seu-worker.exemplo (HTTPS, sem credenciais)' : 'http://127.0.0.1:8188'}
                spellCheck={false}
              />
            </label>
            <label>
              <span>Checkpoint já instalado</span>
              <input value={checkpoint} onChange={(event) => setCheckpoint(event.target.value)} placeholder="Ex.: sd_xl_base_1.0.safetensors" spellCheck={false} />
            </label>
            <label>
              <span>Template do workflow</span>
              <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                {COMFY_WORKFLOWS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            {mode === 'remote' ? (
              <div className="forge-authorize is-wide">
                <label className="forge-check">
                  <input type="checkbox" checked={granted} onChange={(event) => setGranted(event.target.checked)} />
                  <span>Autorizo enviar meu prompt a este endpoint e o custo associado</span>
                </label>
                <label>
                  <span>Quem autorizou</span>
                  <input value={grantedBy} onChange={(event) => setGrantedBy(event.target.value)} placeholder="Seu nome" />
                </label>
                <label>
                  <span>Teto de custo (opcional)</span>
                  <input value={maxCost} onChange={(event) => setMaxCost(event.target.value)} inputMode="decimal" placeholder="Ex.: 5" />
                </label>
                <p className="forge-note">
                  Sem esta autorização nada é enviado e nenhum custo é gerado: o passo fica bloqueado com o motivo gravado no run.
                  Credenciais nunca são gravadas aqui — use a referência do seu próprio cofre.
                </p>
              </div>
            ) : null}
            <div className="forge-panel-actions is-wide">
              <button type="submit" className="button button-primary" disabled={busy !== null}>
                {busy === 'provider' ? <span className="spin" /> : <SlidersHorizontal size={14} />} Gravar provider ComfyUI
              </button>
              <KeyValue label="Versão detectada" value={comfy?.version ?? null} />
              <KeyValue label="Fila" value={comfy?.queue ? `${comfy.queue.running} em execução · ${comfy.queue.pending} aguardando` : null} />
            </div>
          </form>
        </article>

        <article className="forge-tool">
          <header>
            <strong>Blender (render 3D → 2D)</strong>
            <StateBadge state={blender?.available ? 'ready' : blenderMode === 'disabled' ? 'unknown' : 'missing'} label={blender?.available ? 'Disponível' : blenderMode === 'disabled' ? 'Desativado por você' : 'Não detectado'} />
          </header>
          {blender?.detail ? <p className="forge-tool-detail">{blender.detail}</p> : null}
          <form className="forge-form" onSubmit={saveBlender}>
            <label className="is-wide">
              <span>Como encontrar</span>
              <select value={blenderMode} onChange={(event) => setBlenderMode(event.target.value)}>
                {BLENDER_MODES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <em className="forge-note">{blenderHint}</em>
            </label>
            {blenderMode === 'path' ? (
              <label className="is-wide">
                <span>Caminho do executável</span>
                <input value={executable} onChange={(event) => setExecutable(event.target.value)} placeholder="/usr/bin/blender · C:\Program Files\Blender Foundation\Blender\blender.exe" spellCheck={false} />
              </label>
            ) : null}
            <label>
              <span>Frame (LARGURAxALTURA)</span>
              <input value={frameSize} onChange={(event) => setFrameSize(event.target.value)} placeholder="48x48" spellCheck={false} />
            </label>
            <div className="forge-panel-actions is-wide">
              <button type="submit" className="button button-primary" disabled={busy !== null}>
                {busy === 'provider' ? <span className="spin" /> : <SlidersHorizontal size={14} />} Gravar provider Blender
              </button>
              <KeyValue label="Executável em uso" value={blender?.executable ?? null} mono />
              <KeyValue label="Script de render" value={blender?.scriptPath ?? null} mono />
            </div>
          </form>
        </article>
      </div>
      <p className="forge-note">
        A Lia Forge não instala, não baixa, não compra e não inicia nada por conta própria. A configuração fica em
        {' '}<code>.lia-forge/providers.json</code> e nunca contém segredo.
      </p>
    </section>
  );
}

function ToolsPanel({ adapters, preflight }) {
  const toolsById = new Map((preflight?.tools ?? []).map((tool) => [tool.adapterId, tool]));
  return (
    <section className="panel forge-panel">
      <header className="forge-panel-head">
        <Terminal size={15} strokeWidth={1.8} />
        <h2>Ferramentas &amp; requisitos</h2>
        <span className="forge-panel-tag">{adapters?.length ?? 0} adapters</span>
      </header>
      <div className="forge-tool-list">
        {(adapters ?? []).map((adapter) => {
          const tool = toolsById.get(adapter.id);
          const state = tool?.state ?? adapter.health?.status ?? 'unknown';
          return (
            <article key={adapter.id} className="forge-tool">
              <header>
                <strong>{adapter.title}</strong>
                <StateBadge state={state} label={STATE_LABELS[state] ?? tool?.detail ?? state} />
              </header>
              <p className="forge-tool-id">
                <code>{adapter.id}</code> · v{adapter.version} · classe {adapter.class}
              </p>
              {tool?.detail ? <p className="forge-tool-detail">{tool.detail}</p> : null}
              <Detail summary="requisitos, custo, licença e evidência">
                <KeyValue label="Executável" value={tool?.executable} mono />
                <KeyValue
                  label="Origem do executável"
                  value={tool?.executableSource === 'user-configuration'
                    ? 'caminho configurado por você (Configurações → Providers)'
                    : tool?.executableSource === 'path' ? 'PATH do sistema' : null}
                />
                <KeyValue
                  label="Versão detectada"
                  value={tool?.versionConfirmed
                    ? tool?.detectedVersion ?? 'confirmada'
                    : tool?.executable
                      ? 'não confirmada — o pré-voo mede existência e permissão de execução, mas não executa o arquivo'
                      : null}
                />
                <KeyValue label="RAM mínima" value={adapter.requirements?.ramMb ? `${adapter.requirements.ramMb} MB` : null} />
                <KeyValue label="Rede" value={adapter.requirements?.network === undefined ? null : adapter.requirements.network ? 'precisa' : 'não precisa'} />
                <KeyValue label="Executa offline" value={adapter.requirements?.offlineCapable ? 'sim' : 'não'} />
                <KeyValue label="Runtime" value={adapter.requirements?.runtime} />
                <KeyValue label="Custo" value={COST_LABELS[adapter.cost?.status] ?? adapter.cost?.status} />
                {adapter.cost?.note ? <p className="forge-note">{adapter.cost.note}</p> : null}
                <KeyValue label="Licença do adapter" value={adapter.provenance?.license} />
                <KeyValue label="Direitos da saída" value={adapter.provenance?.outputRights} />
                <KeyValue label="Evidência" value={adapter.evidence?.state} />
                {adapter.evidence?.note ? <p className="forge-note">{adapter.evidence.note}</p> : null}
                {adapter.evidence?.tests?.length ? (
                  <p className="forge-note is-mono">testes: {adapter.evidence.tests.join(', ')}</p>
                ) : null}
                {adapter.backends?.length ? (
                  <ul className="forge-list">
                    {adapter.backends.map((backend) => (
                      <li key={backend.kind}>
                        <code>{backend.kind}</code> {backend.validated ? 'validado' : 'não validado'}
                        {backend.note ? ` — ${backend.note}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Detail>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RightsPanel({ rights, assets, onDeclare, busy }) {
  const [assetId, setAssetId] = useState('');
  const [license, setLicense] = useState('');
  const [declaredBy, setDeclaredBy] = useState('');
  const states = rights?.byState ?? {};
  return (
    <section className="panel forge-panel">
      <header className="forge-panel-head">
        <ShieldCheck size={15} strokeWidth={1.8} />
        <h2>Direitos dos assets</h2>
        <span className="forge-panel-tag">{rights?.total ?? 0} no projeto</span>
      </header>
      <div className="forge-rights-grid">
        {Object.entries(states).map(([state, count]) => (
          <div key={state} className={`forge-rights-cell ${count > 0 ? 'is-active' : ''}`}>
            <strong>{count}</strong>
            <span>{state}</span>
          </div>
        ))}
      </div>
      {rights?.note ? <p className="forge-note"><Info size={13} strokeWidth={1.9} />{rights.note}</p> : null}
      {rights?.blockedAssets?.length ? (
        <ul className="forge-list">
          {rights.blockedAssets.map((item) => (
            <li key={item.id}><strong>{item.id}</strong>: {item.blockers.join('; ')}</li>
          ))}
        </ul>
      ) : null}
      <form
        className="forge-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!assetId.trim() || !license.trim()) return;
          await onDeclare({ assetId: assetId.trim(), license: license.trim(), declaredBy: declaredBy.trim() || null });
          setLicense('');
        }}
      >
        <label>
          <span>Asset</span>
          <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
            <option value="">selecione…</option>
            {(assets ?? []).map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.name ?? asset.id}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Licença declarada</span>
          <input value={license} onChange={(event) => setLicense(event.target.value)} placeholder="CC0-1.0, MIT, NOASSERTION…" />
        </label>
        <label>
          <span>Quem declara</span>
          <input value={declaredBy} onChange={(event) => setDeclaredBy(event.target.value)} placeholder="seu nome" />
        </label>
        <button type="submit" className="button button-quiet" disabled={busy === 'rights' || !assetId || !license}>
          {busy === 'rights' ? <span className="spin" /> : <ShieldCheck size={14} />} Registrar declaração
        </button>
        <p className="forge-note">Direitos nunca são inferidos: só o que uma pessoa declara muda o estado.</p>
      </form>
    </section>
  );
}

function WorkflowCard({ workflow, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`forge-workflow ${selected ? 'is-selected' : ''} ${workflow.executableNow ? '' : 'is-blocked'}`}
      onClick={() => onSelect(workflow.id)}
    >
      <header>
        <strong>{workflow.title}</strong>
        {workflow.executableNow
          ? <span className="forge-badge is-ready">pronto aqui</span>
          : <span className="forge-badge is-missing">{workflow.ready}/{workflow.steps} passos prontos</span>}
      </header>
      <p>{workflow.description}</p>
      <footer>
        <span className="forge-family">{workflow.family}</span>
        {!workflow.executableNow ? (
          <span className="forge-blocked-hint">
            <Lock size={12} strokeWidth={2} />
            {workflow.states.filter((state) => state.state === 'blocked').map((state) => state.stepId).join(', ')}
          </span>
        ) : null}
      </footer>
    </button>
  );
}

export function PlanStepRow({ step }) {
  return (
    <li className={`forge-step ${step.adapter ? 'is-ready' : 'is-blocked'}`}>
      <header>
        <span className="forge-step-title">{step.title}</span>
        {step.adapter
          ? <span className="forge-badge is-ready"><code>{step.adapter}</code></span>
          : <span className="forge-badge is-blocked">sem adapter</span>}
        {step.reviewRequired ? <span className="forge-badge is-review"><Eye size={11} strokeWidth={2} /> revisão humana</span> : null}
        {step.inputFrom === 'priorRun' ? <span className="forge-badge is-review"><WorkflowIcon size={11} strokeWidth={2} /> usa um run anterior</span> : null}
        {step.requiresParam ? <span className="forge-badge is-review"><Box size={11} strokeWidth={2} /> precisa de <code>{step.requiresParam}</code></span> : null}
        {step.optional ? <span className="forge-badge is-unknown">opcional</span> : null}
      </header>
      {step.blockedReason ? <p className="forge-step-reason"><CircleAlert size={13} strokeWidth={1.9} />{step.blockedReason}</p> : null}
      {/* Ferramenta instalada que não serve a este passo: dito na hora, sem exigir
          que o usuário abra os candidatos para entender por que ela não foi usada. */}
      {(step.candidates ?? []).some((candidate) => candidate.applicable === false) ? (
        <p className="forge-step-note">
          <Info size={13} strokeWidth={1.9} />
          <span>
            {step.candidates
              .filter((candidate) => candidate.applicable === false)
              .map((candidate) => `${candidate.adapterId}: ${candidate.reason ?? 'não serve a este passo'}`)
              .join(' · ')}
          </span>
        </p>
      ) : null}
      <Detail summary="candidatos, requisitos, custo, licença e validadores">
        <KeyValue label="Capacidade" value={step.capability} mono />
        <KeyValue label="Status da capacidade" value={step.capabilityStatus} />
        <KeyValue label="Depende de" value={step.dependsOn?.length ? step.dependsOn.join(', ') : 'nada'} />
        <KeyValue label="Validadores" value={step.validators?.length ? step.validators.join(', ') : null} mono />
        <KeyValue label="Licença" value={step.license} />
        <KeyValue label="Direitos da saída" value={step.outputRights} />
        <KeyValue label="Custo" value={COST_LABELS[step.cost?.status] ?? step.cost?.status} />
        {step.cost?.note ? <p className="forge-note">{step.cost.note}</p> : null}
        <KeyValue label="RAM" value={step.resources?.ramMb ? `${step.resources.ramMb} MB` : null} />
        <KeyValue label="VRAM" value={step.resources?.vramMb ? `${step.resources.vramMb} MB` : null} />
        {step.candidates?.length ? (
          <ul className="forge-list">
            {step.candidates.map((candidate) => (
              <li key={candidate.adapterId} className={candidate.applicable === false ? 'is-inapplicable' : undefined}>
                <code>{candidate.adapterId}</code> <StateBadge state={candidate.state} />
                {candidate.applicable === false ? <span className="forge-badge is-unknown">não serve a este passo</span> : null}
                {candidate.detail ? ` — ${candidate.detail}` : ''}
                {candidate.applicable === false && candidate.reason ? <em className="forge-candidate-reason">{candidate.reason}</em> : null}
                {candidate.license ? ` · licença: ${candidate.license}` : ''}
              </li>
            ))}
          </ul>
        ) : null}
      </Detail>
    </li>
  );
}

export function RunStepRow({ step, onReview = () => {}, reviewBusy = false, reviewNote = '', setReviewNote = () => {} }) {
  const awaitingReview = step.state === 'blocked' && step.review?.status === 'review-missing';
  const artifactImages = (step.outputs ?? []).filter((output) => /\.(png|jpe?g|webp)$/i.test(output));
  return (
    <li className={`forge-step is-run-${step.state}`}>
      <header>
        <span className="forge-step-title">{step.id}</span>
        <StateBadge state={step.state} label={RUN_STATE_LABELS[step.state] ?? step.state} />
        {step.reused ? <span className="forge-badge is-unknown">reaproveitado do checkpoint</span> : null}
        {step.adapter ? <code className="forge-step-adapter">{step.adapter}</code> : null}
      </header>
      {step.error ? (
        <p className="forge-step-reason">
          <CircleAlert size={13} strokeWidth={1.9} />
          {step.error.message}
          {step.error.requiresUserDecision ? <span className="forge-badge is-review"><Lock size={11} strokeWidth={2} /> precisa de uma decisão sua</span> : null}
        </p>
      ) : null}
      {step.validations?.length ? (
        <ul className="forge-validations">
          {step.validations.map((item, index) => (
            <li key={`${item.validator}-${index}`} className={`is-${item.status}`}>
              <ShieldCheck size={12} strokeWidth={1.9} />
              <code>{item.validator}</code>
              <span>{VALIDATION_LABELS[item.status] ?? item.status}</span>
              {item.checked > 1 ? <em>{item.checked} itens</em> : null}
              {item.status === 'skipped' && item.reason ? <em title={item.reason}>{item.reason}</em> : null}
              {item.status === 'failed' ? <em>{(item.problems ?? []).join('; ')}</em> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {step.review && step.review.status !== 'approved' ? (
        <p className="forge-step-reason"><Eye size={13} strokeWidth={1.9} />{step.review.reason}</p>
      ) : null}
      {step.review?.status === 'approved' ? (
        <p className="forge-step-ok"><CheckCircle2 size={13} strokeWidth={1.9} />Aprovado por {step.review.reviewedBy ?? 'você'} em {step.review.reviewedAt ?? ''}</p>
      ) : null}
      {step.note ? <p className="forge-note">{step.note}</p> : null}
      {artifactImages.length ? (
        <div className="forge-artifacts">
          {artifactImages.map((output) => (
            <figure key={output}>
              <RunArtifactImage path={output} alt={`Artefato ${output}`} />
              <figcaption title={output}>{output.split('/').pop()}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      <Detail summary="saídas, hash, métricas e gates">
        {step.outputs?.length ? (
          <ul className="forge-list">
            {step.outputs.map((output) => <li key={output} className="is-mono">{output}</li>)}
          </ul>
        ) : null}
        <KeyValue label="SHA-256" value={step.sha256} mono />
        {step.metrics ? <pre className="forge-pre">{JSON.stringify(step.metrics, null, 2)}</pre> : null}
      </Detail>
      {awaitingReview ? (
        <div className="forge-review">
          <p>
            <Eye size={14} strokeWidth={1.9} />
            Este passo precisa da sua aprovação antes de continuar. A decisão fica ancorada no SHA-256 do artefato:
            se o arquivo mudar, a aprovação perde a validade.
          </p>
          <textarea
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            placeholder="O que você observou? (opcional)"
            rows={2}
          />
          <div className="forge-review-actions">
            <button type="button" className="button button-primary" disabled={reviewBusy} onClick={() => onReview(step.id, true)}>
              {reviewBusy ? <span className="spin" /> : <Check size={14} />} Aprovar e continuar
            </button>
            <button type="button" className="button button-quiet" disabled={reviewBusy} onClick={() => onReview(step.id, false)}>
              Rejeitar e parar
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Miniatura de qualquer arquivo do projeto: entradas do usuário (`input/`) e
 * artefatos de run (`.lia-forge/runs/`). A fonte é resolvida por transporte —
 * URL HTTP no navegador, data URL vinda por IPC no desktop.
 */
export function ArtifactThumb({ path: relativePath, kind = 'image', alt = null }) {
  const [source, setSource] = useState(null);
  useEffect(() => {
    let active = true;
    setSource(null);
    if (kind !== 'image' || !relativePath) return () => { active = false; };
    const load = relativePath.startsWith('input/') ? liaForgeApi.inputSource(relativePath) : liaForgeApi.artifactSource(relativePath);
    load
      .then((value) => { if (active) setSource(value); })
      .catch(() => { if (active) setSource(null); });
    return () => { active = false; };
  }, [relativePath, kind]);
  if (kind !== 'image' || !source) {
    return <span className="forge-thumb is-empty"><Box size={16} strokeWidth={1.7} /></span>;
  }
  return <img className="forge-thumb" src={source} alt={alt ?? relativePath} loading="lazy" />;
}

// Reexportado para manter o mesmo ponto de acesso de antes (os testes e qualquer
// consumidor da interface importam daqui); a implementação é a de shared/.
export { buildJourneySteps, journeyProgress, isResumableRun };


/**
 * Um run gravado na lista lateral. Quando o arquivo diz "em andamento" mas não
 * há execução neste processo (o aplicativo foi fechado, por exemplo), o item
 * mostra isso e oferece corrigir o estado ou retomar — em vez de deixar o run
 * para sempre com cara de ocupado.
 */
/**
 * Run gravado na lista. As ações oferecidas são exatamente as que o serviço
 * aceita (`isResumableRun`, a mesma regra usada pelo roteiro): um botão que
 * devolve "não precisa de retomada" para um run interrompido ensina o usuário a
 * desconfiar da interface. "Corrigir estado" só existe para run interrompido —
 * é o caso em que o estado gravado (`running`) não corresponde à realidade.
 */
export function SavedRunItem({ item, currentRunId = null, busy = null, onOpen, onRecover, onResume }) {
  const resumable = isResumableRun(item);
  const noPlan = item.planStored === false;
  const showRecover = item.stale || resumable || noPlan;
  const stateLabel = item.active ? 'Em execução agora' : item.stale ? 'Interrompido' : RUN_STATE_LABELS[item.status] ?? item.status;
  return (
    <li className={item.stale ? 'is-stale' : resumable ? 'is-resumable' : undefined}>
      <button
        type="button"
        className={`forge-run-link ${currentRunId === item.runId ? 'is-active' : ''}`}
        onClick={() => onOpen(item.runId)}
      >
        <code>{item.runId}</code>
        <StateBadge state={item.status} label={stateLabel} />
        <span>{item.planTitle ?? item.planId}</span>
      </button>
      {showRecover ? (
        <div className="forge-run-recover">
          <span>
            {item.stale
              ? 'Consta como em andamento, mas não há execução neste processo.'
              : `Terminou como ${String(stateLabel).toLowerCase()}: ${resumable ? 'os passos concluídos ficaram em checkpoint.' : 'nada foi entregue como pronto.'}`}
            {noPlan ? ' O plano original não está gravado neste projeto, então não há como retomar com as mesmas entradas.' : ''}
          </span>
          <div className="forge-picker-actions">
            {item.stale ? (
              <button type="button" className="button button-quiet" disabled={busy !== null} onClick={() => onRecover(item.runId)}>
                {busy === 'recover' ? <span className="spin" /> : <RotateCcw size={12} strokeWidth={2} />} Corrigir estado
              </button>
            ) : null}
            {resumable ? (
              <button type="button" className="button button-quiet" disabled={busy !== null} onClick={() => onResume(item.runId)}>
                {busy === 'resume' ? <span className="spin" /> : <RotateCcw size={12} strokeWidth={2} />} Retomar
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

const JOURNEY_ICONS = { done: Check, now: ChevronRight, human: UserRound, todo: CircleDashed, optional: CircleDashed };

/** Roteiro visível: o leigo sabe onde está e o que vem a seguir, sem decorar termos. */
/**
 * Prévia de VFX (§3: quem não conhece a ferramenta precisa ver o que o preset
 * faz antes de executar). O atlas é gerado pelo próprio produto — VFX
 * procedural, sem ferramenta externa, sem rede e sem custo — e o que aparece é
 * medido: grade, tamanho da folha, cores únicas e SHA-256 do PNG gerado.
 *
 * A prévia some assim que qualquer ajuste muda: imagem na tela que não
 * corresponde ao que será executado é o mesmo tipo de mentira que este produto
 * evita em todo o resto.
 */
export function VfxPreview({ preset, size, frameCount, preview, busy, onRequest }) {
  const frameSize = preview?.grid?.columns ? Math.round(preview.sheetWidth / preview.grid.columns) : null;
  const matches = Boolean(preview)
    && preview.preset === preset
    && preview.frameCount === Number(frameCount)
    && frameSize === Number(size);
  return (
    <div className="forge-vfx-preview is-wide">
      <div className="forge-vfx-preview-head">
        <button type="button" className="button button-quiet" onClick={onRequest} disabled={busy !== null}>
          {busy === 'vfx-preview' ? <span className="spin" /> : <Sparkles size={13} strokeWidth={2} />} Ver prévia
        </button>
        <em className="forge-note">Gerada pelo próprio produto (VFX procedural): não chama ferramenta externa, não usa rede e não gera custo. Executar é o que grava e valida os artefatos.</em>
      </div>
      {preview ? (
        <figure className="forge-vfx-figure">
          <img src={`data:image/png;base64,${preview.pngBase64}`} alt={`Prévia do atlas de VFX ${preview.preset}`} />
          <figcaption>
            {preview.preset} · {preview.frameCount} frames em {preview.grid.columns}×{preview.grid.rows} · quadro {frameSize}px · folha {preview.sheetWidth}×{preview.sheetHeight} · {preview.content?.uniqueColors ?? 0} cores · sha256 {String(preview.sha256 ?? '').slice(0, 16)}…
            {matches ? '' : ' — os ajustes mudaram desde esta prévia'}
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}

export function JourneyChecklist(props) {
  const steps = buildJourneySteps(props);
  const progress = journeyProgress(steps);
  const { done, next: now, humanDecisions: human } = progress;
  const verifiedOnDestination = props.exportResult?.bundle?.verifiedOnDestination === true;
  return (
    <section className="panel forge-panel forge-journey">
      <header className="forge-panel-head">
        <Compass size={15} strokeWidth={1.8} />
        <h2>Roteiro de produção</h2>
        <span className="forge-panel-tag">{done} de {steps.length} passos</span>
      </header>
      <div className="forge-progress"><span style={{ width: `${progress.percent}%` }} /></div>
      {now ? (
        <p className="forge-note is-now"><strong>Passo {now.index} — {now.title}.</strong> {now.detail}</p>
      ) : (
        <p className="forge-note">
          {human.length
            // Sem passo atual mas com decisão pendente: dizer "tudo concluído"
            // aqui seria falso (ex.: run interrompido esperando você corrigir o
            // estado ou retomar).
            ? 'O que depende só do produto está feito até aqui; o restante espera uma decisão sua (lista acima).'
            : props.exportResult && !verifiedOnDestination
              ? 'Até onde o produto pode ir, está feito: o pacote confere com o perfil do destino. Importar na engine e conferir lá é o passo que só você pode executar.'
              : 'Todos os passos que dependem só do produto estão concluídos.'}
        </p>
      )}
      {human.length ? (
        <div className="forge-note is-human">
          <p className="forge-journey-human-head">
            <UserRound size={12} strokeWidth={2} />
            <span>
              {human.map((step) => `${step.index}. ${step.title}`).join(' · ')} — decisões suas; o produto não instala,
              não compra e não autoriza nada por conta própria.
            </span>
          </p>
          {/* O motivo de cada decisão aparece sem precisar abrir a lista: é o que
              impede o usuário de achar que o produto vai resolver sozinho. */}
          <ul className="forge-journey-human">
            {human.map((step) => (
              <li key={step.id}>
                <strong>{step.index}. {step.title}</strong>
                <em>{step.detail}</em>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Detail summary="ver os 12 passos">
        <ol className="forge-journey-steps">
          {steps.map((step) => {
            const Icon = JOURNEY_ICONS[step.state] ?? CircleDashed;
            return (
              <li key={step.id} className={`is-${step.state}`}>
                <Icon size={12} strokeWidth={2.1} />
                <strong>{step.index}. {step.title}</strong>
                <em>{step.detail}</em>
              </li>
            );
          })}
        </ol>
      </Detail>
    </section>
  );
}

/**
 * Passo 1 da jornada: a pasta do projeto. Mostra o que existe (entradas, runs,
 * assets), avisa quando algo de versões anteriores está lá e é preservado, e no
 * desktop permite abrir/criar outra pasta — criando só `input/` e
 * `.lia-forge/runs/`, sem mover nem apagar o que já existe.
 */
export function ProjectPanel({ project, busy, transport, onChoose, onReveal, onRefresh }) {
  if (!project) return null;
  return (
    <section className="panel forge-panel forge-project">
      <header className="forge-panel-head">
        <FolderTree size={15} strokeWidth={1.8} />
        <h2>Projeto</h2>
        <span className="forge-panel-tag">{project.name}</span>
      </header>
      <p className="forge-note is-mono" title={project.root}>{project.root}</p>
      <div className="forge-project-counts">
        <span>{project.counts.inputs} entrada(s)</span>
        <span>{project.counts.runs} run(s)</span>
        <span>{project.counts.assets} asset(s)</span>
        {project.activeRuns ? <span className="is-live">{project.activeRuns} em execução</span> : null}
      </div>
      {project.writable === false ? (
        <div className="forge-banner is-error">
          <CircleAlert size={14} />
          <span>Sem permissão de escrita nesta pasta: o produto não vai conseguir gravar artefatos. Abra outra pasta.</span>
        </div>
      ) : null}
      {project.legacy?.spriteforge || project.legacy?.liaManifest ? (
        <p className="forge-note">{project.legacy.note}</p>
      ) : null}
      <div className="forge-panel-actions">
        {transport === 'ipc' ? (
          <>
            <button type="button" className="button button-quiet" onClick={() => onChoose({ create: false })} disabled={busy !== null}>
              {busy === 'project' ? <span className="spin" /> : <FolderOpen size={13} strokeWidth={1.9} />} Abrir outra pasta
            </button>
            <button type="button" className="button button-quiet" onClick={() => onChoose({ create: true })} disabled={busy !== null}>
              <FolderTree size={13} strokeWidth={1.9} /> Novo projeto
            </button>
            <button type="button" className="button button-quiet" onClick={onReveal} disabled={busy !== null}>
              <Download size={13} strokeWidth={1.9} /> Ver no sistema
            </button>
          </>
        ) : (
          <p className="forge-note">
            Nesta página a pasta vem do servidor ({project.managedHere === false ? 'SPRITEFORGE_PROJECT_ROOT' : 'definida aqui'}).
            Criar ou trocar de projeto é feito no aplicativo desktop.
          </p>
        )}
        <button type="button" className="button button-quiet" onClick={onRefresh} disabled={busy !== null}>
          {busy === 'project-refresh' ? <span className="spin" /> : <RotateCcw size={13} strokeWidth={1.9} />} Atualizar
        </button>
      </div>
    </section>
  );
}

const INPUT_ACCEPT = {
  image: '.png,.jpg,.jpeg,.webp',
  model: '.glb,.gltf,.fbx,.obj,.stl,.blend',
  any: '.png,.jpg,.jpeg,.webp,.glb,.gltf,.fbx,.obj,.stl,.blend,.md,.txt,.json',
};

/**
 * Escolha de entrada sem digitar caminho: lista o que existe em `input/`,
 * aceita envio de arquivo e (no desktop) o seletor do sistema. O caminho manual
 * continua disponível para quem prefere informar um arquivo que já está lá.
 */
export function InputPicker({ label, hint = null, kind = 'image', value, entries, busy, onSelect, onUpload, onPickNative, transport }) {
  const fileInput = useRef(null);
  const visible = (entries ?? []).filter((entry) => kind === 'any' || entry.kind === kind);
  return (
    <div className="forge-picker is-wide">
      <header>
        <span>{label}</span>
        <div className="forge-picker-actions">
          <input ref={fileInput} type="file" hidden accept={INPUT_ACCEPT[kind] ?? INPUT_ACCEPT.any} onChange={onUpload} />
          <button type="button" className="button button-quiet" onClick={() => fileInput.current?.click()} disabled={busy !== null}>
            {busy === 'upload' ? <span className="spin" /> : <Upload size={13} strokeWidth={1.9} />} Enviar arquivo
          </button>
          {transport === 'ipc' ? (
            <button type="button" className="button button-quiet" onClick={onPickNative} disabled={busy !== null}>
              <FolderOpen size={13} strokeWidth={1.9} /> Escolher no computador
            </button>
          ) : null}
        </div>
      </header>
      {hint ? <p className="forge-note">{hint}</p> : null}
      {visible.length ? (
        <div className="forge-picker-grid">
          {visible.slice(0, 12).map((entry) => (
            <button
              type="button"
              key={entry.path}
              className={`forge-pick${entry.path === value ? ' is-selected' : ''}`}
              onClick={() => onSelect(entry.path)}
              title={entry.path}
            >
              <ArtifactThumb path={entry.path} kind={entry.kind} alt={entry.name} />
              <strong>{entry.name}</strong>
              <em>
                {entry.kind === 'image' && entry.width ? `${entry.width}×${entry.height} px`
                  : entry.kind === 'model' && entry.triangleCount ? `${entry.triangleCount} triângulos`
                    : `${(entry.bytes / 1024).toFixed(1)} KB`}
              </em>
              {entry.problem ? <span className="forge-pick-problem">{entry.problem}</span> : null}
            </button>
          ))}
        </div>
      ) : (
        <p className="forge-note">
          Nada em <code>input/</code> ainda: envie um arquivo aqui ou copie-o para a pasta <code>input/</code> do projeto.
        </p>
      )}
      <Detail summary="ou informe o caminho manualmente">
        <label>
          <span>Caminho dentro do projeto</span>
          <input value={value ?? ''} onChange={(event) => onSelect(event.target.value)} placeholder="input/sprite.png" spellCheck={false} />
        </label>
      </Detail>
    </div>
  );
}

/**
 * Comparison Lab: variações lado a lado com as métricas medidas de cada arquivo.
 * O produto mostra os números e não escolhe por você — a decisão fica gravada
 * como versão do asset.
 */
export function ComparisonLab({ candidates, entries, runs, busy, comparison, onToggle, onRemove, onCompare, onAddRun, onRegister, registered }) {
  const [runId, setRunId] = useState('');
  const selected = candidates.map((item) => item.path);
  const imageEntries = (entries ?? []).filter((entry) => entry.kind === 'image');
  return (
    <section className="panel forge-panel">
      <header className="forge-panel-head">
        <GitCompareArrows size={15} strokeWidth={1.8} />
        <h2>5 · Comparison Lab</h2>
        <span className="forge-panel-tag">{selected.length} selecionado(s)</span>
      </header>
      <p className="forge-note">
        Compare variações e artefatos lado a lado com as métricas medidas de cada arquivo (dimensões, cores, cobertura, SHA-256).
        O Lia Forge não escolhe por você: a preferência vira versão registrada no asset.
      </p>

      <div className="forge-compare-picker">
        <div>
          <span>Entradas do projeto</span>
          <div className="forge-chip-row">
            {imageEntries.map((entry) => (
              <button
                type="button"
                key={entry.path}
                className={`forge-chip${selected.includes(entry.path) ? ' is-on' : ''}`}
                onClick={() => onToggle({ path: entry.path, origin: 'input' })}
              >
                {entry.name}
              </button>
            ))}
            {!imageEntries.length ? <em className="forge-note">nenhuma imagem em input/</em> : null}
          </div>
        </div>
        <div>
          <span>Artefatos de um run</span>
          <div className="forge-chip-row">
            <select value={runId} onChange={(event) => setRunId(event.target.value)}>
              <option value="">— escolha um run —</option>
              {(runs ?? []).map((item) => (
                <option key={item.runId} value={item.runId}>{item.runId} · {item.planTitle ?? item.planId ?? 'run'}</option>
              ))}
            </select>
            <button type="button" className="button button-quiet" disabled={!runId || busy !== null} onClick={() => onAddRun(runId)}>
              {busy === 'compare-load' ? <span className="spin" /> : <Layers3 size={13} strokeWidth={1.9} />} Adicionar imagens do run
            </button>
          </div>
        </div>
        {candidates.length ? (
          <div className="forge-chip-row is-selected">
            {candidates.map((item) => (
              <button type="button" key={item.path} className="forge-chip is-on" onClick={() => onRemove(item.path)} title="remover da comparação">
                {item.path.split('/').pop()} ✕
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="forge-panel-actions">
        <button type="button" className="button button-primary" onClick={() => onCompare(selected)} disabled={!selected.length || busy !== null}>
          {busy === 'compare' ? <span className="spin" /> : <GitCompareArrows size={14} />} Comparar {selected.length ? `(${selected.length})` : ''}
        </button>
        {registered ? <span className="forge-note">Versão gravada em <code>{registered.assetId}</code> · {registered.path}</span> : null}
      </div>

      {comparison ? (
        <div className="forge-compare-grid">
          {comparison.entries.map((entry) => (
            <article key={entry.path} className={`forge-compare-card${entry.ok ? '' : ' is-error'}`}>
              <ArtifactThumb path={entry.path} kind={entry.ok && ['png', 'jpg', 'jpeg', 'webp'].includes(entry.format) ? 'image' : 'other'} alt={entry.path} />
              <strong title={entry.path}>{entry.name ?? entry.path.split('/').pop()}</strong>
              {entry.ok ? (
                <>
                  <div className="forge-plan-meta">
                    <KeyValue label="Formato" value={entry.format} />
                    <KeyValue label="Dimensões" value={entry.width ? `${entry.width}×${entry.height}` : null} />
                    <KeyValue label="Cores únicas" value={entry.uniqueColors ?? null} />
                    <KeyValue label="Cobertura" value={entry.coverage === null || entry.coverage === undefined ? null : `${(entry.coverage * 100).toFixed(1)}%`} />
                    <KeyValue label="Triângulos" value={entry.triangleCount ?? null} />
                    <KeyValue label="Tamanho" value={`${(entry.bytes / 1024).toFixed(1)} KB`} />
                    <KeyValue label="Conteúdo verificado" value={entry.contentChecked ? 'sim' : 'não'} />
                  </div>
                  <p className="forge-note is-mono">sha256 {String(entry.sha256 ?? '').slice(0, 16)}…</p>
                  {entry.blank ? <p className="forge-pick-problem">Imagem totalmente transparente: não serve como arte final.</p> : null}
                  <button
                    type="button"
                    className="button button-quiet"
                    disabled={busy !== null}
                    // A proveniência do run (quando o artefato veio de um) segue junto da versão.
                    onClick={() => onRegister({ ...entry, runId: candidates.find((item) => item.path === entry.path)?.runId ?? null })}
                  >
                    <Package size={13} strokeWidth={1.9} /> Registrar como versão do asset
                  </button>
                </>
              ) : (
                <p className="forge-pick-problem">{entry.problem}</p>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function ForgeStudio({ onNotify = () => {} }) {
  const [overview, setOverview] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workflowId, setWorkflowId] = useState(null);
  const [destination, setDestination] = useState('godot-4');
  const [brief, setBrief] = useState('');
  const [sourceImage, setSourceImage] = useState('');
  const [fromRun, setFromRun] = useState('');
  const [modelPath, setModelPath] = useState('');
  const [vfx, setVfx] = useState({ preset: 'impact', size: 64, frameCount: 8 });
  const [vfxPreview, setVfxPreview] = useState(null);
  // Mudou o ajuste, a prévia deixa de valer: melhor pedir de novo do que mostrar
  // na tela uma imagem que não é o que vai ser executado.
  const updateVfx = (patch) => {
    setVfx((current) => ({ ...current, ...patch }));
    setVfxPreview(null);
  };
  const [plan, setPlan] = useState(null);
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [runTab, setRunTab] = useState('passos');
  const [reviewNote, setReviewNote] = useState('');
  const [assetName, setAssetName] = useState('');
  const [exportResult, setExportResult] = useState(null);
  const [runs, setRuns] = useState([]);
  const [providers, setProviders] = useState(null);
  const [inputs, setInputs] = useState([]);
  const [compareCandidates, setCompareCandidates] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [registeredVersion, setRegisteredVersion] = useState(null);
  const [liveRun, setLiveRun] = useState(null);
  const [project, setProject] = useState(null);

  const notify = useCallback((message, tone = 'info') => {
    if (typeof onNotify === 'function') onNotify(message, tone);
  }, [onNotify]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await liaForgeApi.overview();
      setOverview(data);
      try {
        setRuns(await liaForgeApi.runs());
      } catch {
        setRuns([]);
      }
      try {
        setProviders(await liaForgeApi.providers());
      } catch {
        setProviders(data.providers ?? null);
      }
      try {
        const listed = await liaForgeApi.listInputs();
        setInputs(listed?.entries ?? []);
      } catch {
        setInputs([]);
      }
      try {
        setProject(await liaForgeApi.projectInfo());
      } catch {
        setProject(null);
      }
      if (!workflowId) {
        const firstExecutable = data.workflows.find((workflow) => workflow.executableNow) ?? data.workflows[0];
        setWorkflowId(firstExecutable?.id ?? null);
      }
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const workflow = useMemo(
    () => overview?.workflows?.find((item) => item.id === workflowId) ?? null,
    [overview, workflowId],
  );
  const needsSourceImage = workflowId === '2d-character-parts' || workflowId === '2d-modular-character' || workflowId === 'variation-retexture';
  const isVfxWorkflow = workflowId === 'ui-vfx-sheet';
  // Entradas que só você pode fornecer, declaradas pelo catálogo (§3: o Studio
  // pede antes de executar, em vez de falhar no meio do pipeline).
  const needsInput = workflow?.needsInput ?? [];
  const needsPriorRun = needsInput.some((item) => item.kind === 'priorRun');
  const modelParam = needsInput.find((item) => item.param)?.param ?? null;
  // Só um run concluído serve de origem: rig revisado não existe em run falho.
  const priorRunCandidates = (runs ?? []).filter((item) => item.status === 'succeeded' || item.status === 'blocked');
  // O run em foco consta como em andamento sem execução neste processo? O roteiro
  // precisa saber para não apresentar como vivo o que foi interrompido.
  const runStale = Boolean(run?.runId && (runs ?? []).some((item) => item.runId === run.runId && item.stale));
  // O item da lista traz o que só o serviço sabe (está ativo aqui? o plano
  // original continua gravado?). É dele que sai a decisão de oferecer retomada —
  // a mesma regra da lista lateral e do roteiro, sem segunda lista de estados.
  const runListItem = run?.runId ? (runs ?? []).find((item) => item.runId === run.runId) ?? null : null;
  const runResumable = isResumableRun(runListItem ?? (run ? { runId: run.runId, status: run.status, stale: runStale, active: busy === 'run' } : null));

  const runAction = useCallback(async (label, action) => {
    setBusy(label);
    setActionError(null);
    try {
      return await action();
    } catch (error) {
      setActionError(error.message);
      notify(error.message, 'error');
      return null;
    } finally {
      setBusy(null);
    }
  }, [notify]);

  const buildOptions = useCallback(() => {
    const options = {};
    if (isVfxWorkflow) options.vfx = { preset: vfx.preset, size: Number(vfx.size), frameCount: Number(vfx.frameCount) };
    if (needsPriorRun && fromRun) options.fromRun = fromRun;
    if (modelParam && modelPath.trim()) options[modelParam] = modelPath.trim();
    return options;
  }, [isVfxWorkflow, vfx, needsPriorRun, fromRun, modelParam, modelPath]);

  const buildParams = useCallback(() => {
    const params = {};
    if (needsSourceImage && sourceImage.trim()) params.sourceImage = sourceImage.trim();
    if (isVfxWorkflow) params.vfx = { preset: vfx.preset, size: Number(vfx.size), frameCount: Number(vfx.frameCount) };
    if (needsPriorRun && fromRun) params.fromRun = fromRun;
    if (modelParam && modelPath.trim()) params[modelParam] = modelPath.trim();
    return params;
  }, [needsSourceImage, sourceImage, isVfxWorkflow, vfx, needsPriorRun, fromRun, modelParam, modelPath]);

  /**
   * Progresso ao vivo: enquanto o run executa, a interface pergunta o que está
   * em andamento e lê o snapshot gravado a cada passo. Sem isso o usuário veria
   * só o resultado final — e não teria o que cancelar.
   */
  useEffect(() => {
    if (busy !== 'run') {
      setLiveRun(null);
      return undefined;
    }
    let active = true;
    const tick = async () => {
      try {
        const list = await liaForgeApi.activeRuns();
        const current = Array.isArray(list) && list.length ? list[list.length - 1] : null;
        if (!current) {
          if (active) setLiveRun(null);
          return;
        }
        const snapshot = await liaForgeApi.readRun(current.runId).catch(() => null);
        if (!active) return;
        setLiveRun(snapshot ?? {
          runId: current.runId,
          status: 'running',
          steps: [],
          summary: { total: 0, progress: 0 },
          startedAt: current.startedAt,
        });
      } catch {
        /* não haver progresso publicado ainda não é erro: o run pode estar planejando */
      }
    };
    tick();
    const timer = setInterval(tick, 1200);
    return () => { active = false; clearInterval(timer); };
  }, [busy]);

  const refreshInputs = useCallback(async () => {
    try {
      const listed = await liaForgeApi.listInputs();
      setInputs(listed?.entries ?? []);
      return listed?.entries ?? [];
    } catch {
      return [];
    }
  }, []);

  /** Upload pelo navegador: o arquivo é copiado para input/, o original fica onde está. */
  const handleUploadInput = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    runAction('upload', async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const saved = await liaForgeApi.saveInput({ filename: file.name, bytes });
      await refreshInputs();
      if (saved.kind === 'image') setSourceImage(saved.path);
      else if (saved.kind === 'model' && modelParam) setModelPath(saved.path);
      notify(`"${saved.name}" copiado para input/ e verificado (${(saved.bytes / 1024).toFixed(1)} KB).`, 'info');
      return saved;
    });
  };

  /** No desktop, o seletor do sistema faz o mesmo papel do upload. */
  const handlePickNativeInput = () => runAction('upload', async () => {
    const saved = await liaForgeApi.pickInput();
    if (!saved) {
      notify('Nenhum arquivo foi escolhido.', 'info');
      return null;
    }
    await refreshInputs();
    if (saved.kind === 'image') setSourceImage(saved.path);
    else if (saved.kind === 'model' && modelParam) setModelPath(saved.path);
    notify(`"${saved.name}" copiado para input/ e verificado (${(saved.bytes / 1024).toFixed(1)} KB).`, 'info');
    return saved;
  });

  const handleToggleCompare = (candidate) => {
    setComparison(null);
    setCompareCandidates((current) => (current.some((item) => item.path === candidate.path)
      ? current.filter((item) => item.path !== candidate.path)
      : current.length >= 4
        ? current
        : [...current, candidate]));
  };

  const handleAddRunToCompare = (runId) => runAction('compare-load', async () => {
    const detail = await liaForgeApi.readRun(runId);
    const paths = (detail?.steps ?? [])
      .flatMap((step) => step.outputs ?? [])
      .filter((output) => /\.(png|jpe?g|webp)$/i.test(output));
    if (!paths.length) {
      notify('Esse run não tem imagens para comparar.', 'info');
      return null;
    }
    setCompareCandidates((current) => {
      const known = new Set(current.map((item) => item.path));
      return [...current, ...paths.filter((item) => !known.has(item)).map((item) => ({ path: item, origin: 'run', runId }))].slice(0, 4);
    });
    notify(`${paths.length} imagem(ns) do run ${runId} adicionada(s) à comparação.`, 'info');
    return paths;
  });

  const handleCompare = (paths) => runAction('compare', async () => {
    const result = await liaForgeApi.compareArtifacts(paths);
    setComparison(result);
    setRegisteredVersion(null);
    notify(`${result.entries.length} artefato(s) medido(s) lado a lado.`, 'info');
    return result;
  });

  const handleRegisterVersion = (entry) => runAction('register', async () => {
    const id = (assetName.trim() || 'comparacao').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(0, 80);
    await liaForgeApi.upsertAsset({ id, type: 'character', name: assetName.trim() || id });
    const version = await liaForgeApi.addAssetVersion(id, {
      runId: entry.runId ?? null,
      note: 'Escolhido no Comparison Lab',
      artifacts: [{
        path: entry.path,
        role: 'comparison-pick',
        format: entry.format ?? null,
        bytes: entry.bytes ?? null,
        sha256: entry.sha256 ?? null,
        validated: entry.contentChecked === true,
        contentMetrics: entry.uniqueColors === undefined ? null : {
          uniqueColors: entry.uniqueColors,
          coverage: entry.coverage,
          width: entry.width,
          height: entry.height,
        },
      }],
    });
    setRegisteredVersion({ assetId: id, path: entry.path, version: version?.version ?? null });
    // O painel de direitos e a lista de assets mudaram: relê o panorama.
    setOverview(await liaForgeApi.overview());
    notify(`Versão ${version?.version ?? 'nova'} gravada no asset "${id}".`, 'info');
    return version;
  });

  /**
   * Cancelamento cooperativo: o passo para no próximo ponto de verificação e o
   * run é gravado como cancelado. Nada é apagado — o que já foi feito continua
   * em disco e pode ser retomado.
   */
  const handleCancelRun = (targetRunId = null, reason = null) => runAction('cancel', async () => {
    const id = targetRunId ?? liveRun?.runId ?? run?.runId;
    if (!id) {
      notify('Não há execução em andamento para cancelar.', 'info');
      return null;
    }
    const result = await liaForgeApi.cancelRun(id, { reason, cancelledBy: 'usuário do Studio' });
    if (result?.ok) {
      const fresh = await liaForgeApi.readRun(id).catch(() => null);
      if (fresh) setRun(fresh);
      setRuns(await liaForgeApi.runs().catch(() => []));
      notify(result.stale
        ? 'A execução já não estava neste processo; o estado gravado foi corrigido para cancelado.'
        : 'Cancelamento enviado: o run para no próximo ponto de verificação.', 'info');
    } else {
      notify(result?.reason ?? 'Não foi possível cancelar.', 'info');
    }
    return result;
  });

  const handleVfxPreview = () => runAction('vfx-preview', async () => {
    const result = await liaForgeApi.vfxPreview({ preset: vfx.preset, size: Number(vfx.size), frameCount: Number(vfx.frameCount) });
    setVfxPreview(result);
    notify(`Prévia gerada aqui mesmo: ${result.frameCount} frames em ${result.grid.columns}×${result.grid.rows}, folha ${result.sheetWidth}×${result.sheetHeight}.`, 'info');
    return result;
  });

  const handleResumeRun = () => runAction('resume', async () => {
    if (!run?.runId) return null;
    const result = await liaForgeApi.resumeRun(run.runId, { reason: 'retomado pelo usuário no Studio' });
    if (result?.ok && result.result) {
      setRun(result.result);
      setRunTab('passos');
      setExportResult(null);
      setRuns(await liaForgeApi.runs().catch(() => []));
      notify(`Run ${result.interrupted ? 'interrompido ' : ''}retomado a partir de ${result.checkpointsReused} checkpoint(s): ${result.result.status}.`, result.result.status === 'succeeded' ? 'success' : 'info');
    } else {
      notify(result?.reason ?? 'Nada a retomar.', 'info');
    }
    return result;
  });

  const handleChooseProject = ({ create = false } = {}) => runAction('project', async () => {
    const result = await liaForgeApi.chooseProject({ create });
    if (!result) {
      notify('Nenhuma pasta foi escolhida.', 'info');
      return null;
    }
    setProject(result.project);
    setRun(null);
    setExportResult(null);
    setComparison(null);
    setCompareCandidates([]);
    setRegisteredVersion(null);
    await refreshInputs();
    setRuns(await liaForgeApi.runs().catch(() => []));
    setOverview(await liaForgeApi.overview());
    notify(`Projeto em ${result.project.root}: ${result.created.length ? `pastas criadas (${result.created.join(', ')})` : 'a estrutura já existia'}. Nada do que estava lá foi alterado.`, 'success');
    return result;
  });

  const handleRevealProject = () => runAction('project', async () => {
    const result = await liaForgeApi.revealProject();
    if (result?.ok) notify('Pasta do projeto aberta no gerenciador de arquivos.', 'info');
    return result;
  });

  const handleOpenRun = useCallback(async (runId) => {
    setBusy('open-run');
    try {
      setRun(await liaForgeApi.readRun(runId));
      setRunTab('passos');
      setExportResult(null);
    } catch (error) {
      setActionError(error.message);
      notify(error.message, 'error');
    } finally {
      setBusy(null);
    }
  }, [notify]);

  /** Run que consta em andamento sem execução aqui: corrige o estado gravado. */
  const handleRecoverRun = (runId) => runAction('recover', async () => {
    const result = await liaForgeApi.cancelRun(runId, { reason: 'estado corrigido pelo usuário: não havia execução neste processo' });
    setRuns(await liaForgeApi.runs().catch(() => []));
    if (run?.runId === runId) setRun(await liaForgeApi.readRun(runId).catch(() => run));
    notify(result?.ok
      ? 'Estado corrigido: o run consta como cancelado e os passos concluídos podem ser retomados.'
      : result?.reason ?? 'Nada a corrigir neste run.', 'info');
    return result;
  });

  const handleResumeListedRun = (runId) => runAction('resume', async () => {
    const result = await liaForgeApi.resumeRun(runId, { reason: 'retomado pelo usuário na lista de runs' });
    if (result?.ok && result.result) {
      setRun(result.result);
      setRunTab('passos');
      setExportResult(null);
      setRuns(await liaForgeApi.runs().catch(() => []));
      notify(`Run retomado de ${result.checkpointsReused} checkpoint(s): ${result.result.status}.`, result.result.status === 'succeeded' ? 'success' : 'info');
    } else {
      notify(result?.reason ?? 'Não foi possível retomar este run.', 'info');
    }
    return result;
  });

  const handleRefreshProject = () => runAction('project-refresh', async () => {
    const info = await liaForgeApi.projectInfo();
    setProject(info);
    await refreshInputs();
    return info;
  });

  const handleConfigureProvider = (payload) => runAction('provider', async () => {
    const result = await liaForgeApi.configureProvider(payload);
    setProviders(result?.providers ?? null);
    // O estado das ferramentas depende da configuração: relê o panorama inteiro
    // para que nenhum painel continue mostrando o mundo antigo.
    setOverview(await liaForgeApi.overview());
    notify('Configuração do provider gravada no projeto. Nada foi instalado, baixado ou comprado.', 'info');
  });

  const handlePlan = () => runAction('plan', async () => {
    const result = await liaForgeApi.plan({ workflowId, destination, options: buildOptions(), brief: brief.trim() || null });
    setPlan(result?.plan ?? null);
    setRun(null);
    setExportResult(null);
    notify('Plano gerado. Nada foi executado ainda.', 'info');
  });

  const handleRun = () => runAction('run', async () => {
    const result = await liaForgeApi.run({ workflowId, destination, options: buildOptions(), brief: brief.trim() || null, params: buildParams() });
    setRun(result?.snapshot ?? null);
    setPlan(result?.plan ?? plan);
    setRuns(await liaForgeApi.runs().catch(() => []));
    setExportResult(null);
    setRunTab('passos');
    const status = result?.snapshot?.status;
    notify(status === 'succeeded' ? 'Execução concluída.' : status === 'blocked' ? 'Execução parada: precisa da sua revisão.' : `Execução ${status}.`, status === 'succeeded' ? 'success' : 'info');
  });

  const handleReview = (stepId, approved) => runAction('review', async () => {
    const result = await liaForgeApi.reviewStep(run.runId, { stepId, approved, reviewer: 'usuário do Studio', note: reviewNote.trim() || null });
    setReviewNote('');
    if (result?.resumed && result.result) {
      setRun(result.result);
      notify(approved ? 'Aprovação registrada; o run continuou do checkpoint.' : 'Passo rejeitado; o run permanece bloqueado.', approved ? 'success' : 'info');
    } else {
      setRun(await liaForgeApi.readRun(run.runId));
      notify(result?.reason ?? 'Decisão registrada.', 'info');
    }
  });

  const handleExport = () => runAction('export', async () => {
    if (!run?.runId) return null;
    const result = await liaForgeApi.exportRun(run.runId, { destination });
    setExportResult(result);
    notify(`Pacote de exportação gerado para ${result?.bundle?.label ?? destination}.`, 'success');
    return result;
  });

  const handleAttach = () => runAction('attach', async () => {
    if (!run?.runId) return null;
    const id = (assetName.trim() || run.planId || 'asset').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(0, 80);
    await liaForgeApi.upsertAsset({ id, type: 'character', name: assetName.trim() || id });
    const asset = await liaForgeApi.attachRunToAsset(id, run.runId);
    const fresh = await liaForgeApi.overview();
    setOverview(fresh);
    notify(`Run anexado ao asset "${asset.id}" com proveniência e hashes.`, 'success');
    return asset;
  });

  const handleDeclare = ({ assetId: id, license, declaredBy }) => runAction('rights', async () => {
    await liaForgeApi.declareAssetRights(id, { license, declaredBy });
    const fresh = await liaForgeApi.overview();
    setOverview(fresh);
    notify('Declaração de direitos registrada.', 'success');
  });

  if (loading && !overview) {
    return (
      <div className="forge-page">
        <div className="panel forge-loading"><span className="spin" /> Lendo o estado real das ferramentas…</div>
      </div>
    );
  }

  if (loadError && !overview) {
    return (
      <div className="forge-page">
        <div className="panel forge-loading is-error">
          <CircleAlert size={16} />
          <p>Não consegui falar com o serviço do Studio: {loadError}</p>
          <button type="button" className="button button-primary" onClick={load}><RefreshCw size={14} /> Tentar novamente</button>
        </div>
      </div>
    );
  }

  const progress = run?.summary?.progress ?? 0;
  const gates = run?.gates ?? [];

  return (
    <div className="forge-page">
      <header className="forge-header">
        <div>
          <p className="forge-eyebrow">PIPELINE DE PRODUÇÃO</p>
          <h1>Crie sem precisar conhecer as ferramentas</h1>
          <p className="forge-subtitle">
            {overview.workflows.length} objetivos de produção · {overview.workflows.filter((item) => item.executableNow).length} executáveis agora nesta máquina ·
            {' '}{overview.preflight.summary.toolsAvailable} ferramentas detectadas, {overview.preflight.summary.toolsMissing} ausentes, {overview.preflight.summary.toolsBlocked} bloqueadas
          </p>
        </div>
        <div className="forge-header-actions">
          <button type="button" className="button button-quiet" onClick={load} disabled={loading}>
            {loading ? <span className="spin" /> : <RefreshCw size={14} />} Atualizar estado
          </button>
        </div>
      </header>

      {actionError ? (
        <div className="forge-banner is-error"><CircleAlert size={15} strokeWidth={1.9} /><span>{actionError}</span></div>
      ) : null}
      {overview.preflight.userActions.length ? (
        <div className="forge-banner">
          <Info size={15} strokeWidth={1.9} />
          <div>
            <strong>{overview.preflight.userActions.length} decisão(ões) só sua(s).</strong>
            <ul className="forge-list">
              {overview.preflight.userActions.slice(0, 4).map((action, index) => (
                <li key={`${action.capabilityId ?? action.kind}-${index}`}>
                  <em>{action.kind}</em> {action.title} — {action.detail}
                </li>
              ))}
            </ul>
            <p className="forge-note">O Lia Forge não instala, não baixa, não compra e não envia nada por conta própria.</p>
          </div>
        </div>
      ) : null}

      <div className="forge-columns">
        <div className="forge-main">
          <JourneyChecklist
            project={project}
            inputs={inputs}
            requiresInput={Boolean(needsSourceImage || modelParam)}
            workflowId={workflowId}
            brief={brief}
            destination={destination}
            plan={plan}
            preflight={overview.preflight}
            run={run}
            liveRun={busy === 'run' ? liveRun : null}
            runStale={runStale}
            runListed={runListItem}
            comparison={comparison}
            exportResult={exportResult}
            registeredVersion={registeredVersion}
            assets={overview.assets ?? []}
          />
          <section className="panel forge-panel">
            <header className="forge-panel-head">
              <WorkflowIcon size={15} strokeWidth={1.8} />
              <h2>1 · Escolha o objetivo</h2>
              <span className="forge-panel-tag">{overview.workflows.length} workflows</span>
            </header>
            <div className="forge-workflow-grid">
              {overview.workflows.map((item) => (
                <WorkflowCard key={item.id} workflow={item} selected={item.id === workflowId} onSelect={setWorkflowId} />
              ))}
            </div>
          </section>

          <section className="panel forge-panel">
            <header className="forge-panel-head">
              <Sparkles size={15} strokeWidth={1.8} />
              <h2>2 · Descreva e configure</h2>
              {workflow ? <span className="forge-panel-tag">{workflow.family}</span> : null}
            </header>
            <form className="forge-form" onSubmit={(event) => { event.preventDefault(); handlePlan(); }}>
              <label className="is-wide">
                <span>Brief (o que você quer criar)</span>
                <input value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Ex.: impacto neon para a habilidade especial da Aiko" />
              </label>
              <label>
                <span>Destino da exportação</span>
                <select value={destination} onChange={(event) => setDestination(event.target.value)}>
                  {overview.destinations.map((item) => (
                    <option key={item.id} value={item.id}>{item.label} · {item.fps} fps{item.verified ? ' · verificado' : ''}</option>
                  ))}
                </select>
              </label>
              {needsSourceImage ? (
                <InputPicker
                  label="Imagem de entrada"
                  hint="Escolha uma imagem do projeto ou envie a sua. O arquivo é copiado para input/ e verificado antes de entrar no pipeline."
                  kind="image"
                  value={sourceImage}
                  entries={inputs}
                  busy={busy}
                  transport={liaForgeApi.transport}
                  onSelect={setSourceImage}
                  onUpload={handleUploadInput}
                  onPickNative={handlePickNativeInput}
                />
              ) : null}
              {needsPriorRun ? (
                <label>
                  <span>Run de origem (rig já revisado)</span>
                  <select value={fromRun} onChange={(event) => setFromRun(event.target.value)}>
                    <option value="">— escolha um run concluído —</option>
                    {priorRunCandidates.map((item) => (
                      <option key={item.runId} value={item.runId}>
                        {item.runId} · {item.planTitle ?? item.planId ?? 'run'} · {RUN_STATE_LABELS[item.status] ?? item.status}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {modelParam ? (
                <InputPicker
                  label={`Modelo 3D (entrada "${modelParam}")`}
                  hint="Modelos aceitos: .glb, .gltf, .fbx, .obj, .stl e .blend. Um .glb é inspecionado aqui (meshes, triângulos, animações) antes do render."
                  kind="model"
                  value={modelPath}
                  entries={inputs}
                  busy={busy}
                  transport={liaForgeApi.transport}
                  onSelect={setModelPath}
                  onUpload={handleUploadInput}
                  onPickNative={handlePickNativeInput}
                />
              ) : null}
              {isVfxWorkflow ? (
                <>
                  <label>
                    <span>Preset de VFX</span>
                    <select value={vfx.preset} onChange={(event) => updateVfx({ preset: event.target.value })}>
                      {['explosion', 'fire', 'spark', 'smoke', 'impact', 'lightning'].map((preset) => <option key={preset} value={preset}>{preset}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Tamanho do frame</span>
                    <input type="number" min="16" max="512" step="16" value={vfx.size} onChange={(event) => updateVfx({ size: event.target.value })} />
                  </label>
                  <label>
                    <span>Frames</span>
                    <input type="number" min="1" max="64" value={vfx.frameCount} onChange={(event) => updateVfx({ frameCount: event.target.value })} />
                  </label>
                  <VfxPreview
                    preset={vfx.preset}
                    size={Number(vfx.size)}
                    frameCount={Number(vfx.frameCount)}
                    preview={vfxPreview}
                    busy={busy}
                    onRequest={handleVfxPreview}
                  />
                </>
              ) : null}
              <div className="forge-form-actions is-wide">
                <button type="submit" className="button button-quiet" disabled={busy === 'plan' || !workflowId}>
                  {busy === 'plan' ? <span className="spin" /> : <ListChecks size={14} />} Só planejar (não executa)
                </button>
                <button type="button" className="button button-primary" onClick={handleRun} disabled={busy === 'run' || !workflowId}>
                  {busy === 'run' ? <span className="spin" /> : <Play size={14} />} Executar o que for possível
                </button>
              </div>
            </form>
            {needsPriorRun && !fromRun ? (
              <p className="forge-note is-pending">
                <WorkflowIcon size={13} strokeWidth={1.9} />
                Este workflow reutiliza um resultado já revisado. Escolha o run de origem acima — nada é refeito do zero e nenhuma peça é separada duas vezes.
                {priorRunCandidates.length === 0 ? ' Ainda não há runs concluídos neste projeto: execute antes "Personagem 2D (partes + rig)".' : ''}
              </p>
            ) : null}
            {modelParam && !modelPath.trim() ? (
              <p className="forge-note is-pending">
                <Box size={13} strokeWidth={1.9} />
                Falta informar o modelo 3D (<code>{modelParam}</code>). Ele precisa estar dentro da pasta do projeto: nada é baixado automaticamente.
              </p>
            ) : null}
            {workflow && !workflow.executableNow ? (
              <p className="forge-note">
                <Lock size={13} strokeWidth={1.9} />
                {workflow.blocked} de {workflow.steps} passos não podem rodar aqui. Eles vão aparecer bloqueados com o motivo — nada é fingido como pronto.
              </p>
            ) : null}
          </section>

          {plan ? (
            <section className="panel forge-panel">
              <header className="forge-panel-head">
                <ListChecks size={15} strokeWidth={1.8} />
                <h2>3 · Plano (o Orquestrador planeja, não executa)</h2>
                <span className="forge-panel-tag">{plan.blocked ? 'bloqueado' : 'executável'}</span>
              </header>
              {plan.pendingInputs?.length ? (
                <ul className="forge-pending-inputs">
                  {plan.pendingInputs.map((item) => (
                    <li key={`${item.stepId}-${item.param ?? 'input'}`}>
                      <CircleHelp size={13} strokeWidth={1.9} />
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="forge-plan-meta">
                <KeyValue label="Contrato preservado" value={plan.preservesContract} mono />
                <KeyValue label="Entradas pendentes" value={plan.pendingInputs?.length ? `${plan.pendingInputs.length} (só você pode fornecer)` : 'nenhuma'} />
                <KeyValue label="Paralelizável" value={plan.parallelizable ? 'sim' : 'não'} />
                <KeyValue label="Custo" value={COST_LABELS[plan.cost?.status] ?? plan.cost?.status} />
                <KeyValue label="Licenças" value={plan.licenses?.length ? plan.licenses.join(', ') : null} />
                <KeyValue label="Gates de revisão" value={plan.reviewGates?.length ? plan.reviewGates.join(', ') : null} />
              </div>
              {plan.note ? <p className="forge-note"><Info size={13} strokeWidth={1.9} />{plan.note}</p> : null}
              <ol className="forge-steps">
                {plan.steps.map((step) => <PlanStepRow key={step.id} step={step} />)}
              </ol>
              {plan.userActions.length ? (
                <ul className="forge-list is-actions">
                  {plan.userActions.map((action, index) => (
                    <li key={`${action.stepId}-${index}`}>
                      <strong>{action.title}</strong> <em>{action.kind}</em>
                      <p>{action.detail}</p>
                      {action.candidates?.length ? (
                        <ul className="forge-list">
                          {action.candidates.map((candidate) => (
                            <li key={candidate.adapterId}><code>{candidate.adapterId}</code> <StateBadge state={candidate.state} /> {candidate.detail}</li>
                          ))}
                        </ul>
                      ) : null}
                      <span className="forge-badge is-review">você decide · não automatizável</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {busy === 'run' ? (
            <section className="panel forge-panel forge-live">
              <header className="forge-panel-head">
                <Activity size={15} strokeWidth={1.8} />
                <h2>4 · Execução em andamento</h2>
                <span className="forge-panel-tag">
                  {liveRun
                    ? `${Math.round(liveRun.summary?.progress ?? 0)}% · ${(liveRun.steps ?? []).filter((step) => step.state === 'succeeded').length}/${(liveRun.steps ?? []).length} passos`
                    : 'planejando…'}
                </span>
              </header>
              <div className="forge-progress"><span style={{ width: `${liveRun ? Math.max(4, Math.round(liveRun.summary?.progress ?? 0)) : 4}%` }} /></div>
              {liveRun?.steps?.length ? (
                <ul className="forge-live-steps">
                  {liveRun.steps.map((step) => (
                    <li key={step.id}>
                      <StateBadge state={step.state} label={RUN_STATE_LABELS[step.state] ?? step.state} />
                      <code>{step.id}</code>
                      <span>{step.title ?? step.adapter}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="forge-note">O plano está sendo montado e conferido contra o que existe nesta máquina.</p>
              )}
              <div className="forge-panel-actions">
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => handleCancelRun(liveRun?.runId ?? null, 'cancelado pelo usuário no Studio')}
                  disabled={busy === 'cancel' || !liveRun?.runId}
                >
                  {busy === 'cancel' ? <span className="spin" /> : <CircleAlert size={14} />} Cancelar execução
                </button>
                <p className="forge-note">
                  Cancelar para o passo no próximo ponto de verificação. Nada é apagado: o que já foi feito continua em disco e o run pode ser retomado.
                </p>
              </div>
            </section>
          ) : null}

          {run ? (
            <section className="panel forge-panel">
              <header className="forge-panel-head">
                <Activity size={15} strokeWidth={1.8} />
                <h2>4 · Execução</h2>
                <StateBadge state={run.status} label={RUN_STATE_LABELS[run.status] ?? run.status} />
                <span className="forge-panel-tag">{progress}% · {run.summary?.finished ? 'encerrado' : 'em andamento'}</span>
              </header>
              <div className="forge-progress"><span style={{ width: `${progress}%` }} /></div>
              {run.error ? <div className="forge-banner is-error"><CircleAlert size={14} /><span>{run.error.message}</span></div> : null}
              <nav className="forge-tabs">
                {[['passos', 'Passos'], ['artefatos', 'Artefatos'], ['logs', 'Logs'], ['proveniência', 'Proveniência & custo'], ['gates', 'Gates']].map(([id, label]) => (
                  <button key={id} type="button" className={runTab === id ? 'is-active' : ''} onClick={() => setRunTab(id)}>{label}</button>
                ))}
              </nav>

              {runTab === 'passos' ? (
                <ol className="forge-steps">
                  {run.steps.map((step) => (
                    <RunStepRow
                      key={step.id}
                      step={step}
                      onReview={handleReview}
                      reviewBusy={busy === 'review'}
                      reviewNote={reviewNote}
                      setReviewNote={setReviewNote}
                    />
                  ))}
                </ol>
              ) : null}

              {runTab === 'artefatos' ? (
                <div className="forge-artifact-list">
                  {run.steps.flatMap((step) => (step.outputs ?? []).map((output) => ({ step: step.id, output }))).length === 0
                    ? <p className="forge-note">Nenhum artefato gravado neste run.</p>
                    : run.steps.flatMap((step) => (step.outputs ?? []).map((output) => (
                      <article key={output} className="forge-artifact">
                        <header>
                          <FileJson size={13} strokeWidth={1.9} />
                          <code>{output}</code>
                        </header>
                        {/\.(png|jpe?g|webp)$/i.test(output)
                          ? <RunArtifactImage path={output} alt={`Artefato ${output}`} />
                          : null}
                        <p className="forge-note">passo {step}</p>
                      </article>
                    )))}
                </div>
              ) : null}

              {runTab === 'logs' ? (
                <div className="forge-logs">
                  {timelineFor(run).map((entry, index) => (
                    <p key={index} className={`is-${entry.level}`}>
                      <Clock3 size={12} strokeWidth={2} />
                      <time>{entry.at?.slice(11, 23) ?? ''}</time>
                      <em>{entry.kind}</em>
                      <span>{entry.text}</span>
                    </p>
                  ))}
                  {!timelineFor(run).length ? <p className="forge-note">Sem eventos registrados.</p> : null}
                  <p className="forge-note">
                    <ShieldCheck size={13} strokeWidth={1.9} />
                    Segredos são redigidos antes de gravar: o que você vê aqui é o que ficou em disco.
                  </p>
                </div>
              ) : null}

              {runTab === 'proveniência' ? (
                <div className="forge-provenance">
                  <KeyValue label="Custo total" value={run.cost?.total ?? COST_LABELS[run.cost?.status] ?? run.cost?.status} />
                  {run.cost?.note ? <p className="forge-note">{run.cost.note}</p> : null}
                  <ul className="forge-list">
                    {(run.provenance ?? []).map((entry) => (
                      <li key={entry.stepId}>
                        <strong>{entry.stepId}</strong> · <code>{entry.adapter}</code> v{entry.adapterVersion ?? '?'}
                        <br />
                        licença: {entry.license ?? 'não declarada'} · direitos da saída: {entry.outputRights ?? 'não declarado'}
                        {entry.sha256 ? <><br /><code className="forge-hash">{entry.sha256}</code></> : null}
                      </li>
                    ))}
                  </ul>
                  {!(run.provenance ?? []).length ? <p className="forge-note">Nada foi executado neste run.</p> : null}
                </div>
              ) : null}

              {runTab === 'gates' ? (
                <div className="forge-gates">
                  <ul className="forge-list">
                    {gates.map((gate, index) => (
                      <li key={index} className={gate.ok ? 'is-ok' : 'is-fail'}>
                        {gate.ok ? <Check size={13} strokeWidth={2.4} /> : <Lock size={13} strokeWidth={2.2} />}
                        <strong>{gate.gate}</strong> {gate.ok ? 'aprovado' : gate.code} — {gate.reason || 'sem motivo adicional'}
                        <time>{gate.at}</time>
                      </li>
                    ))}
                  </ul>
                  {!gates.length ? <p className="forge-note">Nenhum gate avaliado.</p> : null}
                  <p className="forge-note">
                    <ShieldCheck size={13} strokeWidth={1.9} />
                    Autorização por fingerprint, revisão ancorada em SHA-256, detecção de entrada alterada, redação de segredos e escrita atômica anti-symlink continuam valendo.
                  </p>
                </div>
              ) : null}

              <footer className="forge-run-footer">
                <button type="button" className="button button-primary" onClick={handleExport} disabled={busy === 'export' || run.status !== 'succeeded'}>
                  {busy === 'export' ? <span className="spin" /> : <Download size={14} />} Exportar para {destination}
                </button>
                <input
                  value={assetName}
                  onChange={(event) => setAssetName(event.target.value)}
                  placeholder="nome do asset para guardar o resultado"
                />
                <button type="button" className="button button-quiet" onClick={handleAttach} disabled={busy === 'attach' || !run.provenance?.length}>
                  {busy === 'attach' ? <span className="spin" /> : <Package size={14} />} Guardar no projeto
                </button>
                {runResumable ? (
                  <button type="button" className="button button-quiet" onClick={handleResumeRun} disabled={busy === 'resume'}>
                    {busy === 'resume' ? <span className="spin" /> : <RotateCcw size={14} />} Retomar do checkpoint
                  </button>
                ) : null}
                {run.status === 'running' ? (
                  <button type="button" className="button button-quiet" onClick={() => handleCancelRun(run.runId)} disabled={busy === 'cancel'}>
                    {busy === 'cancel' ? <span className="spin" /> : <CircleAlert size={14} />} {runStale ? 'Corrigir estado' : 'Cancelar'}
                  </button>
                ) : null}
              </footer>
              {run.status !== 'succeeded' ? (
                <p className="forge-note">A exportação libera quando o run conclui. Passos bloqueados existem para não entregar arquivo vazio como se fosse arte.</p>
              ) : null}

              {exportResult ? (
                <div className="forge-export">
                  <header>
                    <Box size={14} strokeWidth={1.9} />
                    <strong>{exportResult.bundle.label}</strong>
                    <span className="forge-badge is-unknown">
                      {exportResult.bundle.verifiedOnDestination ? 'verificado no destino' : 'import no destino não verificado'}
                    </span>
                  </header>
                  <div className="forge-plan-meta">
                    <KeyValue label="Arquivos" value={exportResult.bundle.files.length} />
                    <KeyValue label="FPS do destino" value={exportResult.bundle.profile.fps} />
                    <KeyValue label="Pivot" value={exportResult.bundle.profile.pivot} />
                    <KeyValue label="Manifesto" value={exportResult.path} mono />
                    {exportResult.bundle.compatibility?.summary ? (
                      <KeyValue
                        label="Composição"
                        value={`${exportResult.bundle.compatibility.summary.assets} asset(s) importáveis + ${exportResult.bundle.compatibility.summary.metadata} metadado(s)`}
                      />
                    ) : null}
                    {exportResult.bundle.evidence ? <KeyValue label="Evidência do destino" value={exportResult.bundle.evidence} /> : null}
                  </div>
                  {exportResult.bundle.compatibility ? (
                    <div className="forge-export-compat">
                      <span className={`forge-badge ${exportResult.bundle.compatibility.compatible ? 'is-ready' : 'is-blocked'}`}>
                        {exportResult.bundle.compatibility.compatible
                          ? 'compatível com o perfil publicado do destino'
                          : 'o destino não aceita o pacote como está'}
                      </span>
                      {exportResult.bundle.compatibility.blockers?.length ? (
                        <ul className="forge-list is-blockers">
                          {exportResult.bundle.compatibility.blockers.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      ) : null}
                      {exportResult.bundle.compatibility.conversionsNeeded?.length ? (
                        <ul className="forge-list is-blockers">
                          {exportResult.bundle.compatibility.conversionsNeeded.map((item) => (
                            <li key={`${item.id}-${item.to}`}>converter <code>{item.from}</code> → <code>{item.to}</code>: {item.reason}</li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="forge-note">
                        {exportResult.bundle.compatibility.compatible
                          ? 'Os metadados (manifesto da folha, rig, animações) acompanham o pacote: a engine não os importa, mas sem eles o destino não sabe a grade, o pivô nem o fps.'
                          : 'Nada é descartado em silêncio: o que o destino não aceita está listado acima e continua no pacote.'}
                      </p>
                    </div>
                  ) : null}
                  <ul className="forge-list">
                    {exportResult.bundle.files.map((file) => (
                      <li key={file.path ?? file.relativePath}>
                        <code>{file.relativePath ?? file.path}</code> {file.bytes ? `${file.bytes} B · ` : ''}
                        <span className="forge-hash">{file.sha256?.slice(0, 16)}…</span>
                      </li>
                    ))}
                  </ul>
                  {exportResult.bundle.notes?.length ? (
                    <ul className="forge-list">{exportResult.bundle.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}
          <ComparisonLab
            candidates={compareCandidates}
            entries={inputs}
            runs={runs}
            busy={busy}
            comparison={comparison}
            onToggle={handleToggleCompare}
            onRemove={(path) => { setCompareCandidates((current) => current.filter((item) => item.path !== path)); setComparison(null); }}
            onCompare={handleCompare}
            onAddRun={handleAddRunToCompare}
            onRegister={handleRegisterVersion}
            registered={registeredVersion}
          />
        </div>

        <aside className="forge-side">
          <ProjectPanel
            project={project}
            busy={busy}
            transport={liaForgeApi.transport}
            onChoose={handleChooseProject}
            onReveal={handleRevealProject}
            onRefresh={handleRefreshProject}
          />
          <MachinePanel machine={overview.machine} note={overview.note} />
          <ProvidersPanel providers={providers ?? overview.providers} busy={busy} onConfigure={handleConfigureProvider} />
          <ToolsPanel adapters={overview.adapters} preflight={overview.preflight} />
          <RightsPanel rights={overview.rights} assets={overview.assets} onDeclare={handleDeclare} busy={busy} />
          <section className="panel forge-panel forge-assistant">
            <header className="forge-panel-head">
              <CircleHelp size={15} strokeWidth={1.8} />
              <h2>Assistente Lia</h2>
            </header>
            <p>
              {run
                ? run.status === 'succeeded'
                  ? 'Deu certo. Confira as abas de artefatos e proveniência; se estiver tudo como você imaginou, exporte e guarde no projeto.'
                  : run.status === 'blocked'
                    ? 'Parou de propósito: um passo precisa do seu olhar. Aprove quando estiver bom — a decisão fica amarrada ao hash do arquivo.'
                    : 'Não concluiu. O motivo está no passo em vermelho; nada foi inventado para parecer pronto.'
                : plan
                  ? 'Plano na tela: leia os candidatos e as licenças antes de executar. Planejar não gasta nada nem toca em ferramenta externa.'
                  : 'Escolha um objetivo, descreva em uma frase e mande planejar. Se faltar ferramenta, eu digo qual e o que só você pode decidir.'}
            </p>
            <ul className="forge-list">
              <li><Gauge size={12} strokeWidth={2} /> Capacidades: {overview.capabilities.length} em {new Set(overview.capabilities.map((item) => item.family)).size} famílias</li>
              <li><ImageIcon size={12} strokeWidth={2} /> Destinos: {overview.destinations.map((item) => item.id).join(', ')}</li>
              <li><Layers3 size={12} strokeWidth={2} /> Contrato do spritesheet humanoide: 384×144, grade 8×3, 24 frames de 48×48</li>
            </ul>
          </section>
          <section className="panel forge-panel">
            <header className="forge-panel-head">
              <HardDrive size={15} strokeWidth={1.8} />
              <h2>Runs gravados</h2>
              <span className="forge-panel-tag">.lia-forge/runs</span>
            </header>
            <ul className="forge-list is-runs">
              {runs.map((item) => (
                <SavedRunItem
                  key={item.runId}
                  item={item}
                  currentRunId={run?.runId ?? null}
                  busy={busy}
                  onOpen={handleOpenRun}
                  onRecover={handleRecoverRun}
                  onResume={handleResumeListedRun}
                />
              ))}
              {!runs.length ? <li className="forge-note">Nenhum run gravado neste projeto ainda.</li> : null}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
