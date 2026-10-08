'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useChat } from 'ai/react';
import { Header } from '@/components/Header';
import { TabNavigation, type WorkspaceTab } from '@/components/TabNavigation';
import { ChatPanel } from '@/components/ChatPanel';
import { CodeEditor } from '@/components/CodeEditor';
import { Terminal, type TerminalLogEntry } from '@/components/Terminal';
import { Preview } from '@/components/Preview';
import { VerificationSuite } from '@/components/VerificationSuite';
import { SettingsModal } from '@/components/SettingsModal';
import { getClientToolExecutors } from '@/lib/tools';
import {
  getWebContainer,
  onServerReady,
  writeFile as writeSandboxFile,
  readFile as readSandboxFile,
  readdir as readdirSandbox,
  spawn as spawnSandboxProcess,
} from '@/lib/webcontainer';
import { validateAuth } from '@/lib/github';
import type { SandboxStatus } from '@/types/sandbox';
import type { GitHubUser } from '@/types/github';

export default function CloudCodingWorkspace() {
  // --------------------------------------------------------------------------
  // 1. Navigation & Responsive Layout State
  // --------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('chat');
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('code'); // for desktop right pane
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --------------------------------------------------------------------------
  // 2. Settings & Credentials State
  // --------------------------------------------------------------------------
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [tokenStorage, setTokenStorage] = useState<'localStorage' | 'sessionStorage'>('localStorage');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('openrouter/auto');
  const [systemInstruction, setSystemInstruction] = useState(
    'You are an autonomous cloud coding AI agent capable of managing GitHub repositories and executing code in an in-browser WebContainer sandbox.'
  );
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);

  // Load credentials on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const timer = setTimeout(() => {
      try {
        const storedStorage = (localStorage.getItem('token_storage') as 'localStorage' | 'sessionStorage') || 'localStorage';
        setTokenStorage(storedStorage);

        const storage = storedStorage === 'sessionStorage' ? sessionStorage : localStorage;
        const savedToken = storage.getItem('github_pat') || localStorage.getItem('github_pat') || '';
        const savedOrKey = storage.getItem('openrouter_key') || localStorage.getItem('openrouter_key') || '';
        const savedModel = localStorage.getItem('selected_model') || 'openrouter/auto';
        const savedSys = localStorage.getItem('system_instruction') || '';

        if (savedToken) {
          setGithubToken(savedToken);
          validateAuth(savedToken)
            .then((u) => setGithubUser(u))
            .catch(() => setGithubUser(null));
        }
        if (savedOrKey) setOpenrouterKey(savedOrKey);
        if (savedModel) setSelectedModel(savedModel);
        if (savedSys) setSystemInstruction(savedSys);
      } catch {
        // Storage access blocked or restricted
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const handleSaveSettings = (settings: {
    githubToken: string;
    tokenStorage: 'localStorage' | 'sessionStorage';
    openrouterKey: string;
    selectedModel: string;
    systemInstruction: string;
  }) => {
    setGithubToken(settings.githubToken);
    setTokenStorage(settings.tokenStorage);
    setOpenrouterKey(settings.openrouterKey);
    setSelectedModel(settings.selectedModel);
    setSystemInstruction(settings.systemInstruction);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('token_storage', settings.tokenStorage);
        localStorage.setItem('selected_model', settings.selectedModel);
        localStorage.setItem('system_instruction', settings.systemInstruction);

        const targetStorage = settings.tokenStorage === 'sessionStorage' ? sessionStorage : localStorage;
        const otherStorage = settings.tokenStorage === 'sessionStorage' ? localStorage : sessionStorage;

        otherStorage.removeItem('github_pat');
        otherStorage.removeItem('openrouter_key');

        if (settings.githubToken) targetStorage.setItem('github_pat', settings.githubToken);
        else targetStorage.removeItem('github_pat');

        if (settings.openrouterKey) targetStorage.setItem('openrouter_key', settings.openrouterKey);
        else targetStorage.removeItem('openrouter_key');
      } catch {
        // Storage unavailable
      }
    }

    if (settings.githubToken) {
      validateAuth(settings.githubToken)
        .then((u) => setGithubUser(u))
        .catch(() => setGithubUser(null));
    } else {
      setGithubUser(null);
    }
  };

  // --------------------------------------------------------------------------
  // 3. WebContainer Sandbox State & Lifecycle
  // --------------------------------------------------------------------------
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatus>('uninitialized');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPort, setPreviewPort] = useState<number | null>(null);
  const [isStartingDemo, setIsStartingDemo] = useState(false);

  // Terminal Logs State
  const [terminalLogs, setTerminalLogs] = useState<TerminalLogEntry[]>([]);
  const [isTerminalRunning, setIsTerminalRunning] = useState(false);

  const appendTerminalLog = useCallback(
    (text: string, type: 'stdout' | 'stderr' | 'system' | 'command' = 'stdout') => {
      setTerminalLogs((prev) => [
        ...prev,
        {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type,
          text,
          timestamp: Date.now(),
        },
      ]);
    },
    []
  );

  // Filesystem State for CodeEditor
  const [sandboxFiles, setSandboxFiles] = useState<Array<{ path: string; isDir?: boolean }>>([]);
  const [currentFilePath, setCurrentFilePath] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');

  const refreshSandboxFiles = useCallback(async () => {
    if (typeof window === 'undefined' || sandboxStatus !== 'ready') return;
    try {
      const entries = await readdirSandbox('/', { withFileTypes: true });
      const mapped = (entries as Array<{ name: string; isDirectory: () => boolean } | string>).map(
        (ent) => {
          if (typeof ent === 'string') {
            return { path: ent, isDir: false };
          }
          return { path: ent.name, isDir: ent.isDirectory() };
        }
      );
      setSandboxFiles(mapped);

      // If no file currently selected, select first text file
      if (mapped.length > 0 && !currentFilePath) {
        const firstFile = mapped.find((f) => !f.isDir) || mapped[0];
        setCurrentFilePath(firstFile.path);
        try {
          const content = await readSandboxFile(firstFile.path);
          setFileContent(content);
        } catch {
          setFileContent('');
        }
      }
    } catch {
      // Readdir error
    }
  }, [sandboxStatus, currentFilePath]);

  // Boot WebContainer on mount (or manual trigger)
  const initWebContainer = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      setSandboxStatus('booting');
      appendTerminalLog('Booting WebContainer browser sandbox singleton...', 'system');
      await getWebContainer();
      setSandboxStatus('ready');
      appendTerminalLog('WebContainer booted and ready (Cross-Origin Isolated).', 'system');

      // Subscribe to server-ready
      onServerReady((port, url) => {
        appendTerminalLog(`[server-ready] Live HTTP server detected on port ${port} (${url})`, 'system');
        setPreviewPort(port);
        setPreviewUrl(url);
      });

      // Populate file tree
      await refreshSandboxFiles();
    } catch (err) {
      setSandboxStatus('error');
      const msg = err instanceof Error ? err.message : String(err);
      appendTerminalLog(`[WebContainer Boot Error]: ${msg}`, 'stderr');
    }
  }, [appendTerminalLog, refreshSandboxFiles]);

  useEffect(() => {
    const timer = setTimeout(() => {
      initWebContainer();
    }, 0);
    return () => clearTimeout(timer);
  }, [initWebContainer]);

  // --------------------------------------------------------------------------
  // 4. Client Tool Invocations Interceptor (Vercel AI SDK Bridge)
  // --------------------------------------------------------------------------
  const executedToolCallsRef = useRef<Set<string>>(new Set());

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    addToolResult,
    setMessages,
    setInput,
  } = useChat({
    headers: {
      'x-github-token': githubToken,
      ...(openrouterKey ? { 'x-openrouter-key': openrouterKey } : {}),
    },
    body: {
      model: selectedModel,
      systemInstruction,
    },
    maxSteps: 10,
  });

  // Watch messages for pending client sandbox tool invocations
  useEffect(() => {
    const handleClientTools = async () => {
      const executors = getClientToolExecutors();

      for (const msg of messages) {
        if (!msg.toolInvocations) continue;

        for (const invocation of msg.toolInvocations) {
          const { toolCallId, toolName, args } = invocation;

          // Process tool calls that are in 'call' state and not yet executed
          if (
            invocation.state === 'call' &&
            !executedToolCallsRef.current.has(toolCallId)
          ) {
            executedToolCallsRef.current.add(toolCallId);

            try {
              appendTerminalLog(`Executing client tool: ${toolName}...`, 'system');
              let toolResult: unknown;

              switch (toolName) {
                case 'bootSandbox': {
                  toolResult = await executors.bootSandbox(args as never);
                  setSandboxStatus('ready');
                  break;
                }
                case 'sandboxWriteFile': {
                  const writeArgs = args as { path: string; content: string };
                  toolResult = await executors.sandboxWriteFile(writeArgs);
                  appendTerminalLog(`[FS] Wrote ${writeArgs.content.length} bytes to ${writeArgs.path}`, 'stdout');
                  await refreshSandboxFiles();
                  break;
                }
                case 'sandboxReadFile': {
                  const readArgs = args as { path: string };
                  toolResult = await executors.sandboxReadFile(readArgs);
                  appendTerminalLog(`[FS] Read file ${readArgs.path}`, 'stdout');
                  break;
                }
                case 'sandboxRunCommand': {
                  const runArgs = args as { command: string; args?: string[] };
                  appendTerminalLog(`$ ${runArgs.command} ${(runArgs.args || []).join(' ')}`, 'command');
                  toolResult = await executors.sandboxRunCommand(runArgs);
                  const out = (toolResult as { output: string }).output;
                  if (out) appendTerminalLog(out, 'stdout');
                  break;
                }
                case 'sandboxStartServer': {
                  const serverArgs = args as { script?: string; port?: number };
                  toolResult = await executors.sandboxStartServer(serverArgs);
                  appendTerminalLog(
                    `[Server Started] Port: ${serverArgs.port || 3000}`,
                    'system'
                  );
                  break;
                }
                default:
                  // Other tools executed server-side
                  continue;
              }

              // Return execution result to agent loop
              addToolResult({
                toolCallId,
                result: toolResult,
              });
              appendTerminalLog(`Client tool ${toolName} completed successfully.`, 'system');
            } catch (toolErr) {
              const errMsg = toolErr instanceof Error ? toolErr.message : String(toolErr);
              appendTerminalLog(`[Tool Error] ${toolName}: ${errMsg}`, 'stderr');
              addToolResult({
                toolCallId,
                result: { error: errMsg, success: false },
              });
            }
          }
        }
      }
    };

    handleClientTools();
  }, [messages, addToolResult, appendTerminalLog, refreshSandboxFiles]);

  // --------------------------------------------------------------------------
  // 5. Code Editor Handlers
  // --------------------------------------------------------------------------
  const handleSelectFile = async (path: string) => {
    setCurrentFilePath(path);
    try {
      const content = await readSandboxFile(path);
      setFileContent(content);
    } catch {
      setFileContent('');
    }
  };

  const handleSaveFile = async (path: string, newContent: string) => {
    await writeSandboxFile(path, newContent);
    setFileContent(newContent);
    appendTerminalLog(`[FS Saved] Updated ${path}`, 'system');
    await refreshSandboxFiles();
  };

  const handleCreateFile = async (path: string) => {
    await writeSandboxFile(path, '');
    setCurrentFilePath(path);
    setFileContent('');
    appendTerminalLog(`[FS Created] File /${path}`, 'system');
    await refreshSandboxFiles();
  };

  const handleRunFile = async (path: string) => {
    try {
      setIsTerminalRunning(true);
      appendTerminalLog(`$ node ${path}`, 'command');
      // If mobile, switch to terminal tab so user sees output
      if (!isDesktop) setActiveTab('terminal');
      else setWorkspaceTab('terminal');

      const proc = await spawnSandboxProcess('node', [path]);
      const reader = proc.output.getReader();

      const readLoop = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) appendTerminalLog(value, 'stdout');
        }
      };
      readLoop().catch(() => {});

      const exitCode = await proc.exit;
      appendTerminalLog(`Process exited with code ${exitCode}`, exitCode === 0 ? 'system' : 'stderr');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendTerminalLog(`Run error: ${msg}`, 'stderr');
    } finally {
      setIsTerminalRunning(false);
    }
  };

  // --------------------------------------------------------------------------
  // 6. Terminal Handlers
  // --------------------------------------------------------------------------
  const handleRunTerminalCommand = async (commandLine: string) => {
    try {
      setIsTerminalRunning(true);
      appendTerminalLog(commandLine, 'command');

      const parts = commandLine.trim().split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);

      const proc = await spawnSandboxProcess(cmd, args);
      const reader = proc.output.getReader();

      const readLoop = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) appendTerminalLog(value, 'stdout');
        }
      };
      readLoop().catch(() => {});

      const exitCode = await proc.exit;
      appendTerminalLog(`Exited (${exitCode})`, exitCode === 0 ? 'system' : 'stderr');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendTerminalLog(`Command execution failed: ${msg}`, 'stderr');
    } finally {
      setIsTerminalRunning(false);
    }
  };

  // --------------------------------------------------------------------------
  // 7. Preview Demo Server Helper
  // --------------------------------------------------------------------------
  const handleStartDemoServer = async () => {
    setIsStartingDemo(true);
    try {
      const serverCode = `const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;background:#0f172a;color:#f8fafc;text-align:center;">' +
    '<h1 style="color:#a855f7;">Hello from WebContainer Sandbox!</h1>' +
    '<p>Live in-browser Node.js HTTP server responding on port 3000.</p>' +
    '<div style="background:#1e293b;padding:1rem;border-radius:0.5rem;display:inline-block;margin-top:1rem;">' +
    'Status: 🟢 Operational | Timestamp: ' + new Date().toLocaleTimeString() +
    '</div></body></html>');
});
server.listen(3000, () => {
  console.log('Demo server active on http://localhost:3000');
});`;

      await writeSandboxFile('server.js', serverCode);
      appendTerminalLog('[Demo] Wrote server.js to sandbox filesystem.', 'system');
      await spawnSandboxProcess('node', ['server.js']);
      appendTerminalLog('[Demo] Spawning server.js on port 3000...', 'system');
      await refreshSandboxFiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendTerminalLog(`Failed to start demo server: ${msg}`, 'stderr');
    } finally {
      setIsStartingDemo(false);
    }
  };

  // --------------------------------------------------------------------------
  // 8. Quick Prompt Helper
  // --------------------------------------------------------------------------
  const handleSelectQuickPrompt = (promptText: string) => {
    setInput(promptText);
    // If mobile and on another tab, switch to chat
    if (!isDesktop) setActiveTab('chat');
  };

  // Render workspace content for a given tab
  const renderTabContent = (tab: WorkspaceTab) => {
    switch (tab) {
      case 'chat':
        return (
          <ChatPanel
            messages={messages}
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            error={error}
            onSelectPrompt={handleSelectQuickPrompt}
            onClearChat={() => setMessages([])}
            hasGithubToken={Boolean(githubToken)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        );
      case 'code':
        return (
          <CodeEditor
            files={sandboxFiles}
            currentFilePath={currentFilePath}
            fileContent={fileContent}
            onSelectFile={handleSelectFile}
            onSaveFile={handleSaveFile}
            onCreateFile={handleCreateFile}
            onRunFile={handleRunFile}
            onRefreshFiles={refreshSandboxFiles}
            sandboxReady={sandboxStatus === 'ready'}
          />
        );
      case 'terminal':
        return (
          <Terminal
            logs={terminalLogs}
            onClear={() => setTerminalLogs([])}
            onRunCommand={handleRunTerminalCommand}
            isRunning={isTerminalRunning}
          />
        );
      case 'preview':
        return (
          <Preview
            url={previewUrl}
            port={previewPort}
            onReload={() => {}}
            onStartDemoServer={handleStartDemoServer}
            isStartingDemo={isStartingDemo}
          />
        );
      case 'verify':
        return (
          <VerificationSuite
            githubToken={githubToken}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onAppendTerminalLog={appendTerminalLog}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] max-w-[100vw] overflow-x-hidden bg-slate-950 text-slate-100 font-sans select-none">
      {/* 1. Header with branding & status pills */}
      <Header
        sandboxStatus={sandboxStatus}
        githubUser={githubUser}
        hasGithubToken={Boolean(githubToken)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onBootSandbox={initWebContainer}
      />

      {/* 2. Main Workspace Layout */}
      <main className="flex-1 overflow-hidden flex flex-col lg:flex-row min-w-0">
        {/* DESKTOP LAYOUT (>= 1024px): Dual-pane (Left: Chat, Right: Workspace Tabs) */}
        {isDesktop ? (
          <>
            {/* Left Pane: Chat (40% width) */}
            <section
              aria-label="Chat Agent"
              className="w-[42%] min-w-[380px] max-w-[540px] h-full border-r border-slate-800 flex flex-col shrink-0 overflow-hidden"
            >
              <ChatPanel
                messages={messages}
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                isLoading={isLoading}
                error={error}
                onSelectPrompt={handleSelectQuickPrompt}
                onClearChat={() => setMessages([])}
                hasGithubToken={Boolean(githubToken)}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            </section>

            {/* Right Pane: Workspace Tabs (58% width) */}
            <section
              aria-label="Workspace Environment"
              className="flex-1 h-full flex flex-col min-w-0 overflow-hidden bg-slate-950"
            >
              <TabNavigation
                activeTab={workspaceTab}
                onTabChange={setWorkspaceTab}
                previewPort={previewPort}
                previewActive={Boolean(previewUrl)}
                terminalRunning={isTerminalRunning}
                isDesktop={true}
              />
              <div className="flex-1 overflow-hidden">
                {renderTabContent(workspaceTab)}
              </div>
            </section>
          </>
        ) : (
          /* MOBILE LAYOUT (< 1024px): Single Pane with Segmented Navigation */
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <TabNavigation
              activeTab={activeTab}
              onTabChange={setActiveTab}
              previewPort={previewPort}
              previewActive={Boolean(previewUrl)}
              terminalRunning={isTerminalRunning}
              isDesktop={false}
            />
            <div className="flex-1 overflow-hidden">
              {renderTabContent(activeTab)}
            </div>
          </div>
        )}
      </main>

      {/* 3. Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        githubToken={githubToken}
        tokenStorage={tokenStorage}
        openrouterKey={openrouterKey}
        selectedModel={selectedModel}
        systemInstruction={systemInstruction}
        onSave={handleSaveSettings}
        onClearCredentials={() => {
          setGithubToken('');
          setOpenrouterKey('');
          setGithubUser(null);
        }}
      />
    </div>
  );
}
