import { useEffect, useState } from 'preact/hooks';
import type { ChatMessage, ConnectionState, Workflow, WorkflowBackend, StepRun } from './types';
import { CATEGORY_LABEL } from './models';
import ChatPanel from './ChatPanel';

type Tab = 'briefing' | 'invoke' | 'orchestration' | 'manifest' | 'logs';

interface Props {
  workflow: Workflow;
  backend: WorkflowBackend;
  messages: ChatMessage[];
  setMessages: (m: ChatMessage[]) => void;
  connection: ConnectionState;
  setConnection: (c: ConnectionState) => void;
  sessionStartedAt: number;
  onRestart: () => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'briefing', label: 'Briefing' },
  { id: 'invoke', label: 'Invoke' },
  { id: 'orchestration', label: 'Orchestration' },
  { id: 'manifest', label: 'Manifest' },
  { id: 'logs', label: 'Logs' },
];

function fmtElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function MainPane({
  workflow,
  backend,
  messages,
  setMessages,
  connection,
  setConnection,
  sessionStartedAt,
  onRestart,
}: Props) {
  const [tab, setTab] = useState<Tab>('invoke');
  const [now, setNow] = useState(Date.now());
  const [stepRuns, setStepRuns] = useState<StepRun[]>([]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setStepRuns([]);
  }, [workflow.id, backend.id]);

  const userMessages = messages.filter((m) => m.role === 'user').length;

  return (
    <section class="pg-main">
      <header class="pg-header">
        <div>
          <h1 class="pg-title">{workflow.name}<span class="pg-title-ver">@{workflow.version}</span></h1>
          <p class="pg-header-desc">{workflow.description}</p>
        </div>
        <div class="pg-header-right">
          <span class="pg-stat">{userMessages} invocation{userMessages === 1 ? '' : 's'}</span>
          <span class="pg-stat">{fmtElapsed(now - sessionStartedAt)}</span>
          <button class="pg-restart" onClick={onRestart}>Restart</button>
        </div>
      </header>

      <nav class="pg-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            role="tab"
            class={`pg-tab ${tab === t.id ? 'pg-tab-active' : ''}`}
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div class="pg-body">
        {tab === 'briefing' && <BriefingTab workflow={workflow} backend={backend} />}
        {tab === 'invoke' && (
          <ChatPanel
            workflow={workflow}
            backend={backend}
            messages={messages}
            setMessages={setMessages}
            connection={connection}
            setConnection={setConnection}
            onInvoke={setStepRuns}
          />
        )}
        {tab === 'orchestration' && <OrchestrationTab workflow={workflow} backend={backend} stepRuns={stepRuns} />}
        {tab === 'manifest' && <ManifestTab workflow={workflow} />}
        {tab === 'logs' && <LogsTab workflow={workflow} />}
      </div>
    </section>
  );
}

function BriefingTab({ workflow, backend }: { workflow: Workflow; backend: WorkflowBackend }) {
  return (
    <div class="pg-prose">
      <p>{workflow.briefing}</p>
      <dl class="pg-brief-list">
        <div><dt>Category</dt><dd>{CATEGORY_LABEL[workflow.category]}</dd></div>
        <div><dt>Version</dt><dd>{workflow.version}</dd></div>
        <div><dt>Steps</dt><dd>{workflow.steps.length}</dd></div>
        <div><dt>Backend</dt><dd>{backend.label} <span class="pg-dim">({backend.cluster})</span></dd></div>
        <div><dt>GPU</dt><dd>{workflow.requirements.gpuCount}× {workflow.requirements.gpuClass.replace('nvidia.com/', '')}</dd></div>
        <div><dt>Memory</dt><dd>{workflow.requirements.memoryGiB} GiB</dd></div>
        <div><dt>Runtime image</dt><dd class="pg-mono">{workflow.runtime.image}</dd></div>
        <div><dt>Endpoint</dt><dd class="pg-mono">{workflow.endpoint}</dd></div>
      </dl>
    </div>
  );
}

function OrchestrationTab({ workflow, backend, stepRuns }: { workflow: Workflow; backend: WorkflowBackend; stepRuns: StepRun[] }) {
  const statusFor = (id: string) => stepRuns.find((r) => r.stepId === id)?.status ?? 'pending';
  const totalMs = workflow.steps.reduce((a, s) => a + s.approxMs, 0);
  const registryRef = `microagents/${workflow.name}@${workflow.version}`;
  const runnerImage = workflow.runtime.image.split('/').pop() || workflow.runtime.image;

  return (
    <div class="pg-orch">
      <div class="pg-orch-header">
        <div>
          <div class="pg-label">Step DAG</div>
          <p class="pg-orch-sub">
            {workflow.steps.length} steps · ~{totalMs}ms end-to-end. Runs live during an invocation.
          </p>
        </div>
        <span class={`pg-backend-badge pg-backend-${backend.status}`}>{backend.label} · {backend.status}</span>
      </div>

      <div class="pg-steps">
        {workflow.steps.map((s, idx) => {
          const status = statusFor(s.id);
          return (
            <div class={`pg-step pg-step-${status}`}>
              <div class="pg-step-idx">{String(idx + 1).padStart(2, '0')}</div>
              <div class="pg-step-body">
                <div class="pg-step-title">{s.label}</div>
                <div class="pg-step-meta">
                  <span class="pg-mono">{s.tool}</span>
                  {s.deps.length > 0 && (
                    <span class="pg-step-deps">deps: {s.deps.join(', ')}</span>
                  )}
                  <span class="pg-step-time">~{s.approxMs}ms</span>
                </div>
              </div>
              <div class={`pg-step-status pg-step-status-${status}`}>{status}</div>
            </div>
          );
        })}
      </div>

      <div class="pg-orch-footer">
        <div class="pg-orch-metric">
          <div class="pg-orch-metric-tag">01 · Runtime</div>
          <div class="pg-orch-metric-value">{runnerImage}</div>
          <div class="pg-orch-metric-sub">workflow runner image</div>
        </div>
        <div class="pg-orch-metric">
          <div class="pg-orch-metric-tag">02 · Registry</div>
          <div class="pg-orch-metric-value">{registryRef}</div>
          <div class="pg-orch-metric-sub">pulled from microagents</div>
        </div>
        <div class="pg-orch-metric">
          <div class="pg-orch-metric-tag">03 · Backend</div>
          <div class="pg-orch-metric-value">{backend.label}</div>
          <div class="pg-orch-metric-sub">{backend.cluster}</div>
        </div>
      </div>
    </div>
  );
}

function ManifestTab({ workflow }: { workflow: Workflow }) {
  return (
    <div class="pg-prose">
      <div class="pg-label">WorkflowRun (plnt CRD)</div>
      <pre class="pg-code">{workflow.crd}</pre>
      <div class="pg-label pg-mt">Workflow spec (microagents)</div>
      <pre class="pg-code">{workflow.spec}</pre>
    </div>
  );
}

function LogsTab({ workflow }: { workflow: Workflow }) {
  return (
    <div class="pg-prose">
      <p>
        No workflow runs recorded yet for this browser session. In a live deployment
        this streams events from the Temporal orchestration saga (<code>pull → resolve → helm → smoke → promote</code>)
        plus per-invocation step traces from the runner pod.
      </p>
      <p class="pg-dim">Tail with <code>plnt logs {workflow.name} --follow</code>.</p>
    </div>
  );
}
