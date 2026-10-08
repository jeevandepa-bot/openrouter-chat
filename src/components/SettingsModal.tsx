'use client';

import React, { useState } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Key,
  Bot,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react';
import { validateAuth } from '@/lib/github';
import type { GitHubUser } from '@/types/github';

function GithubIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  githubToken: string;
  tokenStorage: 'localStorage' | 'sessionStorage';
  openrouterKey: string;
  selectedModel: string;
  systemInstruction: string;
  onSave: (settings: {
    githubToken: string;
    tokenStorage: 'localStorage' | 'sessionStorage';
    openrouterKey: string;
    selectedModel: string;
    systemInstruction: string;
  }) => void;
  onClearCredentials?: () => void;
}

const AVAILABLE_MODELS = [
  { id: 'openrouter/auto', name: 'OpenRouter Auto (Recommended)' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free, Tool-Ready)' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash Exp (Free, Fast)' },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B (High Accuracy Tools)' },
];

export function SettingsModal({
  isOpen,
  onClose,
  githubToken: initialGithubToken,
  tokenStorage: initialTokenStorage,
  openrouterKey: initialOpenrouterKey,
  selectedModel: initialModel,
  systemInstruction: initialSystemInstruction,
  onSave,
  onClearCredentials,
}: SettingsModalProps) {
  const [token, setToken] = useState(initialGithubToken);
  const [storageType, setStorageType] = useState<'localStorage' | 'sessionStorage'>(
    initialTokenStorage || 'localStorage'
  );
  const [orKey, setOrKey] = useState(initialOpenrouterKey);
  const [model, setModel] = useState(initialModel || AVAILABLE_MODELS[0].id);
  const [sysPrompt, setSysPrompt] = useState(initialSystemInstruction);

  const [showGithubToken, setShowGithubToken] = useState(false);
  const [showOrKey, setShowOrKey] = useState(false);

  // GitHub token validation status
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [validatedUser, setValidatedUser] = useState<GitHubUser | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestToken = async () => {
    if (!token.trim()) return;
    setIsValidatingToken(true);
    setValidationError(null);
    setValidatedUser(null);

    try {
      const user = await validateAuth(token.trim());
      setValidatedUser(user);
    } catch (err) {
      setValidationError(
        err instanceof Error
          ? err.message
          : 'Failed to validate GitHub token. Check token permissions.'
      );
    } finally {
      setIsValidatingToken(false);
    }
  };

  const handleSave = () => {
    onSave({
      githubToken: token.trim(),
      tokenStorage: storageType,
      openrouterKey: orKey.trim(),
      selectedModel: model,
      systemInstruction: sysPrompt,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-slate-100">
              Agent & Environment Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-target p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs sm:text-sm">
          {/* GitHub Personal Access Token Section */}
          <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <GithubIcon className="w-4 h-4 text-sky-400" />
                GitHub Personal Access Token (PAT)
              </label>
              <span className="text-[10px] text-slate-400">Required for repos</span>
            </div>

            <div className="relative">
              <input
                type={showGithubToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx or github_pat_..."
                className="w-full h-11 pl-3.5 pr-20 rounded-xl bg-slate-950 border border-slate-700/80 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <div className="absolute right-2 top-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowGithubToken(!showGithubToken)}
                  className="touch-target p-1.5 text-slate-400 hover:text-slate-200"
                  aria-label={showGithubToken ? 'Hide token' : 'Show token'}
                >
                  {showGithubToken ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Storage Selection & Test Action */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400">Persist in:</span>
                <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="tokenStorage"
                    value="localStorage"
                    checked={storageType === 'localStorage'}
                    onChange={() => setStorageType('localStorage')}
                    className="accent-indigo-500"
                  />
                  localStorage
                </label>
                <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="tokenStorage"
                    value="sessionStorage"
                    checked={storageType === 'sessionStorage'}
                    onChange={() => setStorageType('sessionStorage')}
                    className="accent-indigo-500"
                  />
                  sessionStorage
                </label>
              </div>

              <button
                type="button"
                onClick={handleTestToken}
                disabled={!token.trim() || isValidatingToken}
                className="touch-target px-3 py-1 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 font-medium text-xs transition-colors flex items-center gap-1.5 disabled:opacity-40"
              >
                {isValidatingToken ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
                <span>Test Token</span>
              </button>
            </div>

            {/* Test Token Validation Output */}
            {validatedUser && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Authenticated as <strong>@{validatedUser.login}</strong> (ID: {validatedUser.id})
                </span>
              </div>
            )}

            {validationError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          {/* OpenRouter API Key Section */}
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-400" />
                OpenRouter API Key (Optional)
              </label>
              <span className="text-[10px] text-slate-400">Overrides server env</span>
            </div>

            <div className="relative">
              <input
                type={showOrKey ? 'text' : 'password'}
                value={orKey}
                onChange={(e) => setOrKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full h-11 pl-3.5 pr-10 rounded-xl bg-slate-950 border border-slate-700/80 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowOrKey(!showOrKey)}
                className="touch-target absolute right-2 top-2 p-1.5 text-slate-400 hover:text-slate-200"
                aria-label={showOrKey ? 'Hide key' : 'Show key'}
              >
                {showOrKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Leave blank to use the pre-configured backend API key.
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-purple-400" />
              AI Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* System Instruction */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-200 block">
              System Instruction Customization
            </label>
            <textarea
              value={sysPrompt}
              onChange={(e) => setSysPrompt(e.target.value)}
              rows={3}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
              placeholder="Custom instructions for agent behavior..."
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
          {onClearCredentials ? (
            <button
              type="button"
              onClick={() => {
                setToken('');
                setOrKey('');
                onClearCredentials();
              }}
              className="touch-target px-3 py-2 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
            >
              Clear Keys
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="touch-target px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="touch-target px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-md shadow-indigo-600/20"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
