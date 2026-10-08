'use client';

import React from 'react';
import { Sparkles, Terminal, Settings, CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import type { SandboxStatus } from '@/types/sandbox';

function GithubIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export interface HeaderProps {
  sandboxStatus: SandboxStatus;
  githubUser: { login: string; avatarUrl?: string } | null;
  hasGithubToken: boolean;
  onOpenSettings: () => void;
  onBootSandbox?: () => void;
}

export function Header({
  sandboxStatus,
  githubUser,
  hasGithubToken,
  onOpenSettings,
  onBootSandbox,
}: HeaderProps) {
  const getSandboxBadge = () => {
    switch (sandboxStatus) {
      case 'ready':
        return {
          label: 'Sandbox Ready',
          shortLabel: 'Ready',
          className: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-400',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
        };
      case 'booting':
        return {
          label: 'Booting Sandbox...',
          shortLabel: 'Booting',
          className: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-400 animate-pulse',
          icon: <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />,
        };
      case 'error':
        return {
          label: 'Sandbox Error',
          shortLabel: 'Error',
          className: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-400',
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-400" />,
        };
      case 'uninitialized':
      default:
        return {
          label: 'Sandbox Offline',
          shortLabel: 'Offline',
          className: 'bg-slate-700/30 border-slate-700 text-slate-400 hover:text-slate-200',
          dot: 'bg-slate-500',
          icon: <Terminal className="w-3.5 h-3.5 text-slate-400" />,
        };
    }
  };

  const sandboxBadge = getSandboxBadge();

  return (
    <header className="sticky top-0 z-30 w-full bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 safe-area-top shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
        {/* Branding */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-500 shadow-sm shadow-indigo-500/20 shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm sm:text-base font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent truncate">
              Cloud Coding Agent
            </span>
            <span className="hidden sm:inline text-[10px] text-slate-400 -mt-0.5 tracking-wide">
              WebContainer &bull; GitHub Autonomy
            </span>
          </div>
        </div>

        {/* Live Status Pills & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Sandbox Status Pill */}
          <button
            type="button"
            onClick={sandboxStatus === 'uninitialized' || sandboxStatus === 'error' ? onBootSandbox : undefined}
            title={sandboxStatus === 'uninitialized' ? 'Click to boot WebContainer sandbox' : `WebContainer: ${sandboxStatus}`}
            className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${sandboxBadge.className}`}
          >
            {sandboxBadge.icon}
            <span className="hidden md:inline">{sandboxBadge.label}</span>
            <span className="md:hidden">{sandboxBadge.shortLabel}</span>
            {sandboxStatus === 'uninitialized' && (
              <RefreshCw className="w-3 h-3 ml-0.5 opacity-60 hidden sm:inline" />
            )}
          </button>

          {/* GitHub Status Pill */}
          <button
            type="button"
            onClick={onOpenSettings}
            title={hasGithubToken ? `GitHub: Connected (${githubUser?.login || 'Authenticated'})` : 'GitHub: Not configured. Click to set PAT'}
            className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              hasGithubToken
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <GithubIcon className="w-3.5 h-3.5 shrink-0" />
            {hasGithubToken ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                <span className="hidden md:inline">
                  {githubUser?.login ? `@${githubUser.login}` : 'Connected'}
                </span>
                <span className="md:hidden">Connected</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                <span className="hidden sm:inline">Set GitHub PAT</span>
                <span className="sm:hidden">GitHub</span>
              </>
            )}
          </button>

          {/* Settings Modal Button (Touch Target >= 44px) */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="touch-target p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            aria-label="Open Settings"
            title="Configure GitHub PAT and AI Model"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
