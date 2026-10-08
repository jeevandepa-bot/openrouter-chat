## 2026-10-08T08:42:30Z
You are the Worker for Milestone M4 (Mobile-First UI & Workspace Interface).
Your working directory is: c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\worker_m4
The project root is: c:\Users\Jeevan\Downloads\New folder\openrouter-chat
The original request is at: c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\ORIGINAL_REQUEST.md
The project plan is at: c:\Users\Jeevan\Downloads\New folder\openrouter-chat\PROJECT.md
Survey Explorer 1 report is at: c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\explorer_survey_1\handoff.md

You MUST read ORIGINAL_REQUEST.md, PROJECT.md, and the explorer survey report first.

Exclusive Write Ownership:
You own exclusively:
- src/app/page.tsx
- src/app/globals.css
- src/components/Header.tsx
- src/components/TabNavigation.tsx
- src/components/ChatPanel.tsx
- src/components/ToolCard.tsx
- src/components/CodeEditor.tsx
- src/components/Terminal.tsx
- src/components/Preview.tsx
- src/components/VerificationSuite.tsx
- src/components/SettingsModal.tsx
Do NOT modify files owned by other milestones.

Objective:
Implement Milestone M4:
1. Mobile-First Components (`src/components/`):
   - `Header.tsx`: Responsive header with branding, live status pills (WebContainer: Booting/Ready/Offline, GitHub: Connected/Not configured), and settings modal button.
   - `TabNavigation.tsx`: Segmented tab navigation (`[Chat, Code, Terminal, Preview, Verify]`) with touch-friendly buttons (>=44px height).
   - `ChatPanel.tsx`: Conversation message list rendering text and tool cards, prompt input with send button, quick prompt chips (including `"Create a repo called test and run a hello world script"`).
   - `ToolCard.tsx`: Collapsible cards for tool invocations displaying tool name, arguments, execution status, and results.
   - `CodeEditor.tsx`: Monospace code viewer/editor displaying sandbox virtual filesystem files.
   - `Terminal.tsx`: Streaming dark-mode terminal showing WebContainer command outputs, auto-scroll, clear button.
   - `Preview.tsx`: Responsive iframe preview with `credentialless="true"`, reload button, active port indicator, and external link button.
   - `VerificationSuite.tsx`: Interactive test suite UI with 1-click run buttons and step checkmarks for:
     - Acceptance Criterion 1: GitHub Verification (`runGitHubVerificationTest`)
     - Acceptance Criterion 2: Sandbox Verification (`runSandboxVerificationTest`)
     - Acceptance Criterion 3: Agent Workflow Verification (`runAgentWorkflowVerification`)
   - `SettingsModal.tsx`: Inputs for GitHub PAT (with eye toggle, sessionStorage/localStorage option), OpenRouter Key, and model selection.
2. Root Page Orchestrator (`src/app/page.tsx`):
   - Integrates `useChat` with `headers: { 'x-github-token': githubToken }`.
   - Intercepts `toolInvocations` for Sandbox client tools (calling `getClientToolExecutors()` or `webcontainer`), executes them, and passes results via `addToolResult`.
   - Listens to WebContainer `server-ready` event to automatically route preview URL to the Preview panel.
   - Responsive layout: on mobile screens (360px–430px) shows active tab; on desktop (`lg:`) expands into dual-pane (Chat on left, Workspace tabs on right).
3. Mobile Styling (`src/app/globals.css`):
   - Support `100dvh`, safe area insets, no horizontal overflow (`overflow-x: hidden`).
4. Verification & Build:
   - Run `cmd.exe /c npx tsc --noEmit` and `cmd.exe /c npm run build`.
   - Run `cmd.exe /c node tests/e2e/runner.js` to ensure zero regressions across all 38 tests.
   - Document verification commands and results in your handoff report.
