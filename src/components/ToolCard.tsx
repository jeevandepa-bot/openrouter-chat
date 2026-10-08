'use client';

import React, { useState } from 'react';
import {
  Terminal,
  FileCode,
  Globe,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Clock,
} from 'lucide-react';
import type { ToolInvocation } from 'ai';

function GithubIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export interface ToolCardProps {
  toolInvocation: ToolInvocation;
}

export function ToolCard({ toolInvocation }: ToolCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { toolName, args } = toolInvocation;
  const isGitHub = toolName.startsWith('github');
  const isSandbox = toolName.startsWith('sandbox') || toolName === 'bootSandbox';

  // Determine execution state
  // Vercel AI SDK ToolInvocation states: 'partial-call' | 'call' | 'result'
  const state = toolInvocation.state;
  const hasResult = 'result' in toolInvocation && toolInvocation.result !== undefined;
  const result = hasResult ? toolInvocation.result : undefined;

  const isCompleted = state === 'result';
  const isPending = state === 'call' || state === 'partial-call';

  // Extract friendly summary
  const getToolSummary = () => {
    switch (toolName) {
      case 'githubCreateRepo':
        return `Create repo: "${(args as { name?: string })?.name || ''}"`;
      case 'githubGetRepo':
        return `Get repo: "${(args as { repo?: string })?.repo || ''}"`;
      case 'githubListRepos':
        return 'List GitHub repositories';
      case 'githubReadFile':
        return `Read file: ${(args as { path?: string })?.path || ''}`;
      case 'githubWriteFile':
        return `Commit file: ${(args as { path?: string })?.path || ''}`;
      case 'bootSandbox':
        return 'Initialize WebContainer sandbox';
      case 'sandboxWriteFile':
        return `Write sandbox file: ${(args as { path?: string })?.path || ''}`;
      case 'sandboxReadFile':
        return `Read sandbox file: ${(args as { path?: string })?.path || ''}`;
      case 'sandboxRunCommand': {
        const cmdArgs = (args as { command?: string; args?: string[] });
        return `Run command: ${cmdArgs?.command || ''} ${(cmdArgs?.args || []).join(' ')}`.trim();
      }
      case 'sandboxStartServer':
        return `Start server on port ${(args as { port?: number })?.port || 3000}`;
      default:
        return toolName;
    }
  };

  const getToolIcon = () => {
    if (isGitHub) return <GithubIcon className="w-4 h-4 text-sky-400" />;
    if (toolName === 'sandboxRunCommand') return <Terminal className="w-4 h-4 text-emerald-400" />;
    if (toolName === 'sandboxStartServer') return <Globe className="w-4 h-4 text-purple-400" />;
    if (toolName.includes('File')) return <FileCode className="w-4 h-4 text-amber-400" />;
    return <Terminal className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="w-full my-2 bg-slate-800/80 border border-slate-700/80 rounded-xl overflow-hidden shadow-sm transition-all">
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-700/40 transition-colors gap-2"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1 rounded bg-slate-900/60 shrink-0">
            {getToolIcon()}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200 truncate">
                {toolName}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  isGitHub
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                    : isSandbox
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {isGitHub ? 'GitHub' : isSandbox ? 'Sandbox' : 'Tool'}
              </span>
            </div>
            <span className="text-xs text-slate-400 font-mono truncate">
              {getToolSummary()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" />
              Completed
            </span>
          ) : isPending ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              <Loader2 className="w-3 h-3 animate-spin" />
              Executing
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" />
              Queued
            </span>
          )}

          <div className="text-slate-400">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3.5 py-3 border-t border-slate-700/60 bg-slate-900/60 space-y-3 text-xs">
          {/* Tool Arguments */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Parameters
            </div>
            <pre className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 overflow-x-auto font-mono text-[11px] max-h-48 leading-relaxed">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>

          {/* Tool Result */}
          {hasResult && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Output
              </div>
              <pre className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400/90 overflow-x-auto font-mono text-[11px] max-h-48 leading-relaxed">
                {typeof result === 'string'
                  ? result
                  : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ToolCard;
