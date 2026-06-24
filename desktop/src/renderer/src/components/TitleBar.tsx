import React from 'react'
import { Settings, ArrowLeft } from 'lucide-react'

interface TitleBarProps {
  onMinimize:      () => void
  onClose:         () => void
  onSettings:      () => void
  showingSettings: boolean
}

export default function TitleBar({ onMinimize, onClose, onSettings, showingSettings }: TitleBarProps) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Botones macOS (tráfico de luz) — en Windows se pueden ocultar */}
      <div
        className="flex items-center gap-1.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={onClose}
          className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition"
          title="Ocultar al tray"
        />
        <button
          onClick={onMinimize}
          className="w-3 h-3 rounded-full bg-amber-400 hover:bg-amber-500 transition"
          title="Minimizar"
        />
        {/* Sin botón de maximizar — ventana fija */}
        <span className="w-3 h-3 rounded-full bg-slate-200" />
      </div>

      {/* Título centrado */}
      <p className="text-xs font-semibold text-slate-500 tracking-wide">
        {showingSettings ? 'Configuración' : 'MeetBox Desktop'}
      </p>

      {/* Botón configuración */}
      <button
        onClick={onSettings}
        className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-400 hover:text-[#050040]"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        title={showingSettings ? 'Volver' : 'Configuración'}
      >
        {showingSettings
          ? <ArrowLeft className="w-3.5 h-3.5" />
          : <Settings  className="w-3.5 h-3.5" />
        }
      </button>
    </div>
  )
}
