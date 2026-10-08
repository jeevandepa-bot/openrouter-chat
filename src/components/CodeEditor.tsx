'use client';

import React, { useState } from 'react';
import {
  FileCode,
  Plus,
  Save,
  Play,
  RefreshCw,
  Check,
  ChevronDown,
} from 'lucide-react';

export interface CodeEditorProps {
  files: Array<{ path: string; isDir?: boolean }>;
  currentFilePath: string;
  fileContent: string;
  onSelectFile: (path: string) => void;
  onSaveFile: (path: string, content: string) => Promise<void>;
  onCreateFile: (path: string) => Promise<void>;
  onRunFile?: (path: string) => void;
  onRefreshFiles?: () => void;
  sandboxReady: boolean;
}

export function CodeEditor({
  files,
  currentFilePath,
  fileContent,
  onSelectFile,
  onSaveFile,
  onCreateFile,
  onRunFile,
  onRefreshFiles,
  sandboxReady,
}: CodeEditorProps) {
  const [content, setContent] = useState(fileContent);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  // Keep local editor draft in sync when active file or content prop changes
  const [prevTracked, setPrevTracked] = useState({ path: currentFilePath, content: fileContent });
  if (prevTracked.path !== currentFilePath || prevTracked.content !== fileContent) {
    setPrevTracked({ path: currentFilePath, content: fileContent });
    setContent(fileContent);
  }

  const hasUnsavedChanges = content !== fileContent;

  const handleSave = async () => {
    if (!currentFilePath || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveFile(currentFilePath, content);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const cleanPath = newFileName.trim().startsWith('/')
      ? newFileName.trim().slice(1)
      : newFileName.trim();
    await onCreateFile(cleanPath);
    setNewFileName('');
    setIsNewFileModalOpen(false);
  };

  const lineCount = content.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1);

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Controls Bar */}
      <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* File Selector Dropdown / Current File */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
          <div className="relative flex-1 max-w-xs">
            <select
              value={currentFilePath}
              onChange={(e) => onSelectFile(e.target.value)}
              className="w-full h-9 pl-8 pr-7 rounded-lg bg-slate-950 border border-slate-700/80 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono appearance-none truncate"
            >
              {files.length === 0 ? (
                <option value="">No files in sandbox</option>
              ) : (
                files.map((f) => (
                  <option key={f.path} value={f.path}>
                    {f.isDir ? `📁 ${f.path}/` : `📄 ${f.path}`}
                  </option>
                ))
              )}
            </select>
            <FileCode className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
          </div>

          {/* New File Button */}
          <button
            type="button"
            onClick={() => setIsNewFileModalOpen(true)}
            title="Create new file"
            className="touch-target p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 shrink-0"
            aria-label="New file"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Refresh Tree Button */}
          {onRefreshFiles && (
            <button
              type="button"
              onClick={onRefreshFiles}
              title="Refresh files"
              className="touch-target p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 shrink-0"
              aria-label="Refresh files"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Buttons: Save & Run */}
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="text-[11px] text-amber-400 font-medium px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              Unsaved
            </span>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!currentFilePath || isSaving || !hasUnsavedChanges}
            className="touch-target px-3 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-medium text-slate-200 hover:text-white transition-all flex items-center gap-1.5 border border-slate-700"
          >
            {justSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-slate-400" />
                <span>Save</span>
              </>
            )}
          </button>

          {onRunFile && currentFilePath && (
            <button
              type="button"
              onClick={() => onRunFile(currentFilePath)}
              disabled={!sandboxReady}
              title={sandboxReady ? `Run node ${currentFilePath}` : 'Boot sandbox to run file'}
              className="touch-target px-3 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-semibold text-white transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run</span>
            </button>
          )}
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden relative bg-[#0d1117]">
        {/* Line Numbers */}
        <div className="hidden sm:block w-12 py-3 px-2 bg-slate-950/80 border-r border-slate-800/80 text-right font-mono text-xs text-slate-600 select-none overflow-hidden shrink-0">
          {lineNumbers.map((num) => (
            <div key={num} className="leading-6">
              {num}
            </div>
          ))}
        </div>

        {/* Textarea Code Editor */}
        <div className="flex-1 h-full overflow-auto relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={!currentFilePath}
            placeholder={
              sandboxReady
                ? 'Select a file to edit or create a new file in the WebContainer sandbox...'
                : 'WebContainer sandbox is initializing. Once ready, files will appear here.'
            }
            className="w-full h-full p-3 font-mono text-xs sm:text-sm text-slate-200 bg-transparent resize-none focus:outline-none leading-6 placeholder-slate-600 selection:bg-indigo-500/30"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="h-7 px-3 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between shrink-0 font-mono">
        <div className="flex items-center gap-3">
          <span>{currentFilePath ? `/${currentFilePath}` : 'No file selected'}</span>
          <span>{lineCount} lines</span>
        </div>
        <div>
          <span>{content.length} bytes</span>
        </div>
      </div>

      {/* New File Modal */}
      {isNewFileModalOpen && (
        <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateFile}
            className="w-full max-w-sm p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-xl space-y-3"
          >
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-indigo-400" />
              New Virtual File
            </h3>
            <p className="text-xs text-slate-400">
              Enter file path inside WebContainer (e.g. <code className="text-indigo-300">index.js</code> or <code className="text-indigo-300">src/app.js</code>):
            </p>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="filename.js"
              autoFocus
              className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsNewFileModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newFileName.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition-all shadow-sm"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default CodeEditor;
