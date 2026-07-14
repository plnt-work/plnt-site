import { useEffect, useRef, useState } from 'preact/hooks';
import type { ChatMessage, ConnectionState, Workflow, WorkflowBackend, StepRun } from './types';
import { sendChat } from './api';

interface Props {
  workflow: Workflow;
  backend: WorkflowBackend;
  messages: ChatMessage[];
  setMessages: (m: ChatMessage[]) => void;
  connection: ConnectionState;
  setConnection: (c: ConnectionState) => void;
  onInvoke: (runs: StepRun[]) => void;
}

function fmtTs(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function ChatPanel({
  workflow,
  backend,
  messages,
  setMessages,
  connection,
  setConnection,
  onInvoke,
}: Props) {
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages.length, pending]);

  async function submit() {
    const text = draft.trim();
    if (!text || pending) return;
    const userMsg: ChatMessage = { role: 'user', content: text, ts: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setDraft('');
    setPending(true);

    // simulate step timing so the Orchestration tab updates in real time
    const runs: StepRun[] = workflow.steps.map((s) => ({ stepId: s.id, status: 'pending' }));
    onInvoke(runs);
    let accumMs = 0;
    for (const step of workflow.steps) {
      const start = accumMs;
      accumMs += step.approxMs;
      setTimeout(() => {
        onInvoke(
          workflow.steps.map((s) => {
            if (s.id === step.id) return { stepId: s.id, status: 'running' };
            const idx = workflow.steps.findIndex((x) => x.id === s.id);
            const currentIdx = workflow.steps.findIndex((x) => x.id === step.id);
            if (idx < currentIdx) return { stepId: s.id, status: 'done' };
            return { stepId: s.id, status: 'pending' };
          }),
        );
      }, start);
    }
    setTimeout(() => {
      onInvoke(workflow.steps.map((s) => ({ stepId: s.id, status: 'done' })));
    }, accumMs);

    const res = await sendChat(workflow, next);
    setConnection(res.live ? 'live' : 'stub');
    setMessages([
      ...next,
      { role: 'assistant', content: res.reply, ts: Date.now() },
    ]);
    setPending(false);
  }

  function useSample() {
    setDraft(workflow.samplePrompt);
  }

  return (
    <div class="pg-chat">
      <div class="pg-messages" ref={scrollerRef}>
        {messages.map((m) => (
          <div class={`pg-msg pg-msg-${m.role}`}>
            <div class="pg-msg-meta">
              <span class="pg-msg-role">
                {m.role === 'user' ? 'input' : m.role === 'system' ? 'plnt' : `${workflow.name}`}
              </span>
              <span class="pg-msg-ts">{fmtTs(m.ts)}</span>
            </div>
            <div class="pg-msg-body">{m.content}</div>
          </div>
        ))}
        {pending && (
          <div class="pg-msg pg-msg-assistant">
            <div class="pg-msg-meta">
              <span class="pg-msg-role">{workflow.name}</span>
            </div>
            <div class="pg-typing"><span /><span /><span /></div>
          </div>
        )}
      </div>

      <form
        class="pg-composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          class="pg-input"
          placeholder={`Invocation payload for ${workflow.name} — try "${workflow.samplePrompt.slice(0, 60)}…"`}
          rows={3}
          value={draft}
          onInput={(e) => setDraft((e.currentTarget as HTMLTextAreaElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={pending}
        />
        <div class="pg-composer-foot">
          <span class="pg-conn">
            <span class={`pg-dot pg-dot-${connection}`} />
            {connection === 'live' ? `live · ${backend.label}` : connection === 'stub' ? `stub · ${backend.label}` : 'checking'}
          </span>
          <div class="pg-composer-actions">
            <button type="button" class="pg-sample" onClick={useSample} disabled={pending}>Use sample</button>
            <button type="submit" class="pg-send" disabled={pending || !draft.trim()}>
              Invoke →
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
