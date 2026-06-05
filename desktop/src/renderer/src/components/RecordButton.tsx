import React from 'react'
import type { RecordingStatus } from '../App'

interface RecordButtonProps {
  status:  RecordingStatus
  timer:   string
  onClick: () => void
}

export default function RecordButton({ status, timer, onClick }: RecordButtonProps) {
  const isRecording  = status === 'recording'
  const isProcessing = status === 'processing'
  const isDone       = status === 'done'
  const disabled     = isProcessing

  return (
    <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>

      {/* Anillo pulsante cuando graba */}
      {isRecording && (
        <>
          <span
            className="absolute inset-0 rounded-full bg-red-400/30"
            style={{ animation: 'pulse_ring 1.6s cubic-bezier(0.24,0,0.38,1) infinite' }}
          />
          <span
            className="absolute inset-0 rounded-full bg-red-400/20"
            style={{ animation: 'pulse_ring 1.6s cubic-bezier(0.24,0,0.38,1) infinite 0.4s' }}
          />
        </>
      )}

      {/* Botón circular principal */}
      <button
        onClick={onClick}
        disabled={disabled}
        className={[
          'relative w-32 h-32 rounded-full flex flex-col items-center justify-center',
          'transition-all duration-300 focus:outline-none focus-visible:ring-4',
          'shadow-xl',
          isRecording
            ? 'bg-red-500 hover:bg-red-600 focus-visible:ring-red-300 shadow-red-200'
            : isDone
              ? 'bg-emerald-500 hover:bg-emerald-600 focus-visible:ring-emerald-300 shadow-emerald-100'
              : isProcessing
                ? 'bg-amber-400 cursor-wait shadow-amber-100'
                : 'bg-[#050040] hover:bg-slate-800 focus-visible:ring-slate-300 shadow-slate-200',
        ].join(' ')}
        aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
      >
        {isProcessing ? (
          /* Spinner */
          <svg className="w-10 h-10 text-white animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : isRecording ? (
          /* Cuadrado stop */
          <div className="w-10 h-10 rounded-lg bg-white" />
        ) : isDone ? (
          /* Check */
          <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          /* Círculo de grabación */
          <div className="w-10 h-10 rounded-full bg-red-500 border-4 border-white" />
        )}

        {/* Timer dentro del botón cuando graba */}
        {isRecording && (
          <span className="mt-2 text-white text-xs font-bold font-mono tabular-nums">
            {timer}
          </span>
        )}
      </button>
    </div>
  )
}
