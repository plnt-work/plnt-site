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
            aria-label="GPU backend cluster"
          >
            {compatibleBackends.map((b) => (
              <option value={b.id}>{b.label} · {b.status}</option>
            ))}
          </select>
          <div class="pg-sub">{backend.cluster} · {backend.gpuAvailable} {backend.gpuClass.replace('nvidia.com/', '')} free</div>
        </div>

        <button class="pg-cta" onClick={onStart}>
          Invoke workflow <span class="pg-cta-arrow">→</span>
        </button>

        <dl class="pg-meta">
          <div><dt>Runtime</dt><dd class="pg-mono">{workflow.runtime.image.split('/').pop()}</dd></div>
          <div><dt>GPU</dt><dd>{workflow.requirements.gpuCount}× {workflow.requirements.gpuClass.replace('nvidia.com/', '')}</dd></div>
          <div><dt>Memory</dt><dd>{workflow.requirements.memoryGiB} GiB</dd></div>
          <div><dt>Chart</dt><dd class="pg-mono">{workflow.chartVersion}</dd></div>
          <div><dt>Run ID</dt><dd class="pg-mono">{workflow.workflowRun}</dd></div>
        </dl>

        <p class="pg-footnote">
          Sessions live in memory — refresh clears them.
          Point clients at your own plnt endpoint via <code>PUBLIC_PLNT_ENDPOINT</code>.
        </p>
      </div>
    </aside>
  );
}
