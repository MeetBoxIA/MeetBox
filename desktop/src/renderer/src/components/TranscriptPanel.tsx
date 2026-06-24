import React, { useEffect, useRef } from 'react'
import type { RecordingStatus } from '../App'

interface TranscriptLine {
  id:        string
  speaker:   string
  text:      string
  timestamp: string
  isTask?:   boolean
}

interface TranscriptPanelProps {
  lines:  TranscriptLine[]
  status: RecordingStatus
}

export default function TranscriptPanel({ lines, status }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0">
      {lines.length === 0 ? (
        <EmptyState status={status} />
      ) : (
        <>
          {lines.map((line) => (
            <TranscriptLineItem key={line.id} line={line} />
          ))}
          <div ref={bottomRef} />
        </>
      )}
    </div>
  )
}

// ── Estado vacío ───────────────────────────────────────────────────────────────
function EmptyState({ status }: { status: RecordingStatus }) {
  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-3">
        <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
          <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8 text-slate-300">
            <path d="M16 4v10M16 4l-4 4M16 4l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="6" y="14" width="20" height="14" rx="4" stroke="currentColor" strokeWidth="2" />
            <path d="M11 21h10M11 25h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400">El transcript aparecerá aquí</p>
          <p className="text-[10px] text-slate-300 mt-1">Presiona el botón para iniciar</p>
        </div>
      </div>
    )
  }

  if (status === 'recording') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-red-400 block"
              style={{ animation: `bounce 0.8s ease-in-out ${i * 0.15}s infinite alternate` }}
            />
          ))}
        </div>
        <p className="text-[10px] text-slate-400">Escuchando la reunión…</p>
      </div>
    )
  }

  return null
}

// ── Línea individual ───────────────────────────────────────────────────────────
function TranscriptLineItem({ line }: { line: TranscriptLine }) {
  const initials = line.speaker
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  const time = new Date(line.timestamp).toLocaleTimeString('es-ES', {
    hour:   '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className={[
        'flex items-start gap-2.5 p-2.5 rounded-xl transition-colors',
        line.isTask ? 'bg-amber-50 border border-amber-100' : 'hover:bg-slate-50',
      ].join(' ')}
    >
      {/* Avatar */}
      <div className="w-6 h-6 rounded-full bg-[#050040] text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-semibold text-[#050040]">{line.speaker}</span>
          {line.isTask && (
            <span className="text-[8px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
              Tarea
            </span>
          )}
          <span className="text-[9px] text-slate-300 ml-auto flex-shrink-0">{time}</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">{line.text}</p>
      </div>
    </div>
  )
}
