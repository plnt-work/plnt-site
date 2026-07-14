import type { ChatMessage, Workflow } from './types';

const ENV_ENDPOINT =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.PUBLIC_PLNT_ENDPOINT) || '';

// Default to the deployed backend in production if no explicit override was set.
const DEFAULT_ENDPOINT = 'https://playground.plnt.work';

const ENDPOINT = ENV_ENDPOINT || DEFAULT_ENDPOINT;

const STUB_REPLIES: Record<string, string[]> = {
  'review-responder': [
    'Draft reply: "Thanks for the honest feedback — a 40-minute wait even with a reservation isn\'t the standard we hold ourselves to. I\'ve shared this with our floor manager, and we\'d love the chance to make it right. If you\'re open to it, please reach out directly and we\'ll set aside a table with a manager greeting for your next visit."\n\n(stub reply — wire PUBLIC_PLNT_ENDPOINT to a live backend to see the real model.)',
  ],
  'post-generator': [
    'Draft post: "☕ New this Monday — the Maple Cortado is landing on the menu. Roasted, pulled, and topped with a whisper of maple. First 20 orders on Monday morning get it on the house. See you at 7am."\n\n(stub reply — configure PUBLIC_PLNT_ENDPOINT to hit a live model.)',
  ],
  'booking-triage': [
    'Draft reply: "Hi! Absolutely — we can host 5 with gluten-free options. Friday 7pm is booked but I have 7:15pm or 8:30pm open. Saturday I can offer 6:45pm, 7:30pm, or 8:45pm. Which works best? I\'ll flag the kitchen for GF prep."\n\n(stub reply — configure PUBLIC_PLNT_ENDPOINT to hit a live model.)',
  ],
  'competitor-monitor': [
    'Notable diffs vs baseline:\n• +11 reviews in the last cycle (0.15/day, up from 0.09) — check for a recent event or press mention\n• Rating slid 4.6★ → 4.5★ across new reviews — sentiment is worth sampling\n• 3-week posting gap — content-cadence weakness you could exploit\n\n(stub reply — wire the endpoint to a live model to run the real extractor.)',
  ],
};

let stubIndex = 0;

function stubReply(workflow: Workflow): string {
  const pool = STUB_REPLIES[workflow.id] || ['Stub reply. No live endpoint configured.'];
  const r = pool[stubIndex % pool.length];
  stubIndex += 1;
  return r;
}

export function currentEndpoint(): string {
  return ENDPOINT;
}

export interface ChatResult {
  reply: string;
  live: boolean;
  latencyMs: number;
}

export async function sendChat(
  workflow: Workflow,
  history: ChatMessage[],
): Promise<ChatResult> {
  const start = performance.now();
  const url = `${ENDPOINT.replace(/\/$/, '')}/v1/chat/completions`;
  const body = {
    model: workflow.id,
    messages: history
      .filter((m) => m.role !== 'system' || m.content)
      .map(({ role, content }) => ({ role, content })),
    stream: false,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const reply =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      '(empty response)';
    return { reply, live: true, latencyMs: performance.now() - start };
  } catch {
    // Backend unreachable or errored — degrade to a canned stub reply so the UI keeps working.
    await new Promise((res) => setTimeout(res, 250));
    return { reply: stubReply(workflow), live: false, latencyMs: performance.now() - start };
  }
}

export interface LiveModel {
  id: string;
  ownedBy?: string;
}

export async function fetchLiveModels(): Promise<LiveModel[] | null> {
  try {
    const res = await fetch(`${ENDPOINT.replace(/\/$/, '')}/v1/models`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const items = Array.isArray(data?.data) ? data.data : [];
    return items.map((m: any) => ({ id: String(m.id), ownedBy: m.owned_by }));
  } catch {
    return null;
  }
}
