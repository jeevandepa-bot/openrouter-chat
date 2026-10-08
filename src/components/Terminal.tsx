'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Trash2,
  Copy,
  Check,
  Play,
  ArrowDown,
  Loader2,
} from 'lucide-react';

export interface TerminalLogEntry {
  id: string;
  type: 'stdout' | 'stderr' | 'system' | 'command';
  text: string;
  timestamp: number;
}

export interface TerminalProps {
  logs: TerminalLogEntry[];
  onClear: () => void;
  onRunCommand: (command: string) => Promise<void>;
  isRunning?: boolean;
}

const QUICK_COMMANDS = ['node -v', 'ls -la', 'pwd', 'npm -v'];

export function Terminal({
  logs,
  onClear,
  onRunCommand,
  isRunning = false,
}: TerminalProps) {
  const [commandInput, setCommandInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || isRunning) return;
    const cmd = commandInput.trim();
    setCommandInput('');
    await onRunCommand(cmd);
  };

  const handleQuickCommand = async (cmd: string) => {
    if (isRunning) return;
    await onRunCommand(cmd);
  };

  const handleCopyLogs = () => {
    const text = logs.map((l) => l.text).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0b0e14] text-slate-100 overflow-hidden font-mono">
      {/* Top Header Controls */}
      <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 text-xs">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-slate-200">WebContainer Shell</span>
          {isRunning && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              Running
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Quick command buttons */}
          <div className="hidden md:flex items-center gap-1 mr-2">
            {QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => handleQuickCommand(cmd)}
                disabled={isRunning}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-750 text-[10px] text-slate-300 hover:text-white transition-colors border border-slate-700 disabled:opacity-50"
              >
                {cmd}
              </button>
            ))}
          </div>

          {/* Auto Scroll Toggle */}
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
            className={`touch-target p-1.5 rounded-lg text-xs transition-colors ${
              autoScroll ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            title="Copy terminal output"
            className="touch-target p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-30"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Clear Button */}
          <button
            type="button"
            onClick={onClear}
            title="Clear terminal"
            className="touch-target p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Output Console Log Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 text-xs leading-relaxed select-text">
        {logs.length === 0 ? (
          <div className="text-slate-500 italic py-6 text-center text-xs">
            WebContainer terminal is ready. Execute shell commands below or prompt the agent.
          </div>
        ) : (
          logs.map((log) => {
            let textColor = 'text-slate-200';
            let prefix = '';

            if (log.type === 'command') {
              textColor = 'text-indigo-300 font-bold';
              prefix = '$ ';
            } else if (log.type === 'stderr') {
              textColor = 'text-rose-400';
            } else if (log.type === 'system') {
              textColor = 'text-amber-400/80';
              prefix = 'ℹ ';
            } else {
              textColor = 'text-slate-300';
            }

            return (
              <div key={log.id} className="whitespace-pre-wrap break-all font-mono">
                {prefix && <span className="opacity-70 mr-1 select-none">{prefix}</span>}
                <span className={textColor}>{log.text}</span>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Bottom Command Prompt Input */}
      <div className="p-2 bg-slate-900 border-t border-slate-800 shrink-0 safe-area-bottom">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold text-xs select-none pl-1">$</span>
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            disabled={isRunning}
            placeholder={isRunning ? 'Command executing...' : 'Enter shell command (e.g. node -v)...'}
            className="flex-1 h-9 bg-transparent border-none text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isRunning || !commandInput.trim()}
            className="touch-target px-3 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white transition-all flex items-center gap-1"
          >
            {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
            <span className="hidden sm:inline">Run</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default Terminal;
