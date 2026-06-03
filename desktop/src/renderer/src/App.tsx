'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import TitleBar from './components/TitleBar'
import RecordButton from './components/RecordButton'
import TranscriptPanel from './components/TranscriptPanel'
import SettingsPanel from './components/SettingsPanel'
import ConnectScreen from './components/ConnectScreen'
import type { ConnectionData } from './types'

// ── Tipos ──────────────────────────────────────────────────────────────────────
export type RecordingStatus = 'idle' | 'recording' | 'processing' | 'done' | 'error'

interface TranscriptLine {
  id: string
  speaker: string
  text: string
  timestamp: string
  isTask?: boolean
}

type View = 'home' | 'settings'

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function nowISO(): string {
  return new Date().toISOString()
}

function buildFilename(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `meetbox-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.webm`
}

// ── App principal ──────────────────────────────────────────────────────────────
export default function App() {
  // Conexión con la cuenta web (null = no conectado, 'checking' = verificando)
  const [connection,     setConnection]     = useState<ConnectionData | null | 'checking'>('checking')

  const [view,           setView]           = useState<View>('home')
  const [status,         setStatus]         = useState<RecordingStatus>('idle')
  const [timerSecs,      setTimerSecs]      = useState(0)
  const [transcript,     setTranscript]     = useState<TranscriptLine[]>([])
  const [savedFilePath,  setSavedFilePath]  = useState<string | null>(null)
  const [errorMsg,       setErrorMsg]       = useState<string | null>(null)
  const [updateReady,    setUpdateReady]    = useState(false)
  const [appVersion,     setAppVersion]     = useState('')

  // Comprobar si ya existe una conexión guardada al iniciar
  useEffect(() => {
    window.electronAPI.getConnection().then((saved) => {
      setConnection(saved) // null si no hay, ConnectionData si sí
    })
  }, [])

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef        = useRef<MediaStream | null>(null)
  const audioCtxRef      = useRef<AudioContext | null>(null)

  // ── Cargar versión ──────────────────────────────────────────────────────────
  useEffect(() => {
    window.electronAPI.getAppVersion().then(setAppVersion)
  }, [])

  // ── Escuchar eventos del main process ───────────────────────────────────────
  useEffect(() => {
    const cleanTray    = window.electronAPI.on('tray-toggle-recording', toggleRecording)
    const cleanUpdate  = window.electronAPI.on('update-downloaded', () => setUpdateReady(true))
    return () => { cleanTray(); cleanUpdate() }
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'recording') {
      timerRef.current = setInterval(() => setTimerSecs((s) => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      if (status === 'idle') setTimerSecs(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [status])

  // ── Simulación de transcript en vivo (sustituir por WebSocket real) ─────────
  useEffect(() => {
    if (status !== 'recording') return
    const DEMO_LINES: Omit<TranscriptLine, 'id' | 'timestamp'>[] = [
      { speaker: 'Tú',         text: 'Empezamos con el punto de ventas del Q2…' },
      { speaker: 'Ana M.',     text: 'Los números están arriba un 12% respecto al mes anterior.' },
      { speaker: 'Carlos R.',  text: 'Necesitamos revisar la estrategia de pricing.' },
      { speaker: 'Tú',         text: 'Carlos, ¿puedes preparar un análisis para el viernes?', isTask: true },
      { speaker: 'Carlos R.',  text: 'Claro, lo tengo listo el jueves.' },
    ]

    let idx = 0
    const id = setInterval(() => {
      if (idx >= DEMO_LINES.length) { clearInterval(id); return }
      const line = DEMO_LINES[idx]
      setTranscript((prev) => [
        ...prev,
        { ...line, id: `${Date.now()}-${idx}`, timestamp: nowISO() },
      ])
      idx++
    }, 4000)

    return () => clearInterval(id)
  }, [status])

  // ── Captura de audio ────────────────────────────────────────────────────────
  const startAudioCapture = useCallback(async (): Promise<MediaStream | null> => {
    try {
      // 1. Micrófono
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      })

      // 2. Audio del sistema (Zoom/Meet/Teams) — requiere fuente de desktopCapturer
      let systemStream: MediaStream | null = null
      try {
        const sources = await window.electronAPI.getDesktopAudioSources()
        const screenSource = sources.find((s) => s.name.toLowerCase().includes('screen')) ?? sources[0]

        if (screenSource) {
          systemStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              // @ts-expect-error — API Chromium/Electron específica
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: screenSource.id,
              },
            },
            video: false,
          })
        }
      } catch (sysErr) {
        console.warn('Audio del sistema no disponible, usando solo micrófono:', sysErr)
      }

      // 3. Mezclar streams con AudioContext
      const ctx  = new AudioContext()
      const dest = ctx.createMediaStreamDestination()

      ctx.createMediaStreamSource(micStream).connect(dest)
      if (systemStream) ctx.createMediaStreamSource(systemStream).connect(dest)

      audioCtxRef.current = ctx
      streamRef.current   = dest.stream
      return dest.stream
    } catch (err) {
      const domErr = err as DOMException
      console.error('getUserMedia error:', domErr.name, domErr.message)
      // Re-lanzar con mensaje específico para que el caller lo muestre
      throw domErr
    }
  }, [])

  const stopAudioCapture = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close()
    streamRef.current  = null
    audioCtxRef.current = null
  }, [])

  // ── Start / Stop grabación ──────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setErrorMsg(null)
    setTranscript([])
    setSavedFilePath(null)

    let stream: MediaStream | null = null
    try {
      stream = await startAudioCapture()
    } catch (err) {
      const domErr = err as DOMException
      const msgs: Record<string, string> = {
        NotAllowedError:    'Permiso de micrófono denegado. Ve a Configuración del sistema y permite el acceso.',
        NotFoundError:      'No se encontró ningún micrófono. Conecta uno e intenta de nuevo.',
        NotReadableError:   'El micrófono está en uso por otra app. Ciérrala e intenta de nuevo.',
        OverconstrainedError: 'Las restricciones de audio no son compatibles con tu micrófono.',
      }
      setErrorMsg(msgs[domErr.name] ?? `Error de audio: ${domErr.name} — ${domErr.message}`)
      setStatus('error')
      window.electronAPI.notifyRecordingState(false)
      return
    }
    if (!stream) {
      setErrorMsg('No se pudo inicializar el audio.')
      return
    }

    audioChunksRef.current = []
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data)
    }
    mediaRecorderRef.current = recorder
    recorder.start(1000) // chunk cada 1s

    setStatus('recording')
    window.electronAPI.notifyRecordingState(true)
  }, [startAudioCapture])

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return

    setStatus('processing')
    window.electronAPI.notifyRecordingState(false)

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
      recorder.stop()
    })

    stopAudioCapture()

    // Combinar chunks en un solo Blob
    const blob     = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' })
    const buffer   = await blob.arrayBuffer()
    const filename = buildFilename()

    try {
      const savedPath = await window.electronAPI.saveRecording(buffer, filename)
      setSavedFilePath(savedPath)
      setStatus('done')
    } catch {
      setErrorMsg('Error al guardar la grabación.')
      setStatus('error')
    }
  }, [stopAudioCapture])

  const toggleRecording = useCallback(() => {
    if (status === 'idle' || status === 'done' || status === 'error') {
      startRecording()
    } else if (status === 'recording') {
      stopRecording()
    }
  }, [status, startRecording, stopRecording])

  const resetToIdle = () => {
    setStatus('idle')
    setTranscript([])
    setSavedFilePath(null)
    setErrorMsg(null)
    setTimerSecs(0)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  // Pantalla de carga mientras se verifica la conexión guardada
  if (connection === 'checking') {
    return (
      <div className="flex flex-col h-screen bg-white select-none overflow-hidden font-sans items-center justify-center">
        <svg className="w-6 h-6 text-slate-200 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    )
  }

  // Pantalla de conexión — primera vez o si el token fue revocado
  if (!connection) {
    return (
      <div className="flex flex-col h-screen bg-white select-none overflow-hidden font-sans">
        <TitleBar
          onMinimize={() => window.electronAPI.minimizeWindow()}
          onClose={() => window.electronAPI.closeWindow()}
          onSettings={() => {}}
          showingSettings={false}
        />
        <ConnectScreen onConnected={(data) => setConnection(data)} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-white select-none overflow-hidden font-sans">
      {/* Titlebar con drag region */}
      <TitleBar
        onMinimize={() => window.electronAPI.minimizeWindow()}
        onClose={() => window.electronAPI.closeWindow()}
        onSettings={() => setView(view === 'settings' ? 'home' : 'settings')}
        showingSettings={view === 'settings'}
      />

      {/* Update banner */}
      {updateReady && (
        <div className="bg-amber-500 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between">
          <span>Actualización lista para instalar</span>
          <button
            onClick={() => window.electronAPI.installUpdate()}
            className="underline hover:no-underline"
          >
            Reiniciar
          </button>
        </div>
      )}

      {/* Vistas */}
      {view === 'settings' ? (
        <SettingsPanel
          onBack={() => setView('home')}
          onDisconnect={() => setConnection(null)}
        />
      ) : (
        <HomeView
          status={status}
          timerSecs={timerSecs}
          transcript={transcript}
          savedFilePath={savedFilePath}
          errorMsg={errorMsg}
          appVersion={appVersion}
          onToggleRecording={toggleRecording}
          onReset={resetToIdle}
          onShowInFolder={() =>
            savedFilePath && window.electronAPI.showRecordingInFolder(savedFilePath)
          }
          onOpenDashboard={() => window.electronAPI.openDashboard()}
        />
      )}
    </div>
  )
}

// ── HomeView ───────────────────────────────────────────────────────────────────
interface HomeViewProps {
  status:          RecordingStatus
  timerSecs:       number
  transcript:      TranscriptLine[]
  savedFilePath:   string | null
  errorMsg:        string | null
  appVersion:      string
  onToggleRecording: () => void
  onReset:           () => void
  onShowInFolder:    () => void
  onOpenDashboard:   () => void
}

function HomeView({
  status, timerSecs, transcript, savedFilePath, errorMsg, appVersion,
  onToggleRecording, onReset, onShowInFolder, onOpenDashboard,
}: HomeViewProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex flex-col items-center pt-6 pb-4 px-6">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-5">
          <svg width="24" height="31" viewBox="0 0 31 40" fill="none">
            <path
              d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585"
              stroke="#050040" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
          <span className="text-base font-semibold text-[#050040] tracking-tight">MeetBox Desktop</span>
        </div>

        {/* Botón de grabación */}
        <RecordButton
          status={status}
          timer={formatTimer(timerSecs)}
          onClick={onToggleRecording}
        />

        {/* Estado textual */}
        <StatusLabel status={status} timer={formatTimer(timerSecs)} />
      </div>

      {/* ── Transcript ── */}
      <TranscriptPanel lines={transcript} status={status} />

      {/* ── Footer ── */}
      <Footer
        status={status}
        savedFilePath={savedFilePath}
        errorMsg={errorMsg}
        appVersion={appVersion}
        onReset={onReset}
        onShowInFolder={onShowInFolder}
        onOpenDashboard={onOpenDashboard}
      />
    </div>
  )
}

// ── StatusLabel ────────────────────────────────────────────────────────────────
function StatusLabel({ status, timer }: { status: RecordingStatus; timer: string }) {
  const map: Record<RecordingStatus, { text: string; color: string }> = {
    idle:       { text: 'Listo para grabar',        color: 'text-slate-400' },
    recording:  { text: `Grabando · ${timer}`,      color: 'text-red-500'   },
    processing: { text: 'Guardando grabación…',     color: 'text-amber-500' },
    done:       { text: 'Grabación completada',     color: 'text-emerald-600' },
    error:      { text: 'Error en la grabación',    color: 'text-red-600'   },
  }
  const { text, color } = map[status]
  return (
    <p className={`mt-3 text-xs font-semibold ${color} text-center`}>{text}</p>
  )
}

// ── Footer ─────────────────────────────────────────────────────────────────────
interface FooterProps {
  status:        RecordingStatus
  savedFilePath: string | null
  errorMsg:      string | null
  appVersion:    string
  onReset:         () => void
  onShowInFolder:  () => void
  onOpenDashboard: () => void
}

function Footer({
  status, savedFilePath, errorMsg, appVersion,
  onReset, onShowInFolder, onOpenDashboard,
}: FooterProps) {
  return (
    <div className="border-t border-slate-100 px-5 py-4 flex flex-col gap-3">
      {/* Error */}
      {errorMsg && (
        <p className="text-xs text-red-500 text-center bg-red-50 rounded-xl px-3 py-2">
          {errorMsg}
        </p>
      )}

      {/* Post-grabación */}
      {status === 'done' && savedFilePath && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex flex-col gap-2">
          <p className="text-xs text-emerald-700 font-semibold">
            ✓ Guardado en Documentos/MeetBox
          </p>
          <p className="text-[10px] text-slate-500 break-all font-mono">{savedFilePath}</p>
          <div className="flex gap-2">
            <button
              onClick={onShowInFolder}
              className="flex-1 text-xs text-slate-600 border border-slate-200 bg-white rounded-lg py-1.5 hover:bg-slate-50 transition"
            >
              Ver archivo
            </button>
            <button
              onClick={onOpenDashboard}
              className="flex-1 text-xs text-white bg-[#050040] rounded-lg py-1.5 hover:bg-slate-800 transition font-semibold"
            >
              Importar al dashboard
            </button>
          </div>
        </div>
      )}

      {/* Grabar otra */}
      {(status === 'done' || status === 'error') && (
        <button
          onClick={onReset}
          className="w-full text-xs text-slate-500 hover:text-[#050040] transition py-1"
        >
          Grabar otra reunión
        </button>
      )}

      {/* Links de pie */}
      {status === 'idle' && (
        <div className="flex items-center justify-between">
          <button
            onClick={onOpenDashboard}
            className="text-[10px] text-slate-400 hover:text-[#050040] transition"
          >
            Abrir dashboard web →
          </button>
          <span className="text-[10px] text-slate-300">v{appVersion}</span>
        </div>
      )}
    </div>
  )
}
