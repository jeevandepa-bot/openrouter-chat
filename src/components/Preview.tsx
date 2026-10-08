'use client';

import React, { useState } from 'react';
import {
  Globe,
  RefreshCw,
  ExternalLink,
  Play,
  Loader2,
  Server,
} from 'lucide-react';

export interface PreviewProps {
  url: string | null;
  port: number | null;
  onReload: () => void;
  onStartDemoServer?: () => Promise<void>;
  isStartingDemo?: boolean;
}

export function Preview({
  url,
  port,
  onReload,
  onStartDemoServer,
  isStartingDemo = false,
}: PreviewProps) {
  const [iframeKey, setIframeKey] = useState(0);

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
    onReload();
  };

  const handleOpenExternal = () => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Address & Navigation Bar */}
      <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Globe className="w-4 h-4 text-purple-400 shrink-0" />
          {/* Simulated Browser Address Bar */}
          <div className="flex-1 max-w-lg h-9 px-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs font-mono text-slate-300">
            <span className="truncate">
              {url || 'No active local server'}
            </span>
            {port && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded shrink-0">
                Port {port}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={!url}
            title="Reload preview"
            className="touch-target p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white transition-colors border border-slate-700"
            aria-label="Reload"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleOpenExternal}
            disabled={!url}
            title="Open preview in new tab"
            className="touch-target p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white transition-colors border border-slate-700"
            aria-label="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview Viewport */}
      <div className="flex-1 bg-white relative overflow-hidden flex flex-col">
        {url ? (
          <iframe
            key={iframeKey}
            src={url}
            title="WebContainer Live Preview"
            // credentialless allows cross-origin isolation subresource loading inside iframe
            {...({ credentialless: 'true' } as Record<string, string>)}
            className="w-full h-full border-none bg-white"
            sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
          />
        ) : (
          <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shadow-sm">
              <Server className="w-8 h-8" />
            </div>

            <div className="max-w-sm space-y-1">
              <h3 className="text-sm font-semibold text-slate-200">
                No In-Container Server Running
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Start a Node.js web server inside the sandbox. When the server listens on a port, WebContainer emits a <code className="text-purple-300">server-ready</code> event and the live preview will automatically mount here.
              </p>
            </div>

            {onStartDemoServer && (
              <button
                type="button"
                onClick={onStartDemoServer}
                disabled={isStartingDemo}
                className="touch-target px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-semibold text-white transition-all shadow-md shadow-purple-600/20 flex items-center gap-2"
              >
                {isStartingDemo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Booting Demo Server...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Demo Server (Port 3000)</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Preview;
