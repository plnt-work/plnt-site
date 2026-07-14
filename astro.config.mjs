// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import preact from '@astrojs/preact';

export default defineConfig({
  site: 'https://plnt.work',
  integrations: [
    preact({ compat: false }),
    starlight({
      title: 'plnt docs',
      tagline: 'Orchestration runtime for agentic workflows',
      logo: { src: './src/assets/logo-mono.svg', replacesTitle: false },
      favicon: '/favicon.svg',
      customCss: [
        './src/styles/starlight-overrides.css',
      ],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/plnt-work/plnt' },
      ],
      disable404Route: true,
      pagination: true,
      sidebar: [
        {
          label: 'Getting started',
          items: [
            { label: 'Overview', slug: 'docs/getting-started/overview' },
            { label: 'Quickstart', slug: 'docs/getting-started/quickstart' },
            { label: 'Local dev', slug: 'docs/getting-started/local-dev' },
          ],
        },
        {
          label: 'Concepts',
          items: [
            { label: 'Architecture', slug: 'docs/concepts/architecture' },
            { label: 'WorkflowRun CRD', slug: 'docs/concepts/workflowrun' },
            { label: 'Orchestration saga', slug: 'docs/concepts/deploy-saga' },
            { label: 'Runtime adapter', slug: 'docs/concepts/runtime-adapter' },
            { label: 'Playground API', slug: 'docs/concepts/playground-api' },
            { label: 'Glossary', slug: 'docs/concepts/glossary' },
          ],
        },
        {
          label: 'Operations',
          items: [
            { label: 'Kind demo', slug: 'docs/operations/kind-demo' },
            { label: 'DigitalOcean K8s', slug: 'docs/operations/do-k8s' },
            { label: 'Fly.io (API only)', slug: 'docs/operations/fly-io' },
            { label: 'CI/CD', slug: 'docs/operations/ci-cd' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'API contract', slug: 'docs/reference/api-contract' },
            { label: 'WorkflowRun schema', slug: 'docs/reference/workflowrun-crd' },
          ],
        },
      ],
    }),
    sitemap(),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
});
