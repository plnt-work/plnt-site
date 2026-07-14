export type StepStatus = 'pending' | 'running' | 'done' | 'failed';

export interface WorkflowStep {
  id: string;
  label: string;
  tool: string;
  deps: string[];
  approxMs: number;
}

export interface WorkflowBackend {
  id: string;
  label: string;
  cluster: string;
  region: string;
  kind: 'hosted-proxy' | 'k8s-gpu' | 'kind-local';
  upstream: string;
  status: 'ready' | 'busy' | 'kind' | 'hosted';
}

export interface Workflow {
  id: string;
  name: string;
  version: string;
  category: 'reviews' | 'content' | 'bookings' | 'analytics';
  description: string;
  briefing: string;
  steps: WorkflowStep[];
  runtime: {
    image: string;
    entrypoint: string;
  };
  requirements: {
    gpuClass: string;
    gpuCount: number;
    memoryGiB: number;
  };
  compatibleBackends: string[];
  defaultBackend: string;
  chartVersion: string;
  workflowRun: string;
  endpoint: string;
  spec: string;
  crd: string;
  samplePrompt: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  ts: number;
}

export type ConnectionState = 'live' | 'stub' | 'checking';

export interface StepRun {
  stepId: string;
  status: StepStatus;
  startedAt?: number;
  finishedAt?: number;
}
