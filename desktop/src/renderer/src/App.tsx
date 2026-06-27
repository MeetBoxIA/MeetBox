'use client'
/**
 * App — root component of the MeetBox Desktop renderer.
 *
 * Three top-level states drive which screen is shown:
 *   - connection === 'checking' → loading spinner (reading persisted connection)
 *   - connection === null       → ConnectScreen (first-time or after disconnect)
 *   - connection is ConnectionData → HomeView or SettingsPanel
 *
 * Recording pipeline:
 *   1. getUserMedia for microphone
 *   2. desktopCapturer (via IPC) for system audio (Zoom/Meet/Teams)
 *   3. AudioContext to mix both streams
 *   4. MediaRecorder (audio/webm;codecs=opus) with 1-second chunks
 *   5. On stop: combine chunks → ArrayBuffer → save via IPC to ~/Documents/MeetBox
 */
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

  // Backend pipeline state (upload → processing → MeetAction session)
  const [uploadState,    setUploadState]    = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle')
  const [jobProgress,    setJobProgress]    = useState(0)
  const [jobStage,       setJobStage]       = useState<string>('')
  const [jobSessionId,   setJobSessionId]   = useState<string | null>(null)

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
  const micStreamRef     = useRef<MediaStream | null>(null)
  const sysStreamRef     = useRef<MediaStream | null>(null)
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

  // ── Captura de audio ────────────────────────────────────────────────────────
  // Graba micrófono + audio del sistema SIN pedir compartir pantalla.
  // El audio del sistema se captura desde el dispositivo "monitor" (PulseAudio/
  // PipeWire en Linux, "Stereo Mix" en Windows), que aparece como una entrada
  // de audio normal — a diferencia de chromeMediaSource:'desktop', que dispara
  // el selector de pantalla.
  const startAudioCapture = useCallback(async (): Promise<MediaStream | null> => {
    try {
      // 1. Micrófono (esto además otorga permiso para leer los labels de los
      //    dispositivos en el paso 2).
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      })

      // 2. Audio del sistema vía dispositivo "monitor"/loopback — sin prompt.
      let systemStream: MediaStream | null = null
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const monitor = devices.find(
          (d) => d.kind === 'audioinput' &&
            /monitor|loopback|stereo mix|what u hear|mezcla est/i.test(d.label),
        )
        if (monitor) {
          systemStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId:         { exact: monitor.deviceId },
              echoCancellation: false,   // no procesar el audio del sistema
              noiseSuppression: false,
              autoGainControl:  false,
            },
            video: false,
          })
        } else {
          console.warn('No se encontró dispositivo monitor de audio del sistema; grabando solo micrófono.')
        }
      } catch (sysErr) {
        console.warn('Audio del sistema no disponible, usando solo micrófono:', sysErr)
      }

      // 3. Mezclar micrófono + audio del sistema en un único MediaStream
      const ctx  = new AudioContext()
      const dest = ctx.createMediaStreamDestination()

      ctx.createMediaStreamSource(micStream).connect(dest)
      if (systemStream) ctx.createMediaStreamSource(systemStream).connect(dest)

      // Guardar ambos streams para detenerlos correctamente al finalizar
      streamRef.current   = dest.stream
      micStreamRef.current = micStream
      sysStreamRef.current = systemStream
      audioCtxRef.current = ctx
      return dest.stream
    } catch (err) {
      const domErr = err as DOMException
      console.error('getUserMedia error:', domErr.name, domErr.message)
      // Re-throw so the caller can map DOMException.name to a user-friendly message
      throw domErr
    }
  }, [])

  const stopAudioCapture = useCallback(() => {
    // Stop every source track (mixed output + raw mic + system) and close the ctx
    streamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    sysStreamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close()
    streamRef.current    = null
    micStreamRef.current = null
    sysStreamRef.current = null
    audioCtxRef.current  = null
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
    recorder.start(1000) // emit a chunk every 1s so data isn't lost on unexpected stop

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

    // Concatenate all 1-second chunks into a single Blob before saving
    const blob     = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' })
    const buffer   = await blob.arrayBuffer()
    const filename = buildFilename()

    try {
      const savedPath = await window.electronAPI.saveRecording(buffer, filename)
      setSavedFilePath(savedPath)
      setStatus('done')

      // After the local save succeeds, upload to the backend pipeline so the
      // recording is transcribed, analyzed and turned into a MeetAction session.
      void uploadToBackend(buffer, filename)
    } catch {
      setErrorMsg('Error al guardar la grabación.')
      setStatus('error')
    }
  }, [stopAudioCapture])

  // ── Upload to backend + poll the processing job ─────────────────────────────
  // The upload runs in the RENDERER using Chromium's fetch (not the main
  // process / undici), because undici fails to send multipart FormData with a
  // Blob ("fetch failed"). webSecurity is off and the endpoint sends CORS
  // headers, so a direct fetch from the renderer works reliably.
  const uploadToBackend = useCallback(async (buffer: ArrayBuffer, filename: string) => {
    // Read the connection FRESH from disk (not the React state, which may have
    // been loaded before the token/apiUrl were persisted).
    const conn = await window.electronAPI.getConnection()
    const apiUrl = conn?.apiUrl ?? 'http://localhost:3000'
    const token  = conn?.accessToken
    if (!token) {
      setUploadState('error')
      setJobStage('No hay sesión de desktop. Reconecta tu cuenta.')
      return
    }

    setUploadState('uploading')
    setJobProgress(0)
    setJobStage('Subiendo grabación…')
    setJobSessionId(null)

    const meta = {
      title:            `Reunión ${new Date().toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
      duration_seconds: timerSecs,
      recorded_at:      nowISO(),
      timezone:         Intl.DateTimeFormat().resolvedOptions().timeZone,
    }

    let jobId: string
    try {
      const form = new FormData()
      form.append('file', new Blob([buffer], { type: 'audio/webm' }), filename)
      form.append('metadata', JSON.stringify(meta))

      const res = await fetch(`${apiUrl}/api/desktop/upload`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },   // no Content-Type: browser sets the boundary
        body:    form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.job_id) {
        setUploadState('error')
        setJobStage(data.error ?? `Error ${res.status} al subir la grabación`)
        return
      }
      jobId = data.job_id
    } catch (err) {
      setUploadState('error')
      setJobStage('Error de red al subir: ' + (err instanceof Error ? err.message : String(err)))
      return
    }

    // Poll the job status until it completes or fails (max ~5 min).
    setUploadState('processing')
    const stageLabels: Record<string, string> = {
      uploaded:          'En cola…',
      queued:            'En cola…',
      transcribing:      'Transcribiendo audio…',
      analyzing:         'Analizando con IA…',
      matching_calendar: 'Buscando reunión en el calendario…',
      creating_actions:  'Creando acciones…',
      completed:         'Procesamiento completado',
      failed:            'El procesamiento falló',
    }

    const deadline = Date.now() + 5 * 60_000
    const poll = async (): Promise<void> => {
      try {
        const r = await fetch(`${apiUrl}/api/desktop/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const s = await r.json().catch(() => ({}))
        if (r.ok && s.status) {
          setJobProgress(s.progress ?? 0)
          setJobStage(stageLabels[s.status] ?? s.status)
          if (s.status === 'completed') {
            setUploadState('done')
            setJobSessionId(s.session_id ?? null)
            return
          }
          if (s.status === 'failed') {
            setUploadState('error')
            setJobStage(s.error ?? 'El procesamiento falló')
            return
          }
        }
      } catch { /* transient — keep polling */ }
      if (Date.now() < deadline) setTimeout(poll, 2000)
    }
    setTimeout(poll, 2000)
  }, [timerSecs])

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
    setUploadState('idle')
    setJobProgress(0)
    setJobStage('')
    setJobSessionId(null)
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

      {/* Backend processing banner — visible while the recording is uploaded
          and processed into a MeetAction session. */}
      {uploadState !== 'idle' && view !== 'settings' && (
        <ProcessingBanner
          state={uploadState}
          progress={jobProgress}
          stage={jobStage}
          hasSession={!!jobSessionId}
          onOpenDashboard={() => window.electronAPI.openDashboard(jobSessionId ?? undefined)}
          onDismiss={() => { setUploadState('idle'); setJobStage('') }}
        />
      )}

      {/* Vistas */}
      {view === 'settings' ? (
        <SettingsPanel
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
          onImport={async (filePath?: string) => {
            setUploadState('uploading')
            setJobProgress(0)
            setJobStage(filePath ? 'Importando grabación…' : 'Seleccionando archivo…')
            setJobSessionId(null)
            const result = await window.electronAPI.importRecording(filePath)
            if (!result.ok) {
              if (result.error === 'Cancelado') { setUploadState('idle'); return }
              setUploadState('error')
              setJobStage(result.error ?? 'Error al importar')
              return
            }
            // Poll job status using the same pipeline as a live recording
            const conn   = await window.electronAPI.getConnection()
            const apiUrl = conn?.apiUrl ?? 'http://localhost:3000'
            const token  = conn?.accessToken
            if (!token || !result.jobId) { setUploadState('error'); setJobStage('Error al iniciar procesamiento'); return }
            setUploadState('processing')
            setJobStage('En cola…')
            const stageLabels: Record<string, string> = {
              uploaded: 'En cola…', queued: 'En cola…', transcribing: 'Transcribiendo audio…',
              analyzing: 'Analizando con IA…', matching_calendar: 'Buscando en calendario…',
              creating_actions: 'Creando acciones…', completed: 'Procesamiento completado', failed: 'El procesamiento falló',
            }
            const deadline = Date.now() + 5 * 60_000
            const jobId = result.jobId
            const poll = async (): Promise<void> => {
              try {
                const r = await fetch(`${apiUrl}/api/desktop/jobs/${jobId}`, { headers: { Authorization: `Bearer ${token}` } })
                const s = await r.json().catch(() => ({}))
                if (r.ok && s.status) {
                  setJobProgress(s.progress ?? 0)
                  setJobStage(stageLabels[s.status] ?? s.status)
                  if (s.status === 'completed') { setUploadState('done'); setJobSessionId(s.session_id ?? null); return }
                  if (s.status === 'failed')    { setUploadState('error'); setJobStage(s.error ?? 'El procesamiento falló'); return }
                }
              } catch { /* transient */ }
              if (Date.now() < deadline) setTimeout(poll, 2000)
            }
            setTimeout(poll, 2000)
          }}
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
  onImport:          (filePath?: string) => void
}

function HomeView({
  status, timerSecs, transcript, savedFilePath, errorMsg, appVersion,
  onToggleRecording, onReset, onShowInFolder, onImport,
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
        onImport={onImport}
      />
    </div>
  )
}

// ── ProcessingBanner ─────────────────────────────────────────────────────────
// Compact status strip shown while the recording is uploaded to the backend
// and processed into a MeetAction session.
interface ProcessingBannerProps {
  state:           'uploading' | 'processing' | 'done' | 'error'
  progress:        number
  stage:           string
  hasSession:      boolean
  onOpenDashboard: () => void
  onDismiss:       () => void
}

function ProcessingBanner({ state, progress, stage, hasSession, onOpenDashboard, onDismiss }: ProcessingBannerProps) {
  const isError = state === 'error'
  const isDone  = state === 'done'
  const isBusy  = state === 'uploading' || state === 'processing'

  return (
    <div className={[
      'mx-4 mt-3 rounded-xl border px-4 py-3',
      isError ? 'bg-red-50 border-red-100'
        : isDone ? 'bg-emerald-50 border-emerald-100'
        : 'bg-[#050040]/4 border-[#050040]/10',
    ].join(' ')}>
      <div className="flex items-center gap-2.5">
        {isBusy && (
          <svg className="w-4 h-4 text-[#050040] animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        {isDone && (
          <svg className="w-4 h-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {isError && (
          <svg className="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none">
            <path d="M12 8v5M12 16.5v.5M5 19h14a1 1 0 0 0 .87-1.5l-7-12a1 1 0 0 0-1.74 0l-7 12A1 1 0 0 0 5 19Z"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <p className={[
          'text-xs font-semibold flex-1 truncate',
          isError ? 'text-red-700' : isDone ? 'text-emerald-700' : 'text-[#050040]',
        ].join(' ')}>
          {isDone ? 'Reunión procesada en MeetAction' : stage}
        </p>
        {(isDone || isError) && (
          <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 transition-colors text-sm leading-none">
            ✕
          </button>
        )}
      </div>

      {/* Progress bar while busy */}
      {isBusy && (
        <div className="h-1 bg-[#050040]/10 rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-[#050040] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* CTA when finished */}
      {isDone && hasSession && (
        <button
          onClick={onOpenDashboard}
          className="mt-2 w-full text-[11px] font-semibold text-white bg-[#050040] rounded-lg py-1.5 hover:bg-slate-800 transition"
        >
          Revisar acciones en el dashboard →
        </button>
      )}
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
  onReset:        () => void
  onShowInFolder: () => void
  onImport:       (filePath?: string) => void
}

function Footer({
  status, savedFilePath, errorMsg, appVersion,
  onReset, onShowInFolder, onImport,
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
              onClick={() => onImport(savedFilePath ?? undefined)}
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.electronAPI.openDashboard()}
              className="text-[10px] text-slate-400 hover:text-[#050040] transition"
            >
              Abrir dashboard →
            </button>
            <button
              onClick={() => onImport()}
              className="text-[10px] text-slate-400 hover:text-[#050040] transition"
            >
              Importar grabación
            </button>
          </div>
          <span className="text-[10px] text-slate-300">v{appVersion}</span>
        </div>
      )}
    </div>
  )
}
