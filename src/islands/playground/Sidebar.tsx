import type { Workflow, WorkflowBackend } from './types';
import { WORKFLOWS, BACKENDS, CATEGORY_LABEL } from './models';

interface Props {
  workflow: Workflow;
  backend: WorkflowBackend;
  onSelectWorkflow: (id: string) => void;
  onSelectBackend: (id: string) => void;
  onStart: () => void;
}

export default function Sidebar({ workflow, backend, onSelectWorkflow, onSelectBackend, onStart }: Props) {
  const compatibleBackends = BACKENDS.filter((b) => workflow.compatibleBackends.includes(b.id));
  const registryRef = `microagents/${workflow.name}@${workflow.version}`;
  const runnerImage = workflow.runtime.image.split('/').pop() || workflow.runtime.image;

  return (
    <aside class="pg-sidebar">
      <div class="pg-sidebar-inner">
        <div class="pg-block">
          <div class="pg-label">Workflow</div>
          <select
            class="pg-model-select"
            value={workflow.id}
            onChange={(e) => onSelectWorkflow((e.currentTarget as HTMLSelectElement).value)}
            aria-label="Micro-agent workflow"
          >
            {WORKFLOWS.map((w) => (
              <option value={w.id}>{w.name}</option>
            ))}
          </select>
          <div class="pg-sub">{CATEGORY_LABEL[workflow.category]} · v{workflow.version} · {workflow.steps.length} steps</div>
        </div>

        <p class="pg-desc">{workflow.description}</p>

        <div class="pg-block">
          <div class="pg-label">Backend</div>
          <select
            class="pg-variant-select"
            value={backend.id}
            onChange={(e) => onSelectBackend((e.currentTarget as HTMLSelectElement).value)}
            aria-label="Deployment backend"
          >
            {compatibleBackends.map((b) => (
              <option value={b.id}>{b.label} · {b.status}</option>
            ))}
          </select>
          <div class="pg-sub">{backend.cluster} · {backend.upstream}</div>
        </div>

        <button class="pg-cta" onClick={onStart}>
          Invoke workflow <span class="pg-cta-arrow">→</span>
        </button>

        <div class="pg-arch-block">
          <div class="pg-label">Architecture</div>
          <div class="pg-arch-rows">
            <div class="pg-arch-row">
              <div class="pg-arch-key">Runtime</div>
              <div class="pg-arch-val pg-mono">{runnerImage}</div>
            </div>
            <div class="pg-arch-row">
              <div class="pg-arch-key">Registry</div>
              <div class="pg-arch-val pg-mono">{registryRef}</div>
            </div>
            <div class="pg-arch-row">
              <div class="pg-arch-key">Backend</div>
              <div class="pg-arch-val pg-mono">{backend.label}</div>
            </div>
          </div>
        </div>

        <p class="pg-footnote">
          Sessions live in memory — refresh clears them.
          Point clients at your own plnt endpoint via <code>PUBLIC_PLNT_ENDPOINT</code>.
          The <a href="#" onClick={(e) => { e.preventDefault(); }}>Manifest</a> tab shows the WorkflowRun spec for a self-hosted GPU deploy.
        </p>
      </div>
    </aside>
  );
}
