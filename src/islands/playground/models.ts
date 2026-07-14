import type { Workflow, WorkflowBackend } from './types';

const REVIEW_RESPONDER_SPEC = `apiVersion: microagents.dev/v1
kind: Workflow
metadata:
  name: review-responder
  version: 1.2.0
spec:
  description: Draft an on-brand reply to a Google Maps review.
  runtime:
    image: ghcr.io/microagents/runner:0.4.0
    entrypoint: python -m review_responder
  steps:
    - id: classify_intent
      tool: llm.classify
    - id: retrieve_brand_voice
      tool: rag.query
      deps: [classify_intent]
    - id: draft_reply
      tool: llm.generate
      deps: [retrieve_brand_voice]
    - id: safety_check
      tool: policy.moderate
      deps: [draft_reply]
  requirements:
    gpuClass: nvidia.com/h100
    gpuCount: 2
    memoryGiB: 40
`;

const REVIEW_RESPONDER_CRD = `apiVersion: plnt.work/v1
kind: WorkflowRun
metadata:
  name: review-responder
spec:
  workflow:
    ref: review-responder@1.2.0
    registry: s3://microagents
  backend:
    cluster: gpu-cluster-01
    gpuClass: nvidia.com/h100
    gpuCount: 2
  replicas: { min: 1, max: 4 }
  canary:
    trafficPercent: 5
    smokeTest: { invocations: 10, p95BudgetMs: 2500 }
`;

const POST_GENERATOR_SPEC = `apiVersion: microagents.dev/v1
kind: Workflow
metadata:
  name: post-generator
  version: 0.9.1
spec:
  description: Draft a weekly Google Maps Post with image prompt.
  runtime:
    image: ghcr.io/microagents/runner:0.4.0
    entrypoint: python -m post_generator
  steps:
    - id: pick_topic
      tool: llm.plan
    - id: draft_copy
      tool: llm.generate
      deps: [pick_topic]
    - id: image_prompt
      tool: llm.generate
      deps: [pick_topic]
  requirements:
    gpuClass: nvidia.com/h100
    gpuCount: 1
    memoryGiB: 24
`;

const POST_GENERATOR_CRD = `apiVersion: plnt.work/v1
kind: WorkflowRun
metadata:
  name: post-generator
spec:
  workflow: { ref: post-generator@0.9.1, registry: s3://microagents }
  backend: { cluster: gpu-cluster-02, gpuClass: nvidia.com/h100, gpuCount: 1 }
  replicas: { min: 1, max: 2 }
`;

const BOOKING_TRIAGE_SPEC = `apiVersion: microagents.dev/v1
kind: Workflow
metadata:
  name: booking-triage
  version: 0.7.3
spec:
  description: Classify inbound booking inquiries, check calendar, propose slots.
  runtime:
    image: ghcr.io/microagents/runner:0.4.0
    entrypoint: python -m booking_triage
  steps:
    - id: parse_inquiry
      tool: llm.extract
    - id: check_calendar
      tool: gcal.freebusy
      deps: [parse_inquiry]
    - id: draft_reply
      tool: llm.generate
      deps: [check_calendar]
  requirements:
    gpuClass: nvidia.com/a100
    gpuCount: 1
    memoryGiB: 16
`;

const BOOKING_TRIAGE_CRD = `apiVersion: plnt.work/v1
kind: WorkflowRun
metadata:
  name: booking-triage
spec:
  workflow: { ref: booking-triage@0.7.3, registry: s3://microagents }
  backend: { cluster: gpu-cluster-01, gpuClass: nvidia.com/a100, gpuCount: 1 }
  replicas: { min: 1, max: 3 }
`;

const COMPETITOR_MONITOR_SPEC = `apiVersion: microagents.dev/v1
kind: Workflow
metadata:
  name: competitor-monitor
  version: 0.5.2
spec:
  description: Pull competitor Maps data, extract diffs, flag opportunities.
  runtime:
    image: ghcr.io/microagents/runner:0.4.0
    entrypoint: python -m competitor_monitor
  steps:
    - id: fetch_snapshot
      tool: gbp.scrape
    - id: extract_signals
      tool: llm.extract
      deps: [fetch_snapshot]
    - id: compare_baseline
      tool: db.query
      deps: [extract_signals]
    - id: alert_owner
      tool: notify.push
      deps: [compare_baseline]
  requirements:
    gpuClass: nvidia.com/h100
    gpuCount: 2
    memoryGiB: 32
`;

const COMPETITOR_MONITOR_CRD = `apiVersion: plnt.work/v1
kind: WorkflowRun
metadata:
  name: competitor-monitor
spec:
  workflow: { ref: competitor-monitor@0.5.2, registry: s3://microagents }
  backend: { cluster: gpu-cluster-01, gpuClass: nvidia.com/h100, gpuCount: 2 }
  replicas: { min: 1, max: 2 }
`;

export const BACKENDS: WorkflowBackend[] = [
  {
    id: 'hosted-proxy',
    label: 'hosted-proxy',
    cluster: 'DO App Platform · nyc',
    region: 'nyc',
    kind: 'hosted-proxy',
    upstream: 'gpt-4o-mini via OpenAI-compat',
    status: 'hosted',
  },
  {
    id: 'kind-local',
    label: 'kind-local',
    cluster: 'localhost · kind',
    region: 'laptop',
    kind: 'kind-local',
    upstream: 'CPU stub, no LLM',
    status: 'kind',
  },
];

export const WORKFLOWS: Workflow[] = [
  {
    id: 'review-responder',
    name: 'review-responder',
    version: '1.2.0',
    category: 'reviews',
    description:
      'Drafts on-brand replies to Google Maps reviews. Four-step DAG: classify → retrieve brand voice → draft → moderate.',
    briefing:
      'The review-responder workflow is the flagship recipe from the microagents registry. Given a review payload, it classifies sentiment and topic, retrieves the merchant\'s brand voice from a small RAG index, drafts a reply, and passes it through a policy check. Typical end-to-end latency: ~1.1s. In the playground, plnt orchestrates the same DAG against a live model endpoint.',
    steps: [
      { id: 'classify_intent',      label: 'Classify sentiment + topic',       tool: 'llm.classify',  deps: [],                     approxMs: 240 },
      { id: 'retrieve_brand_voice', label: 'Retrieve brand voice from RAG',    tool: 'rag.query',     deps: ['classify_intent'],    approxMs: 320 },
      { id: 'draft_reply',          label: 'Draft the reply',                  tool: 'llm.generate',  deps: ['retrieve_brand_voice'], approxMs: 460 },
      { id: 'safety_check',         label: 'Moderate against policy',          tool: 'policy.moderate', deps: ['draft_reply'],      approxMs: 120 },
    ],
    runtime: {
      image: 'ghcr.io/microagents/runner:0.4.0',
      entrypoint: 'python -m review_responder',
    },
    requirements: { gpuClass: 'nvidia.com/h100', gpuCount: 2, memoryGiB: 40 },
    compatibleBackends: ['hosted-proxy', 'kind-local'],
    defaultBackend: 'hosted-proxy',
    chartVersion: 'workflow-runner-0.3.1',
    workflowRun: 'r-9c4f218e0a',
    endpoint: 'https://playground.plnt.work/v1/chat/completions',
    spec: REVIEW_RESPONDER_SPEC,
    crd: REVIEW_RESPONDER_CRD,
    samplePrompt: 'A 2-star review: "Waited 40 minutes for a table even with a reservation. Food was fine but service felt overwhelmed." Draft an on-brand reply.',
  },
  {
    id: 'post-generator',
    name: 'post-generator',
    version: '0.9.1',
    category: 'content',
    description:
      'Drafts weekly Google Maps Posts with image prompts. Three-step DAG: pick topic → draft copy → image prompt.',
    briefing:
      'post-generator produces a scheduled weekly post: topic suggestion tuned to the season + local events, copy in the merchant\'s voice, and a matching image prompt. Typical end-to-end latency: ~0.9s. Ideal for a low-cadence content workflow that a small business would set-and-forget.',
    steps: [
      { id: 'pick_topic',   label: 'Pick a topic',              tool: 'llm.plan',     deps: [],             approxMs: 380 },
      { id: 'draft_copy',   label: 'Draft the post copy',       tool: 'llm.generate', deps: ['pick_topic'], approxMs: 420 },
      { id: 'image_prompt', label: 'Generate image prompt',     tool: 'llm.generate', deps: ['pick_topic'], approxMs: 260 },
    ],
    runtime: {
      image: 'ghcr.io/microagents/runner:0.4.0',
      entrypoint: 'python -m post_generator',
    },
    requirements: { gpuClass: 'nvidia.com/h100', gpuCount: 1, memoryGiB: 24 },
    compatibleBackends: ['hosted-proxy', 'kind-local'],
    defaultBackend: 'hosted-proxy',
    chartVersion: 'workflow-runner-0.3.1',
    workflowRun: 'r-88fe0c3b2d',
    endpoint: 'https://playground.plnt.work/v1/chat/completions',
    spec: POST_GENERATOR_SPEC,
    crd: POST_GENERATOR_CRD,
    samplePrompt: 'Draft a Google Maps Post for a coffee shop announcing a new seasonal drink launching next Monday. Cheerful, under 80 words.',
  },
  {
    id: 'booking-triage',
    name: 'booking-triage',
    version: '0.7.3',
    category: 'bookings',
    description:
      'Classifies inbound booking inquiries, checks the calendar, drafts a reply with proposed slots.',
    briefing:
      'booking-triage handles the DM/email volume small businesses drown in. It parses the inquiry (party size, date preferences, dietary notes), checks Google Calendar free/busy, and drafts a reply offering the best available slots. Typical end-to-end latency: ~0.8s.',
    steps: [
      { id: 'parse_inquiry',  label: 'Parse inquiry payload', tool: 'llm.extract',  deps: [],                approxMs: 220 },
      { id: 'check_calendar', label: 'Query calendar freebusy', tool: 'gcal.freebusy', deps: ['parse_inquiry'], approxMs: 340 },
      { id: 'draft_reply',    label: 'Draft reply with slots', tool: 'llm.generate', deps: ['check_calendar'], approxMs: 380 },
    ],
    runtime: {
      image: 'ghcr.io/microagents/runner:0.4.0',
      entrypoint: 'python -m booking_triage',
    },
    requirements: { gpuClass: 'nvidia.com/a100', gpuCount: 1, memoryGiB: 16 },
    compatibleBackends: ['hosted-proxy', 'kind-local'],
    defaultBackend: 'hosted-proxy',
    chartVersion: 'workflow-runner-0.3.1',
    workflowRun: 'r-4d8b2e9017',
    endpoint: 'https://playground.plnt.work/v1/chat/completions',
    spec: BOOKING_TRIAGE_SPEC,
    crd: BOOKING_TRIAGE_CRD,
    samplePrompt: 'Booking inquiry: "Hi, would love to book a table for 5 people, gluten-free, next Friday around 7pm if possible. Or Saturday works too." Draft a reply.',
  },
  {
    id: 'competitor-monitor',
    name: 'competitor-monitor',
    version: '0.5.2',
    category: 'analytics',
    description:
      'Pulls competitor Google Maps data, extracts diffs, flags opportunities. Four-step DAG with a scheduled trigger.',
    briefing:
      'competitor-monitor runs on a schedule (default hourly). It scrapes a set of competitor Maps profiles, extracts signals (new posts, review velocity, price changes), compares to the baseline in the tenant DB, and pushes an alert if something notable changes. Typical end-to-end latency: ~1.4s per competitor.',
    steps: [
      { id: 'fetch_snapshot',   label: 'Fetch competitor snapshot',   tool: 'gbp.scrape',   deps: [],                    approxMs: 480 },
      { id: 'extract_signals',  label: 'Extract structured signals',  tool: 'llm.extract',  deps: ['fetch_snapshot'],     approxMs: 360 },
      { id: 'compare_baseline', label: 'Diff against baseline',       tool: 'db.query',     deps: ['extract_signals'],   approxMs: 160 },
      { id: 'alert_owner',      label: 'Push alert on notable diff',  tool: 'notify.push',  deps: ['compare_baseline'],  approxMs: 90 },
    ],
    runtime: {
      image: 'ghcr.io/microagents/runner:0.4.0',
      entrypoint: 'python -m competitor_monitor',
    },
    requirements: { gpuClass: 'nvidia.com/h100', gpuCount: 2, memoryGiB: 32 },
    compatibleBackends: ['hosted-proxy', 'kind-local'],
    defaultBackend: 'hosted-proxy',
    chartVersion: 'workflow-runner-0.3.1',
    workflowRun: 'r-71a2f04c1e',
    endpoint: 'https://playground.plnt.work/v1/chat/completions',
    spec: COMPETITOR_MONITOR_SPEC,
    crd: COMPETITOR_MONITOR_CRD,
    samplePrompt: 'Baseline: competitor "Blue Bottle SoHo" — 4.6★, 812 reviews, posts weekly. Latest scrape: 4.5★, 823 reviews, no new post in 3 weeks. Report notable diffs.',
  },
];

export const CATEGORY_LABEL: Record<string, string> = {
  reviews: 'Reviews',
  content: 'Content',
  bookings: 'Bookings',
  analytics: 'Analytics',
};
