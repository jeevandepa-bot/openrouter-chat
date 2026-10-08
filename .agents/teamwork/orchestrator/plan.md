# Orchestration Plan — Cloud Coding AI Agent

## 1. Survey Phase
- Spawn 3 Explorers / Spec Miners to investigate:
  1. Explorer 1: Project structure, package.json, framework (Next.js), existing components, routing, UI system.
  2. Explorer 2: GitHub API integration mechanisms (Octokit / fetch, token handling, repo CRUD, file CRUD) and Vercel AI SDK integration.
  3. Explorer 3: WebContainers integration requirements, headers (COOP / COEP), iframe/worker constraints, terminal/preview components.

## 2. Decomposition Phase
- Synthesize survey findings into `PROJECT.md`.
- Establish Feature Inventory:
  - F1: GitHub Token management & GitHub API service (List, Read, Modify, Create repos & files).
  - F2: In-browser WebContainer runner & terminal/preview UI with Cross-Origin Isolation headers.
  - F3: Vercel AI SDK integration with autonomous tools (GitHub tools + WebContainer execution tools).
  - F4: Mobile-first chat & workspace interface integrating chat, file tree, code editor, terminal, live preview.
  - F5: E2E verification test suite (GitHub verification, WebContainer verification, Full agent workflow).
- Establish milestone boundaries and interface contracts.

## 3. Dual Track Execution Phase
- E2E Testing Track: Build comprehensive test runner and test suite (Tiers 1-4).
- Implementation Track: Sequential/parallel milestones to build modules.
- Verification Gates: Explorer -> Worker -> Reviewers (2) -> Challengers (2) -> Auditor (1).

## 4. Final Milestone & Acceptance
- Pass 100% of E2E tests.
- Verify Acceptance Criteria (GitHub repo creation/file write, WebContainer server boot/fetch, Agent autonomous workflow).
- Final Victory Audit and handoff to Sentinel.
