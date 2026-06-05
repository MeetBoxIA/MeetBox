import React, { useEffect, useState } from 'react'
import { Monitor, LogIn, RefreshCw, LogOut } from 'lucide-react'

interface SettingsPanelProps {
  onBack:       () => void
  onDisconnect?: () => void
}

export default function SettingsPanel({ onBack, onDisconnect }: SettingsPanelProps) {
  const [autoLaunch,    setAutoLaunch]    = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [version,       setVersion]       = useState('')
  const [connectedUser, setConnectedUser] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    Promise.all([
      window.electronAPI.getAutoLaunch(),
      window.electronAPI.getAppVersion(),
      window.electronAPI.getConnection(),
    ]).then(([al, v, conn]) => {
      setAutoLaunch(al)
      setVersion(v)
      if (conn) setConnectedUser(conn.user.email)
      setLoading(false)
    })
  }, [])

  async function handleDisconnect() {
    setDisconnecting(true)
    await window.electronAPI.clearConnection()
    onDisconnect?.()
  }

  const handleAutoLaunchToggle = async () => {
    setSaving(true)
    const next = !autoLaunch
    await window.electronAPI.setAutoLaunch(next)
    setAutoLaunch(next)
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

      {/* Sección — comportamiento */}
      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Comportamiento
        </p>

        <div className="bg-slate-50 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          {/* Auto-launch */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-3">
              <Monitor className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs font-semibold text-slate-700">Iniciar con el sistema</p>
                <p className="text-[10px] text-slate-400">Abre MeetBox al encender tu equipo</p>
              </div>
            </div>
            <Toggle
              enabled={autoLaunch}
              disabled={saving}
              onChange={handleAutoLaunchToggle}
            />
          </div>
        </div>
      </div>

      {/* Sección — cuenta */}
      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Cuenta
        </p>

        <div className="bg-slate-50 rounded-2xl overflow-hidden divide-y divide-slate-100">
          {/* Cuenta conectada */}
          {connectedUser && (
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-7 h-7 rounded-full bg-[#050040] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {connectedUser[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{connectedUser}</p>
                <p className="text-[10px] text-emerald-600 font-medium">Conectado</p>
              </div>
            </div>
          )}

          {/* Dashboard web */}
          <button
            onClick={() => window.electronAPI.openDashboard()}
            className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-slate-100 transition text-left"
          >
            <LogIn className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-700">Abrir dashboard web</p>
              <p className="text-[10px] text-slate-400">Historial, notas y calendario</p>
            </div>
            <svg className="w-3 h-3 text-slate-300 ml-auto" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 2.5L9 6l-4.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Desconectar */}
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-red-50 transition text-left group"
          >
            <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-500 flex-shrink-0 transition-colors" />
            <div>
              <p className="text-xs font-semibold text-slate-700 group-hover:text-red-600 transition-colors">
                {disconnecting ? 'Desconectando…' : 'Desconectar cuenta'}
              </p>
              <p className="text-[10px] text-slate-400">Necesitarás el código otra vez</p>
            </div>
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="pt-2 text-center">
        <p className="text-[10px] text-slate-300">MeetBox Desktop v{version}</p>
        <p className="text-[10px] text-slate-200 mt-0.5">© 2025 MeetBox · Medellín, Colombia</p>
      </div>
    </div>
  )
}

// ── Toggle switch ──────────────────────────────────────────────────────────────
function Toggle({
  enabled,
  disabled,
  onChange,
}: {
  enabled:  boolean
  disabled: boolean
  onChange: () => void
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={[
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0',
        enabled ? 'bg-[#050040]' : 'bg-slate-200',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={[
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
          enabled ? 'translate-x-4' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  )
}
