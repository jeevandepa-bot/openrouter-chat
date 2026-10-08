# Original User Request

## 2026-10-08T07:49:33Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Full team

Build a cloud coding AI agent with a mobile-first interface that can authenticate with GitHub to read, modify, and create repositories, and execute code in a live in-browser cloud sandbox (e.g., WebContainers).

Working directory: c:\Users\Jeevan\Downloads\New folder\openrouter-chat
Integrity mode: development

## Requirements

### R1. GitHub Integration
The application must allow the user to provide a GitHub token, which the agent can use to list, read, modify, and create repositories directly from the chat interface.

### R2. Live Cloud Sandbox
The application must integrate an in-browser execution environment (like WebContainers API) so the agent can run Node.js code, start servers, and display the live output or preview directly within the mobile UI. (Note: Ensure proper Cross-Origin Isolation headers are set for WebContainers).

### R3. Agent Tooling
The chat agent must be equipped with the appropriate tools (using Vercel AI SDK) to autonomously trigger GitHub actions and execute code in the sandbox based on user prompts.

## Acceptance Criteria

### GitHub Verification
- [ ] A test script or UI button successfully authenticates with GitHub, creates a new private repository, writes a text file to it, and reads the file back.

### Sandbox Verification
- [ ] A test script or UI button successfully boots the WebContainer, writes a simple Node.js web server script, runs it, and successfully fetches the local response from the container.

### Agent Workflow
- [ ] When prompted to "Create a repo called test and run a hello world script", the AI agent correctly emits the tool calls to perform both the GitHub creation and the Sandbox execution.
