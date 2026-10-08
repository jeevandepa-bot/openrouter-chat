'use client';

import React from 'react';
import {
  MessageSquare,
  Code2,
  Terminal,
  Globe,
  CheckCircle,
} from 'lucide-react';

export type WorkspaceTab = 'chat' | 'code' | 'terminal' | 'preview' | 'verify';

export interface TabNavigationProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  previewPort?: number | null;
  previewActive?: boolean;
  terminalRunning?: boolean;
  verifySuccess?: boolean | null;
  isDesktop?: boolean;
}

interface TabItem {
  id: WorkspaceTab;
  label: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}

export function TabNavigation({
  activeTab,
  onTabChange,
  previewPort,
  previewActive,
  terminalRunning,
  verifySuccess,
  isDesktop = false,
}: TabNavigationProps) {
  const tabs: TabItem[] = [
    // Include Chat tab on mobile; on desktop dual-pane, Chat is pinned in left pane
    ...(!isDesktop
      ? [
          {
            id: 'chat' as WorkspaceTab,
            label: 'Chat',
            icon: <MessageSquare className="w-4 h-4" />,
          },
        ]
      : []),
    {
      id: 'code' as WorkspaceTab,
      label: 'Code',
      icon: <Code2 className="w-4 h-4" />,
    },
    {
      id: 'terminal' as WorkspaceTab,
      label: 'Terminal',
      icon: <Terminal className="w-4 h-4" />,
      badge: terminalRunning ? (
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-1" />
      ) : undefined,
    },
    {
      id: 'preview' as WorkspaceTab,
      label: 'Preview',
      icon: <Globe className="w-4 h-4" />,
      badge: previewActive && previewPort ? (
        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-1.5 py-0.5 rounded-full ml-1 border border-emerald-500/30">
          :{previewPort}
        </span>
      ) : undefined,
    },
    {
      id: 'verify' as WorkspaceTab,
      label: 'Verify',
      icon: <CheckCircle className="w-4 h-4" />,
      badge:
        verifySuccess === true ? (
          <span className="w-2 h-2 rounded-full bg-emerald-400 ml-1" />
        ) : verifySuccess === false ? (
          <span className="w-2 h-2 rounded-full bg-rose-400 ml-1" />
        ) : undefined,
    },
  ];

  return (
    <nav
      aria-label="Workspace tabs"
      className="w-full bg-slate-900 border-b border-slate-800 px-2 sm:px-4 shrink-0 overflow-x-auto no-scrollbar"
    >
      <div className="flex items-center gap-1 min-w-full justify-start sm:justify-center py-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`touch-target flex-1 min-w-[72px] sm:min-w-[96px] h-11 px-2.5 sm:px-4 rounded-lg font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all select-none relative ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default TabNavigation;
