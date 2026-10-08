/**
 * Client-only WebContainer singleton manager.
 * Provides memoized boot lifecycle, virtual filesystem operations,
 * process execution, and server event listeners.
 */

import type {
  WebContainer,
  WebContainerProcess,
  SpawnOptions,
  DirEnt,
} from '@webcontainer/api';
import type {
  SandboxStatus,
  WebContainerInstance,
} from '@/types/sandbox';

declare global {
  interface Window {
    __webcontainerPromise?: Promise<WebContainer>;
    __webcontainerInstance?: WebContainer;
  }
}

let bootPromise: Promise<WebContainer> | null = null;
let activeInstance: WebContainer | null = null;
let currentStatus: SandboxStatus = 'uninitialized';

const serverReadyListeners = new Set<(port: number, url: string) => void>();
const portChangeListeners = new Set<
  (port: number, type: 'open' | 'close', url?: string) => void
>();
let nativeListenersAttached = false;

function assertBrowserEnvironment(): void {
  if (typeof window === 'undefined') {
    throw new Error(
      'WebContainer can only be initialized and executed in a browser environment.'
    );
  }
}

function attachNativeEventListeners(instance: WebContainer): void {
  if (nativeListenersAttached) return;
  nativeListenersAttached = true;

  instance.on('server-ready', (port: number, url: string) => {
    for (const listener of serverReadyListeners) {
      try {
        listener(port, url);
      } catch (err) {
        console.error('Error in WebContainer server-ready listener:', err);
      }
    }
  });

  instance.on('port', (port: number, type: 'open' | 'close', url: string) => {
    for (const listener of portChangeListeners) {
      try {
        listener(port, type, url);
      } catch (err) {
        console.error('Error in WebContainer port listener:', err);
      }
    }
  });
}

/**
 * Boots or retrieves the memoized WebContainer singleton.
 * Prevents concurrent boot calls across React renders and HMR updates.
 */
export async function getWebContainer(): Promise<WebContainer> {
  assertBrowserEnvironment();

  if (activeInstance) {
    return activeInstance;
  }

  // Reuse window-cached promise across HMR updates in development
  if (window.__webcontainerPromise) {
    bootPromise = window.__webcontainerPromise;
    try {
      const instance = await bootPromise;
      activeInstance = instance;
      window.__webcontainerInstance = instance;
      attachNativeEventListeners(instance);
      currentStatus = 'ready';
      return instance;
    } catch (err) {
      currentStatus = 'error';
      throw err;
    }
  }

  if (bootPromise) {
    return bootPromise;
  }

  currentStatus = 'booting';

  bootPromise = (async () => {
    try {
      const { WebContainer } = await import('@webcontainer/api');
      const instance = await WebContainer.boot();
      activeInstance = instance;
      window.__webcontainerInstance = instance;
      attachNativeEventListeners(instance);
      currentStatus = 'ready';
      return instance;
    } catch (err) {
      currentStatus = 'error';
      bootPromise = null;
      if (typeof window !== 'undefined') {
        delete window.__webcontainerPromise;
        delete window.__webcontainerInstance;
      }
      throw err;
    }
  })();

  if (typeof window !== 'undefined') {
    window.__webcontainerPromise = bootPromise;
  }

  return bootPromise;
}

/**
 * Alias for getWebContainer to satisfy WebContainerInstance interface.
 */
export async function bootWebContainer(): Promise<WebContainer> {
  return getWebContainer();
}

/**
 * Returns current status of the WebContainer runtime.
 */
export function getStatus(): SandboxStatus {
  return currentStatus;
}

/**
 * Writes a file to the WebContainer virtual file system.
 * Automatically creates parent directories if needed.
 */
export async function writeFile(path: string, content: string): Promise<void> {
  assertBrowserEnvironment();
  const wc = await getWebContainer();

  // Create parent directory if path contains directories
  const normalized = path.replace(/\\/g, '/');
  const lastSlashIndex = normalized.lastIndexOf('/');
  if (lastSlashIndex > 0) {
    const parentDir = normalized.slice(0, lastSlashIndex);
    await wc.fs.mkdir(parentDir, { recursive: true });
  }

  await wc.fs.writeFile(path, content, 'utf-8');
}

/**
 * Reads a UTF-8 text file from the WebContainer virtual file system.
 */
export async function readFile(path: string): Promise<string> {
  assertBrowserEnvironment();
  const wc = await getWebContainer();
  return await wc.fs.readFile(path, 'utf-8');
}

/**
 * Removes a file or directory from the WebContainer virtual file system.
 */
export async function rm(
  path: string,
  options: { recursive?: boolean; force?: boolean } = { recursive: true, force: true }
): Promise<void> {
  assertBrowserEnvironment();
  const wc = await getWebContainer();
  await wc.fs.rm(path, options);
}

/**
 * Creates a directory in the WebContainer virtual file system.
 */
export async function mkdir(
  path: string,
  options: { recursive?: boolean } = { recursive: true }
): Promise<string | void> {
  assertBrowserEnvironment();
  const wc = await getWebContainer();
  return await wc.fs.mkdir(path, options as { recursive: true });
}

/**
 * Reads contents of a directory in the WebContainer virtual file system.
 */
export async function readdir(
  path: string,
  options?: { withFileTypes?: boolean }
): Promise<string[] | DirEnt<string>[]> {
  assertBrowserEnvironment();
  const wc = await getWebContainer();
  if (options?.withFileTypes) {
    return await wc.fs.readdir(path, { withFileTypes: true });
  }
  return await wc.fs.readdir(path);
}

/**
 * Spawns a process inside the WebContainer instance.
 * Returns a WebContainerProcess with streamable output and input streams.
 */
export async function spawn(
  command: string,
  args: string[] = [],
  options?: SpawnOptions
): Promise<WebContainerProcess> {
  assertBrowserEnvironment();
  const wc = await getWebContainer();
  return await wc.spawn(command, args, options);
}

/**
 * Subscribes to the server-ready event emitted when an in-container HTTP server starts listening.
 * Returns an unsubscribe cleanup function.
 */
export function onServerReady(
  callback: (port: number, url: string) => void
): () => void {
  serverReadyListeners.add(callback);
  return () => {
    serverReadyListeners.delete(callback);
  };
}

/**
 * Subscribes to port open/close events.
 * Returns an unsubscribe cleanup function.
 */
export function onPortChange(
  callback: (port: number, type: 'open' | 'close', url?: string) => void
): () => void {
  portChangeListeners.add(callback);
  return () => {
    portChangeListeners.delete(callback);
  };
}

/**
 * Tears down the active WebContainer instance and resets all singleton state.
 */
export async function teardownWebContainer(): Promise<void> {
  if (activeInstance) {
    try {
      activeInstance.teardown();
    } catch {
      // Ignore teardown errors if already stopped
    }
  }
  activeInstance = null;
  bootPromise = null;
  currentStatus = 'uninitialized';
  nativeListenersAttached = false;
  if (typeof window !== 'undefined') {
    delete window.__webcontainerPromise;
    delete window.__webcontainerInstance;
  }
}

/**
 * Consolidated WebContainer singleton manager implementing WebContainerInstance interface.
 */
export const webcontainerManager: WebContainerInstance = {
  boot: bootWebContainer,
  getInstance: getWebContainer,
  writeFile,
  readFile,
  rm,
  mkdir,
  readdir,
  spawn,
  onServerReady,
  onPortChange,
  getStatus,
};

export default webcontainerManager;
