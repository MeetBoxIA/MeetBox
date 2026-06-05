/**
 * Electron preload script — bridges the main process and the renderer.
 *
 * Exposes a typed `window.electronAPI` object via contextBridge so React
 * components can invoke IPC calls without direct access to Node.js or the
 * raw ipcRenderer. This is the security boundary: only the functions listed
 * in the `api` object below can be called from the renderer.
 */
import { contextBridge, ipcRenderer } from 'electron'

export type RecordingStatus = 'idle' | 'recording' | 'processing' | 'done' | 'error'

export interface AudioSource {
  id: string
  name: string
}

// Defined here and re-exported from renderer/src/types.ts to avoid cross-context
// imports (the renderer cannot import from preload directly in a sandboxed context).
export interface ConnectionData {
  token:        string
  accessToken?: string
  user:         { id: string; name: string; email: string; avatar: string | null }
  connectedAt:  string
}

const api = {
  // ── App info ────────────────────────────────────────────────────────────────
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),

  // ── Conexión con cuenta web ──────────────────────────────────────────────────
  getConnection:   (): Promise<ConnectionData | null> => ipcRenderer.invoke('get-connection'),
  saveConnection:  (data: ConnectionData): Promise<void> => ipcRenderer.invoke('save-connection', data),
  clearConnection: (): Promise<void> => ipcRenderer.invoke('clear-connection'),

  // ── Ventana ─────────────────────────────────────────────────────────────────
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  closeWindow:    () => ipcRenderer.send('window-close'),

  // ── Dashboard web ───────────────────────────────────────────────────────────
  openDashboard: () => ipcRenderer.send('open-dashboard'),

  // ── Auto-launch ─────────────────────────────────────────────────────────────
  getAutoLaunch: (): Promise<boolean>         => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke('set-auto-launch', enabled),

  // ── Fuentes de audio del escritorio ─────────────────────────────────────────
  getDesktopAudioSources: (): Promise<AudioSource[]> =>
    ipcRenderer.invoke('get-desktop-audio-sources'),

  // ── Guardar grabación ────────────────────────────────────────────────────────
  saveRecording: (buffer: ArrayBuffer, filename: string): Promise<string> =>
    ipcRenderer.invoke('save-recording', buffer, filename),

  showRecordingInFolder: (filePath: string) =>
    ipcRenderer.send('show-recording-in-folder', filePath),

  showSaveDialog: (defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('show-save-dialog', defaultName),

  // ── Estado de grabación → actualiza el tray ──────────────────────────────────
  notifyRecordingState: (recording: boolean) =>
    ipcRenderer.send('recording-state-changed', recording),

  // ── Auto-updater ─────────────────────────────────────────────────────────────
  installUpdate: () => ipcRenderer.send('install-update'),

  // ── HTTP proxy via Node.js (sin CORS) ─────────────────────────────────────────
  httpPost: (url: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> =>
    ipcRenderer.invoke('http-post', url, body),

  // ── Subir grabación al pipeline del backend ──────────────────────────────────
  uploadRecording: (
    buffer: ArrayBuffer, filename: string, metadata: Record<string, unknown>,
  ): Promise<{ ok: boolean; jobId?: string; error?: string }> =>
    ipcRenderer.invoke('upload-recording', buffer, filename, metadata),

  // ── Consultar estado de un job de procesamiento ──────────────────────────────
  getJobStatus: (
    jobId: string,
  ): Promise<{ ok: boolean; status?: string; progress?: number; session_id?: string | null; error?: string }> =>
    ipcRenderer.invoke('get-job-status', jobId),

  // ── Escuchar eventos desde el main process ────────────────────────────────────
  /**
   * Subscribe to events pushed from the main process.
   * Returns a cleanup function so React can call it in useEffect's return.
   */
  on: (
    channel: 'tray-toggle-recording' | 'update-available' | 'update-downloaded' | 'auth-token-received',
    listener: (...args: unknown[]) => void
  ) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      listener(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  },
}

// Exponer como window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', api)

// ── Tipos para TypeScript en el renderer ───────────────────────────────────────
declare global {
  interface Window {
    electronAPI: typeof api
  }
}
