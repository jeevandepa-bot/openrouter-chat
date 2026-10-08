# WebContainers In-Browser Execution & Headers Architecture — Survey Handoff Report

**Role**: Explorer Agent 3 (WebContainers In-Browser Execution & Headers Exploration)  
**Project**: Cloud Coding AI Agent (`openrouter-chat`)  
**Working Directory**: `c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\explorer_survey_3`  
**Date**: 2026-10-08  

---

## 1. Observation

### Existing Codebase State
- **Project Root**: `c:\Users\Jeevan\Downloads\New folder\openrouter-chat`
- **`package.json`**:
  - Contains Next.js `16.4.0`, React `19.3.0`, `@ai-sdk/react` `^4.0.136`, `ai` `^3.4.33`, `lucide-react` `^1.53.0`.
  - Does **not** currently include `@webcontainer/api` (current stable is `^1.6.4`).
- **`next.config.ts`**:
  - Lines 1–18 define basic Turbopack rules, `cacheComponents: true`, and `partialPrefetching: true`.
  - Currently has **no `headers()` configuration**.
- **Browser Security & Execution Requirements**:
  - `@webcontainer/api` runs an in-browser WebAssembly-based Node.js runtime that relies on `SharedArrayBuffer` and `Worker` threads.
  - If Cross-Origin Isolation headers are absent, modern browsers disable `SharedArrayBuffer`, causing runtime crash:
    `ReferenceError: SharedArrayBuffer is not defined`
    and `window.crossOriginIsolated` returns `false`.
  - Booting WebContainer multiple times in the same session throws verbatim:
    `Error: Only a single WebContainer instance can be booted`
  - React 19 / 18 dev mode with `StrictMode` mounts effects twice. Without promise memoization, simultaneous calls to `WebContainer.boot()` throw immediately.
  - Evaluating `@webcontainer/api` during Next.js Server-Side Rendering (SSR) or static pre-rendering throws:
    `ReferenceError: window is not defined` or `Worker is not defined`.
- **`ORIGINAL_REQUEST.md` Acceptance Criteria R2 & Verification**:
  - "The application must integrate an in-browser execution environment (like WebContainers API) so the agent can run Node.js code, start servers, and display the live output or preview directly within the mobile UI. (Note: Ensure proper Cross-Origin Isolation headers are set for WebContainers)."
  - "A test script or UI button successfully boots the WebContainer, writes a simple Node.js web server script, runs it, and successfully fetches the local response from the container."

---

## 2. Logic Chain

### Step 2.1 — Cross-Origin Isolation Header Strategy (COOP / COEP)
- **Observation**: `window.crossOriginIsolated` must be `true` for `SharedArrayBuffer`.
- **Deduction**: We must configure Next.js to inject security headers on every response.
- **Implementation Mechanism**:
  Configure `next.config.ts` using the async `headers()` hook:
  ```typescript
  // next.config.ts
  import type { NextConfig } from "next";

  const nextConfig: NextConfig = {
    async headers() {
      return [
        {
          source: "/(.*)",
          headers: [
            {
              key: "Cross-Origin-Embedder-Policy",
              value: "require-corp", // or "credentialless"
            },
            {
              key: "Cross-Origin-Opener-Policy",
              value: "same-origin",
            },
          ],
        },
      ];
    },
    // ... existing turbopack and compiler settings
  };

  export default nextConfig;
  ```
- **Trade-off Analysis (`require-corp` vs `credentialless`)**:
  - `require-corp`: The canonical standard recommended by StackBlitz. Any external resource (scripts, images) must provide `Cross-Origin-Resource-Policy: cross-origin` or CORS headers. Third-party images like GitHub profile avatars (`avatars.githubusercontent.com`) must be rendered with `crossOrigin="anonymous"`.
  - `credentialless`: Supported in modern Chrome (96+), Firefox (119+), and Safari (17+). Allows cross-origin subresources without CORP headers by stripping credentials (cookies). If selected, `WebContainer.boot({ coep: 'credentialless' })` must be passed.
  - **Recommendation**: Deploy `require-corp` with `same-origin` as the rock-solid default; use `crossOrigin="anonymous"` on GitHub avatar `<img>` tags.

### Step 2.2 — Client-Only Singleton & Dynamic Loading Architecture
- **Observation**: Calling `WebContainer.boot()` more than once throws `Error: Only a single WebContainer instance can be booted`. Furthermore, Next.js executes client components on the server during initial SSR.
- **Deduction**:
  1. `@webcontainer/api` must never be evaluated on the server. We must use dynamic `import('@webcontainer/api')` inside browser-guarded code.
  2. Booting must be managed via a strict singleton promise anchored both in module memory and on `window.__webcontainerPromise` so that HMR (Hot Module Replacement) and React `StrictMode` double-mounting never trigger concurrent boot calls.
- **Architecture**:
  Create `src/lib/webcontainer.ts`:
  ```typescript
  import type { WebContainer } from '@webcontainer/api';

  declare global {
    interface Window {
      __webcontainerPromise?: Promise<WebContainer>;
    }
  }

  let bootPromise: Promise<WebContainer> | null = null;

  export async function getWebContainer(): Promise<WebContainer> {
    if (typeof window === 'undefined') {
      throw new Error('WebContainer can only be initialized in the browser.');
    }

    // Reuse window-cached promise across HMR updates
    if (window.__webcontainerPromise) {
      return window.__webcontainerPromise;
    }

    if (!bootPromise) {
      bootPromise = (async () => {
        const { WebContainer } = await import('@webcontainer/api');
        const instance = await WebContainer.boot();
        return instance;
      })();
      window.__webcontainerPromise = bootPromise;
    }

    return bootPromise;
  }
  ```

### Step 2.3 — File System & Process Execution Lifecycle
- **Observation**: The AI agent needs tools to create files, read files, run terminal commands, and start development servers.
- **Mechanism**:
  - **File Operations**:
    - `webcontainer.fs.writeFile(filePath, contents)` (creates/overwrites in virtual memory)
    - `webcontainer.fs.readFile(filePath, 'utf-8')`
    - `webcontainer.fs.mkdir(dirPath, { recursive: true })`
    - `webcontainer.fs.readdir(dirPath, { withFileTypes: true })`
    - `webcontainer.fs.rm(filePath, { recursive: true, force: true })`
  - **Process Execution**:
    - `const process = await webcontainer.spawn(cmd, args, { env })`
    - Output stream: `process.output` is a `ReadableStream<string>`. We stream stdout and stderr directly to the terminal state/UI via `pipeTo`:
      ```typescript
      process.output.pipeTo(new WritableStream({
        write(chunk) {
          appendTerminalOutput(chunk);
        }
      }));
      ```
    - Input stream: `process.input` is a `WritableStream<string>` (for stdin).
    - Termination: `process.kill()` terminates the process.
    - Exit code: `const exitCode = await process.exit;`.

### Step 2.4 — `server-ready` Event & Iframe Live Preview
- **Observation**: When a user or agent starts a server (e.g. `node server.js` or `npm run dev`), WebContainer fires `server-ready` when an HTTP server calls `.listen()`.
- **Mechanism**:
  - `webcontainer.on('server-ready', (port: number, url: string) => void)`
  - When emitted, `url` is an ephemeral tunnel URL pointing to the in-container virtual HTTP port.
  - The preview UI displays an `<iframe>` whose `src` is set to `url`.
  - **Iframe Cross-Origin Isolation Rule**: Under `Cross-Origin-Embedder-Policy: require-corp`, modern browsers allow iframe embedding if the iframe element specifies `credentialless`:
    ```tsx
    <iframe
      src={previewUrl}
      className="w-full h-full border-0 bg-white"
      // @ts-expect-error credentialless is standard in modern HTML
      credentialless="true"
      title="WebContainer Live Preview"
    />
    ```
  - Port closing detection: `webcontainer.on('port', (port: number, type: 'open' | 'close') => void)` allows the UI to automatically clear or mark the preview as offline when the server stops.

### Step 2.5 — Vercel AI SDK Client-Side Tool Bridge
- **Observation**: The chat interface communicates with the LLM via Vercel AI SDK (`useChat`), but WebContainers executes **in the user's browser tab**, not on the Next.js server.
- **Deduction**: Server-side tool execution in `src/app/api/chat/route.ts` cannot directly manipulate the browser's WebContainer.
- **Solution**:
  - The model defines sandbox tools (`execute_sandbox_command`, `write_sandbox_file`, `read_sandbox_file`, `start_sandbox_server`).
  - When the LLM outputs a tool call, `@ai-sdk/react`'s `useChat` surfaces the `toolInvocation`.
  - The client UI intercepts the invocation, executes the command or file write on the local `WebContainer` singleton, and calls `addToolResult({ toolCallId, result })`.
  - The chat session seamlessly sends the result back to the LLM for multi-step autonomous workflows.

### Step 2.6 — Verification Test Implementation
- **Observation**: Acceptance criteria R2 mandates a verification test that boots WebContainer, writes a simple Node.js web server script, runs it, and successfully fetches the local response.
- **Test Implementation**:
  ```typescript
  export async function runSandboxVerificationTest(): Promise<{
    success: boolean;
    durationMs: number;
    port: number;
    url: string;
    response: unknown;
    logs: string[];
  }> {
    const logs: string[] = [];
    const log = (msg: string) => logs.push(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
    const start = Date.now();

    try {
      log("1. Checking Cross-Origin Isolation...");
      if (typeof window === "undefined" || !window.crossOriginIsolated) {
        throw new Error(
          "Cross-Origin Isolation is not active. Check COOP/COEP headers in next.config.ts."
        );
      }
      log("Cross-Origin Isolation verified (window.crossOriginIsolated === true).");

      log("2. Booting WebContainer singleton...");
      const wc = await getWebContainer();
      log("WebContainer booted successfully.");

      log("3. Writing test server script (test-server.js)...");
      const serverCode = `
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify({
    status: 'ok',
    message: 'Hello from in-browser WebContainer!',
    timestamp: Date.now()
  }));
});
server.listen(3000, () => {
  console.log('Test server ready on port 3000');
});
`;
      await wc.fs.writeFile('test-server.js', serverCode);
      log("test-server.js successfully written.");

      log("4. Registering server-ready listener...");
      const serverReadyPromise = new Promise<{ port: number; url: string }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout (15s) waiting for WebContainer server-ready event."));
        }, 15000);

        const teardownListener = wc.on('server-ready', (port, url) => {
          clearTimeout(timeout);
          teardownListener();
          resolve({ port, url });
        });
      });

      log("5. Spawning node test-server.js process...");
      const proc = await wc.spawn('node', ['test-server.js']);

      proc.output.pipeTo(new WritableStream({
        write(chunk) {
          log(`[Container STDOUT]: ${chunk.trim()}`);
        }
      })).catch(() => {});

      const { port, url } = await serverReadyPromise;
      log(`Server-ready received: Port ${port}, URL: ${url}`);

      log("6. Fetching HTTP response from container URL...");
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP fetch failed with status ${response.status}`);
      }
      const data = await response.json();
      log(`Response verified: ${JSON.stringify(data)}`);

      log("7. Terminating test server process...");
      proc.kill();
      log("Process terminated. Verification PASSED.");

      return {
        success: true,
        durationMs: Date.now() - start,
        port,
        url,
        response: data,
        logs
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`Verification FAILED: ${errMsg}`);
      return {
        success: false,
        durationMs: Date.now() - start,
        port: 0,
        url: '',
        response: null,
        logs
      };
    }
  }
  ```

### Step 2.7 — Mobile UI Representation Architecture
- **Mobile Constraints**:
  - Viewports: 360px – 430px width, `100dvh` height.
  - On mobile, simultaneous horizontal panes (Chat + Terminal + Preview) induce unacceptable clutter.
- **Recommended Layout**:
  - **Segmented Top or Bottom Navigation Bar** with 3 Primary Modes:
    1. **💬 Chat**: AI interaction, prompt input, GitHub/Sandbox tool invocation badges.
    2. **💻 Terminal**: Dark-mode streaming console (`font-mono text-xs`), autoscroll toggle, clear button, copy logs button.
    3. **🌐 Preview**: Browser frame with:
       - Top toolbar: active port badge (e.g. `:3000`), reload button, external open link (`window.open(url)`), and live status pill (`Live` / `Offline`).
       - Full-width iframe rendering the application.
  - **Omnipresent Status Header**:
    - Compact status pill in the top navbar:
      - 🔴 `Sandbox: Offline`
      - 🟡 `Sandbox: Booting...`
      - 🟢 `Sandbox: Ready (:3000)`
    - Tapping the status pill opens a diagnostic drawer or switches directly to the Preview tab.
  - **Self-Test Diagnostic Button**:
    - Accessible via Settings or a dedicated "⚡ Run Sandbox Test" button in the header, running the verification script and displaying real-time pass/fail indicators.

---

## 3. Caveats

1. **Native C++ Addons (`node-gyp`) Unsupported**:
   WebContainers executes Node.js compiled to WebAssembly. Native C++ binary bindings (e.g., certain versions of `sqlite3`, `bcrypt`, `sharp`) cannot run unless pure JS or WASM equivalents (e.g., `better-sqlite3-wasm`, `bcryptjs`) are used. Standard HTTP servers (`express`, `hono`, `fastify`), Next.js/Vite dev servers, and pure JS tools run without issues.
2. **Tab Isolation & Volatile Storage**:
   The WebContainer filesystem lives in memory for the current browser session. Refreshing the browser tab completely clears the virtual disk unless files are committed to GitHub or synced into IndexedDB/LocalStorage.
3. **Third-Party Subresources under COEP**:
   Setting `Cross-Origin-Embedder-Policy: require-corp` will block third-party images or iframes that do not return CORP headers. Any GitHub user avatar images displayed in the UI must include `crossOrigin="anonymous"`.
4. **Browser Requirements**:
   Requires modern Chromium, Firefox (119+), or Safari (16.4+). Older mobile webviews without `SharedArrayBuffer` support will fail gracefully with a descriptive error.
5. **No Parallel Containers**:
   WebContainers currently supports only one booted instance per page context. Multiple tabs can each run their own instance, but a single tab cannot boot two containers simultaneously.

---

## 4. Conclusion

The in-browser sandbox architecture for the cloud coding agent is fully specified and ready for implementation:
1. **Headers**: Add `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin` to `next.config.ts`.
2. **Dependency**: Install `@webcontainer/api` (`npm i @webcontainer/api`).
3. **Singleton Manager**: Create `src/lib/webcontainer.ts` with client-only promise memoization anchored to `window.__webcontainerPromise`.
4. **Agent Sandbox Tools**: Implement client-side tool execution handlers hooked into `@ai-sdk/react` (`addToolResult`) for file write, command execution, and server startup.
5. **Verification Test**: Create an automated test runner (`src/lib/sandbox-verifier.ts`) that boots, writes `test-server.js`, listens for `server-ready`, fetches the JSON payload, and asserts HTTP 200.
6. **Mobile UI**: Implement a 3-tab mobile interface (Chat, Terminal, Preview) with a sticky header status indicator and full-screen iframe preview with `credentialless="true"`.

---

## 5. Verification Method

To independently verify this architecture upon implementation:

1. **Check Cross-Origin Isolation**:
   - Start the Next.js dev server:
     ```powershell
     npm run dev
     ```
   - Open browser developer console at `http://localhost:3000` and assert:
     ```javascript
     console.assert(window.crossOriginIsolated === true, "COOP/COEP isolation failed!");
     ```
2. **Inspect Response Headers**:
   - Run in PowerShell:
     ```powershell
     curl.exe -I http://localhost:3000/
     ```
   - Verify presence of:
     - `Cross-Origin-Embedder-Policy: require-corp`
     - `Cross-Origin-Opener-Policy: same-origin`
3. **Execute Verification Test**:
   - Trigger `runSandboxVerificationTest()` either via the UI diagnostic button or a temporary test route.
   - Assert:
     - Output contains `[Container STDOUT]: Test server ready on port 3000`
     - Received response: `{"status":"ok","message":"Hello from in-browser WebContainer!"}`
     - Status: `success: true`.
4. **Invalidation Conditions**:
   - If `window.crossOriginIsolated` is `false`, `WebContainer.boot()` will throw.
   - If `boot()` is called twice without singleton memoization, the second call throws `Error: Only a single WebContainer instance can be booted`.
   - If `@webcontainer/api` is imported in a server component without dynamic client import, Next.js build/dev will throw `ReferenceError: window is not defined`.
