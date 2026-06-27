import type { ConnectionData, AudioSource } from './types'

declare global {
  interface Window {
    electronAPI: {
      getAppVersion:          () => Promise<string>
      getConnection:          () => Promise<ConnectionData | null>
      saveConnection:         (data: ConnectionData) => Promise<void>
      clearConnection:        () => Promise<void>
      minimizeWindow:         () => void
      closeWindow:            () => void
      openDashboard:          (sessionId?: string) => void
      focusDashboard:         () => void
      importRecording:        (filePath?: string) => Promise<{ ok: boolean; jobId?: string; error?: string }>
      getAutoLaunch:          () => Promise<boolean>
      setAutoLaunch:          (enabled: boolean) => Promise<boolean>
      getDesktopAudioSources: () => Promise<AudioSource[]>
      saveRecording:          (buffer: ArrayBuffer, filename: string) => Promise<string>
      showRecordingInFolder:  (filePath: string) => void
      showSaveDialog:         (defaultName: string) => Promise<string | null>
      notifyRecordingState:   (recording: boolean) => void
      installUpdate:          () => void
      httpPost: (
        url: string,
        body: unknown,
      ) => Promise<{ ok: boolean; status: number; data: Record<string, unknown> }>
      uploadRecording: (
        buffer: ArrayBuffer,
        filename: string,
        metadata: Record<string, unknown>,
      ) => Promise<{ ok: boolean; jobId?: string; error?: string }>
      getJobStatus: (
        jobId: string,
      ) => Promise<{ ok: boolean; status?: string; progress?: number; session_id?: string | null; error?: string }>
      on: (
        channel: 'tray-toggle-recording' | 'update-available' | 'update-downloaded' | 'auth-token-received',
        listener: (...args: unknown[]) => void,
      ) => () => void
    }
  }
}
