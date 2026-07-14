import { useEffect, useState } from 'preact/hooks';
import type { ChatMessage, ConnectionState } from './types';
import { WORKFLOWS, BACKENDS } from './models';
import { fetchLiveModels } from './api';
import Sidebar from './Sidebar';
import MainPane from './MainPane';

function welcomeMessage(name: string, backend: string): ChatMessage {
  return {
    role: 'system',
    ts: Date.now(),
    content:
      `Connected. Workflow "${name}" is deployed on ${backend}. ` +
      `Send an invocation payload below — plnt orchestrates the step DAG, then returns the final output. ` +
      `Watch the Orchestration tab for real-time step timing.`,
  };
}

export default function Playground() {
  const [workflowId, setWorkflowId] = useState(WORKFLOWS[0].id);
  const workflow = WORKFLOWS.find((w) => w.id === workflowId) ?? WORKFLOWS[0];
  const [backendId, setBackendId] = useState(workflow.defaultBackend);
  const backend = BACKENDS.find((b) => b.id === backendId) ?? BACKENDS[0];
  const [messages, setMessages] = useState<ChatMessage[]>([
    welcomeMessage(workflow.name, backend.label),
  ]);
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [sessionStartedAt, setSessionStartedAt] = useState<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const live = await fetchLiveModels();
      if (cancelled) return;
      setConnection(live && live.length > 0 ? 'live' : 'stub');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function selectWorkflow(id: string) {
    const next = WORKFLOWS.find((w) => w.id === id) ?? WORKFLOWS[0];
    setWorkflowId(next.id);
    setBackendId(next.defaultBackend);
    const nextBackend = BACKENDS.find((b) => b.id === next.defaultBackend) ?? BACKENDS[0];
    setMessages([welcomeMessage(next.name, nextBackend.label)]);
    setSessionStartedAt(Date.now());
  }

  function selectBackend(id: string) {
    setBackendId(id);
    const nextBackend = BACKENDS.find((b) => b.id === id) ?? BACKENDS[0];
    setMessages([welcomeMessage(workflow.name, nextBackend.label)]);
    setSessionStartedAt(Date.now());
  }

  function restart() {
    setMessages([welcomeMessage(workflow.name, backend.label)]);
    setSessionStartedAt(Date.now());
  }

  return (
    <div class="pg-shell">
      <Sidebar
        workflow={workflow}
        backend={backend}
        onSelectWorkflow={selectWorkflow}
        onSelectBackend={selectBackend}
        onStart={restart}
      />
      <MainPane
        workflow={workflow}
        backend={backend}
        messages={messages}
        setMessages={setMessages}
        connection={connection}
        setConnection={setConnection}
        sessionStartedAt={sessionStartedAt}
        onRestart={restart}
      />
    </div>
  );
}
