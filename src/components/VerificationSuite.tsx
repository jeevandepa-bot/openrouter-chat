'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  Terminal,
  Bot,
  Clock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

function GithubIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}
import { runGitHubVerificationTest } from '@/lib/github-verifier';
import { runSandboxVerificationTest } from '@/lib/sandbox-verifier';
import { runAgentWorkflowVerification } from '@/lib/agent-verifier';
import type { GitHubVerificationStep } from '@/types/github';
import type { AgentVerificationStep } from '@/types/tools';

export interface VerificationSuiteProps {
  githubToken: string;
  onOpenSettings: () => void;
  onAppendTerminalLog?: (text: string, type: 'stdout' | 'stderr' | 'system') => void;
}

interface TestRunState<TStep = { name: string; ok: boolean; detail: string }> {
  status: 'idle' | 'running' | 'success' | 'failed';
  durationMs?: number;
  steps: TStep[];
  logs: string[];
  error?: string;
}

export function VerificationSuite({
  githubToken,
  onOpenSettings,
  onAppendTerminalLog,
}: VerificationSuiteProps) {
  // AC1: GitHub State
  const [ac1State, setAc1State] = useState<TestRunState<GitHubVerificationStep>>({
    status: 'idle',
    steps: [
      { name: 'Step 1: Validate GitHub Authentication', ok: false, detail: 'Validates PAT identity and repo scopes' },
      { name: 'Step 2: Create Private Repository', ok: false, detail: 'Creates private repository with auto_init' },
      { name: 'Step 3: Write Text File to Repo', ok: false, detail: 'Commits verification.txt with test nonce' },
      { name: 'Step 4: Read File Back & Verify Content', ok: false, detail: 'Reads file and asserts byte integrity' },
    ],
    logs: [],
  });

  // AC2: Sandbox State
  const [ac2State, setAc2State] = useState<TestRunState>({
    status: 'idle',
    steps: [
      { name: 'Step 1: Verify Cross-Origin Isolation', ok: false, detail: 'Asserts COOP and COEP header security context' },
      { name: 'Step 2: Boot WebContainer Singleton', ok: false, detail: 'Initializes in-browser WebAssembly Node.js runtime' },
      { name: 'Step 3: Write Node.js HTTP Server Script', ok: false, detail: 'Creates test-server.js in virtual filesystem' },
      { name: 'Step 4: Spawn Node.js Process & Listen', ok: false, detail: 'Spawns server and captures server-ready event' },
      { name: 'Step 5: Fetch & Assert Local Response', ok: false, detail: 'Fetches HTTP 200 payload from container port' },
      { name: 'Step 6: Clean Process Teardown', ok: false, detail: 'Kills server process and releases memory' },
    ],
    logs: [],
  });

  // AC3: Agent Workflow State
  const [ac3State, setAc3State] = useState<TestRunState<AgentVerificationStep>>({
    status: 'idle',
    steps: [
      { name: 'Step 1: Dual GitHub & Sandbox Tool Emission', ok: false, detail: 'Emits githubCreateRepo and sandbox execution calls' },
      { name: 'Step 2: Strict Zod Schema Validation', ok: false, detail: 'All tool parameters conform to Zod schema contracts' },
      { name: 'Step 3: Intent Segregation Verification', ok: false, detail: 'GitHub-only and Sandbox-only routing checks' },
      { name: 'Step 4: Autonomous Multi-Tool Outcome', ok: false, detail: 'Executes chained workflow to real-world completion' },
    ],
    logs: [],
  });

  const [activeLogTab, setActiveLogTab] = useState<'ac1' | 'ac2' | 'ac3'>('ac1');
  const [isRunningAll, setIsRunningAll] = useState(false);

  // Runner for AC1 (GitHub)
  const handleRunAC1 = async () => {
    if (!githubToken) {
      setAc1State((prev) => ({
        ...prev,
        status: 'failed',
        error: 'GitHub PAT is required to run AC1. Click "Configure" to provide token.',
        logs: ['[ERROR] GitHub Personal Access Token is missing.'],
      }));
      return;
    }

    setAc1State((prev) => ({
      ...prev,
      status: 'running',
      error: undefined,
      logs: ['[START] Initiating GitHub Verification Test (AC1)...'],
    }));

    try {
      const result = await runGitHubVerificationTest(githubToken, {
        onLog: (msg) => {
          setAc1State((prev) => ({ ...prev, logs: [...prev.logs, msg] }));
          onAppendTerminalLog?.(msg, 'stdout');
        },
      });

      setAc1State({
        status: result.success ? 'success' : 'failed',
        durationMs: result.durationMs,
        steps: result.steps,
        logs: result.logs,
        error: result.error,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setAc1State((prev) => ({
        ...prev,
        status: 'failed',
        error: errMsg,
        logs: [...prev.logs, `[FATAL] ${errMsg}`],
      }));
    }
  };

  // Runner for AC2 (Sandbox)
  const handleRunAC2 = async () => {
    setAc2State((prev) => ({
      ...prev,
      status: 'running',
      error: undefined,
      logs: ['[START] Initiating Sandbox WebContainer Verification Test (AC2)...'],
    }));

    try {
      const result = await runSandboxVerificationTest({
        onLog: (msg) => {
          setAc2State((prev) => ({ ...prev, logs: [...prev.logs, msg] }));
          onAppendTerminalLog?.(msg, 'stdout');
        },
      });

      // Map steps based on result
      const updatedSteps = [
        { name: 'Step 1: Verify Cross-Origin Isolation', ok: result.success, detail: 'COOP & COEP active' },
        { name: 'Step 2: Boot WebContainer Singleton', ok: result.success, detail: 'Singleton booted and ready' },
        { name: 'Step 3: Write Node.js HTTP Server Script', ok: result.success, detail: 'test-server.js written to virtual FS' },
        { name: 'Step 4: Spawn Node.js Process & Listen', ok: result.success, detail: `server-ready on port ${result.port || 3000}` },
        { name: 'Step 5: Fetch & Assert Local Response', ok: result.success, detail: 'Received HTTP 200 OK from WebContainer' },
        { name: 'Step 6: Clean Process Teardown', ok: result.success, detail: 'Killed process cleanly' },
      ];

      setAc2State({
        status: result.success ? 'success' : 'failed',
        durationMs: result.durationMs,
        steps: updatedSteps,
        logs: result.logs,
        error: result.error,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setAc2State((prev) => ({
        ...prev,
        status: 'failed',
        error: errMsg,
        logs: [...prev.logs, `[FATAL] ${errMsg}`],
      }));
    }
  };

  // Runner for AC3 (Agent Workflow)
  const handleRunAC3 = async () => {
    setAc3State((prev) => ({
      ...prev,
      status: 'running',
      error: undefined,
      logs: ['[START] Initiating Agent Workflow Verification Test (AC3)...'],
    }));

    try {
      const result = await runAgentWorkflowVerification({
        token: githubToken || undefined,
        onLog: (msg) => {
          setAc3State((prev) => ({ ...prev, logs: [...prev.logs, msg] }));
          onAppendTerminalLog?.(msg, 'stdout');
        },
      });

      setAc3State({
        status: result.success ? 'success' : 'failed',
        durationMs: result.durationMs,
        steps: result.steps,
        logs: result.logs,
        error: result.error,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setAc3State((prev) => ({
        ...prev,
        status: 'failed',
        error: errMsg,
        logs: [...prev.logs, `[FATAL] ${errMsg}`],
      }));
    }
  };

  // Run all in sequence
  const handleRunAll = async () => {
    setIsRunningAll(true);
    try {
      if (githubToken) {
        await handleRunAC1();
      }
      await handleRunAC2();
      await handleRunAC3();
    } finally {
      setIsRunningAll(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-y-auto p-3 sm:p-5 space-y-4">
      {/* Top Banner & Master Run Button */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base font-bold text-slate-100">
              Acceptance Criteria Verification Suite
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Interactive test runner for GitHub Authentication, WebContainer Isolation, and Agent Tooling Autonomy.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunAll}
          disabled={isRunningAll || ac1State.status === 'running' || ac2State.status === 'running' || ac3State.status === 'running'}
          className="touch-target px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 shrink-0"
        >
          {isRunningAll ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Running Suite...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run All Verifications</span>
            </>
          )}
        </button>
      </div>

      {/* Criteria Cards Grid */}
      <div className="grid grid-cols-1 gap-4">
        {/* ================================================================= */}
        {/* Criterion 1: GitHub Verification */}
        {/* ================================================================= */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
                <GithubIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  Acceptance Criterion 1: GitHub Integration
                </h3>
                <span className="text-[11px] text-slate-400">
                  Authenticates PAT, creates private repo, writes file, and reads back
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {!githubToken && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-medium border border-amber-500/30 transition-colors"
                >
                  Set PAT
                </button>
              )}
              <button
                type="button"
                onClick={handleRunAC1}
                disabled={ac1State.status === 'running'}
                className="touch-target px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-xs font-semibold text-white transition-all flex items-center gap-1.5 shadow-sm"
              >
                {ac1State.status === 'running' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3 h-3 fill-current" />
                )}
                <span>Run AC1</span>
              </button>
            </div>
          </div>

          {/* Steps List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {ac1State.steps.map((step, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-start gap-2.5 text-xs"
              >
                {ac1State.status === 'success' || step.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : ac1State.status === 'failed' && !step.ok ? (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : ac1State.status === 'running' ? (
                  <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0 mt-0.5" />
                ) : (
                  <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="font-medium text-slate-200 truncate">{step.name}</div>
                  <div className="text-[11px] text-slate-400 leading-tight">{step.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {ac1State.error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{ac1State.error}</span>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* Criterion 2: Sandbox Verification */}
        {/* ================================================================= */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  Acceptance Criterion 2: Sandbox Verification
                </h3>
                <span className="text-[11px] text-slate-400">
                  Boots WebContainer, writes web server, runs it, and fetches local HTTP response
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunAC2}
              disabled={ac2State.status === 'running'}
              className="touch-target px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-semibold text-white transition-all flex items-center gap-1.5 shadow-sm self-end sm:self-auto"
            >
              {ac2State.status === 'running' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              <span>Run AC2</span>
            </button>
          </div>

          {/* Steps List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {ac2State.steps.map((step, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-start gap-2.5 text-xs"
              >
                {ac2State.status === 'success' || step.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : ac2State.status === 'failed' && !step.ok ? (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : ac2State.status === 'running' ? (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0 mt-0.5" />
                ) : (
                  <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="font-medium text-slate-200 truncate">{step.name}</div>
                  <div className="text-[11px] text-slate-400 leading-tight">{step.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {ac2State.error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{ac2State.error}</span>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* Criterion 3: Agent Workflow Verification */}
        {/* ================================================================= */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  Acceptance Criterion 3: Agent Workflow Verification
                </h3>
                <span className="text-[11px] text-slate-400">
                  Tests &quot;Create a repo called test and run a hello world script&quot; dual-tool emission & execution
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunAC3}
              disabled={ac3State.status === 'running'}
              className="touch-target px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-xs font-semibold text-white transition-all flex items-center gap-1.5 shadow-sm self-end sm:self-auto"
            >
              {ac3State.status === 'running' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              <span>Run AC3</span>
            </button>
          </div>

          {/* Steps List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {ac3State.steps.map((step, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-start gap-2.5 text-xs"
              >
                {ac3State.status === 'success' || step.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : ac3State.status === 'failed' && !step.ok ? (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : ac3State.status === 'running' ? (
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin shrink-0 mt-0.5" />
                ) : (
                  <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="font-medium text-slate-200 truncate">{step.name}</div>
                  <div className="text-[11px] text-slate-400 leading-tight">{step.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {ac3State.error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{ac3State.error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Live Logs Drawer */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-300">Verification Output Telemetry</span>
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveLogTab('ac1')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeLogTab === 'ac1'
                  ? 'bg-sky-500/20 text-sky-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              AC1 ({ac1State.logs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveLogTab('ac2')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeLogTab === 'ac2'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              AC2 ({ac2State.logs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveLogTab('ac3')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeLogTab === 'ac3'
                  ? 'bg-purple-500/20 text-purple-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              AC3 ({ac3State.logs.length})
            </button>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-850 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1 text-slate-300 leading-relaxed">
          {(() => {
            const currentLogs =
              activeLogTab === 'ac1'
                ? ac1State.logs
                : activeLogTab === 'ac2'
                ? ac2State.logs
                : ac3State.logs;

            if (currentLogs.length === 0) {
              return (
                <div className="text-slate-500 italic py-2">
                  No logs for this criterion yet. Click &quot;Run&quot; to execute.
                </div>
              );
            }

            return currentLogs.map((log, i) => (
              <div key={i} className="break-all whitespace-pre-wrap">
                {log}
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}

export default VerificationSuite;
