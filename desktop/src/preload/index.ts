import { contextBridge, ipcRenderer } from 'electron'

// ── API expuesta al renderer (context seguro) ──────────────────────────────────
// Solo las funciones declaradas aquí son accesibles desde React.
// El renderer NO tiene acceso a Node.js ni a la API de Electron directamente.

export type RecordingStatus = 'idle' | 'recording' | 'processing' | 'done' | 'error'

export interface AudioSource {
  id: string
  name: string
}

// Definido aquí y re-exportado — el renderer importa desde su propio types.ts
// para evitar imports cross-contexto
export interface ConnectionData {
  token:       string
  user:        { id: string; name: string; email: string; avatar: string | null }
  connectedAt: string
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

  // ── Escuchar eventos desde el main process ────────────────────────────────────
  on: (
    channel: 'tray-toggle-recording' | 'update-available' | 'update-downloaded' | 'auth-token-received',
    listener: (...args: unknown[]) => void
  ) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      listener(...args)
    ipcRenderer.on(channel, subscription)
    // Retorna una función de limpieza
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
