'use client';

import React, { useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Trash2, Loader2, AlertCircle } from 'lucide-react';
import type { Message } from 'ai';
import { ToolCard } from './ToolCard';

export interface ChatPanelProps {
  messages: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  error?: Error | null;
  onSelectPrompt: (prompt: string) => void;
  onClearChat?: () => void;
  hasGithubToken: boolean;
  onOpenSettings: () => void;
}

const QUICK_PROMPTS = [
  'Create a repo called test and run a hello world script',
  'Write a simple HTTP server on port 3000 and run it',
  'List my GitHub repositories',
  'Run node -v in the sandbox',
];

export function ChatPanel({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  error,
  onSelectPrompt,
  onClearChat,
  hasGithubToken,
  onOpenSettings,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, error]);

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
        {/* Token warning banner if not configured */}
        {!hasGithubToken && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>GitHub token is not set. Set your PAT to enable repository operations.</span>
            </div>
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium shrink-0 transition-colors"
            >
              Configure
            </button>
          </div>
        )}

        {/* Empty State */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[320px] text-center px-4 py-8 space-y-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 shadow-inner">
              <Bot className="w-8 h-8 text-indigo-400" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h2 className="text-base font-semibold text-slate-100">
                Autonomous Cloud Coding Agent
              </h2>
              <p className="text-xs text-slate-400">
                I can create GitHub repositories, write code, run Node.js in the browser WebContainer, and preview live web servers.
              </p>
            </div>

            {/* Quick Prompt Chips */}
            <div className="w-full max-w-md pt-2 space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Suggested Actions
              </span>
              <div className="flex flex-col gap-1.5">
                {QUICK_PROMPTS.map((promptText, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSelectPrompt(promptText)}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-2 group"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-300 shrink-0" />
                    <span className="truncate">{promptText}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages List */}
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-3.5 sm:p-4 shadow-sm border transition-all ${
                  isUser
                    ? 'bg-indigo-600/20 border-indigo-500/30 rounded-br-sm text-indigo-50'
                    : 'bg-slate-900/90 border-slate-800 rounded-bl-sm text-slate-200'
                }`}
              >
                {/* Author Header */}
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    {isUser ? (
                      <>
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
                          You
                        </span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider">
                          Agent
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Message Content */}
                {m.content && (
                  <div className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed break-words font-sans">
                    {m.content}
                  </div>
                )}

                {/* Render Tool Invocations if any */}
                {m.toolInvocations && m.toolInvocations.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {m.toolInvocations.map((invocation) => (
                      <ToolCard
                        key={invocation.toolCallId}
                        toolInvocation={invocation}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Streaming / Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 p-3 text-xs text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800/60 max-w-xs">
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
            <span>Agent is thinking and executing tools...</span>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="break-all">{error.message || 'An error occurred during agent execution.'}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Footer Area */}
      <div className="p-2.5 sm:p-3 bg-slate-900/90 border-t border-slate-800 safe-area-bottom shrink-0">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 max-w-4xl mx-auto relative"
        >
          {onClearChat && messages.length > 0 && (
            <button
              type="button"
              onClick={onClearChat}
              title="Clear conversation"
              className="touch-target p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              disabled={isLoading}
              placeholder="Ask agent (e.g. Create repo test and run script)..."
              className="w-full h-11 pl-3.5 pr-12 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/30 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="touch-target absolute right-1 top-1 bottom-1 w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white flex items-center justify-center transition-all shadow-sm"
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChatPanel;
