import React, { useState } from 'react'
import type { ConnectionData } from '../types'

// La URL del backend — configurable via variable de entorno en el build
const MEETBOX_API: string = (
  typeof import.meta !== 'undefined' && (import.meta as Record<string, unknown>).env
    ? ((import.meta as Record<string, unknown>).env as Record<string, string>).VITE_MEETBOX_API_URL
    : undefined
) ?? 'http://localhost:3000'

interface ConnectScreenProps {
  onConnected: (data: ConnectionData) => void
}

export default function ConnectScreen({ onConnected }: ConnectScreenProps) {
  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [step,    setStep]    = useState<'input' | 'success'>('input')
  const [user,    setUser]    = useState<ConnectionData['user'] | null>(null)

  const normalized = code.trim().toUpperCase()
  const isValid    = /^MBOX-[0-9A-F]{8}$/.test(normalized)

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setLoading(true)
    setError(null)

    try {
      const res  = await fetch(`${MEETBOX_API}/api/auth/desktop/connect`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token: normalized }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Código inválido. Verifica e intenta de nuevo.')
        setLoading(false)
        return
      }

      const connection: ConnectionData = {
        token:       normalized,
        user:        data.user,
        connectedAt: new Date().toISOString(),
      }

      await window.electronAPI.saveConnection(connection)
      setUser(data.user)
      setStep('success')

      // Avanzar a la pantalla principal tras 1.5s
      setTimeout(() => onConnected(connection), 1500)
    } catch {
      setError('No se pudo conectar. Verifica tu conexión a internet.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 py-8 gap-6">

      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-[#050040] flex items-center justify-center shadow-lg shadow-[#050040]/20">
          <svg width="28" height="36" viewBox="0 0 31 40" fill="none">
            <path
              d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585"
              stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-lg font-bold text-[#050040]">MeetBox Desktop</h1>
          <p className="text-xs text-slate-400 mt-0.5">Conecta con tu cuenta</p>
        </div>
      </div>

      {step === 'success' && user ? (
        /* ── Éxito ── */
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-emerald-600" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">¡Conectado!</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Bienvenido, <span className="font-medium text-[#050040]">{user.name}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">{user.email}</p>
          </div>
          <p className="text-xs text-slate-400">Cargando MeetBox…</p>
        </div>
      ) : (
        /* ── Formulario ── */
        <form onSubmit={handleConnect} className="w-full space-y-4">
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5">
            <p className="text-xs font-semibold text-slate-600">¿Cómo obtener el código?</p>
            <ol className="space-y-1.5">
              {[
                'Abre el dashboard web de MeetBox',
                'Ve a Integraciones → MeetBox Desktop',
                'Copia el código MBOX-XXXXXXXX',
              ].map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-slate-500">
                  <span className="w-4 h-4 rounded-full bg-[#050040]/10 text-[#050040] text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => window.electronAPI.openDashboard()}
              className="text-[11px] font-semibold text-[#050040] hover:underline"
            >
              Abrir dashboard web →
            </button>
          </div>

          {/* Input del código */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Código de conexión
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(null) }}
              placeholder="MBOX-XXXXXXXX"
              maxLength={13}
              autoFocus
              className={[
                'w-full px-4 py-3 rounded-xl border text-center font-mono text-base font-bold tracking-widest',
                'outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-300 placeholder:text-sm',
                error
                  ? 'border-red-300 bg-red-50 text-red-700 focus:border-red-400'
                  : isValid
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 focus:border-emerald-400'
                    : 'border-slate-200 bg-white text-[#050040] focus:border-[#050040]/40',
              ].join(' ')}
            />
            {error && (
              <p className="mt-1.5 text-[11px] text-red-600 text-center">{error}</p>
            )}
          </div>

          {/* Botón conectar */}
          <button
            type="submit"
            disabled={!isValid || loading}
            className={[
              'w-full py-3 rounded-xl text-sm font-semibold transition',
              isValid && !loading
                ? 'bg-[#050040] text-white hover:bg-slate-800'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed',
            ].join(' ')}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Conectando…
              </span>
            ) : 'Conectar cuenta'}
          </button>
        </form>
      )}
    </div>
  )
}
