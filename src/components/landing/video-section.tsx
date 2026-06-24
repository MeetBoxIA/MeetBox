'use client';

import { useState } from 'react';

export default function VideoSection() {
  const [playing, setPlaying] = useState(false);

  return (
    <section className="bg-white py-20 px-4">
      <div className="max-w-5xl mx-auto">

        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
            Demo del producto
          </p>
          <h2 className="text-3xl md:text-5xl font-medium text-[#050040]">
            Ve MeetBox en acción
          </h2>
          <p className="mt-4 text-slate-500 text-sm md:text-base max-w-lg mx-auto">
            Desde que alguien presiona el botón hasta que llega el resumen al Slack del equipo.
          </p>
        </div>

        {/* Video container */}
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#050040] shadow-2xl shadow-[#050040]/20 group">

          {/* Fake screen content — visible before play */}
          {!playing && (
            <>
              {/* Top bar mockup */}
              <div className="absolute inset-x-0 top-0 h-10 bg-white/5 border-b border-white/10 flex items-center px-4 gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                <div className="mx-auto w-48 h-5 rounded-md bg-white/10" />
              </div>

              {/* Fake transcript lines */}
              <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-16 gap-3 mt-6">
                {[
                  { speaker: 'Ana M.', line: 'w-3/4', time: '09:14' },
                  { speaker: 'Carlos R.', line: 'w-1/2', time: '09:15' },
                  { speaker: 'Ana M.', line: 'w-2/3', time: '09:15' },
                  { speaker: 'Luis G.', line: 'w-5/6', time: '09:16', task: true },
                  { speaker: 'Carlos R.', line: 'w-1/3', time: '09:17' },
                ].map((row, i) => (
                  <div key={i} className="flex items-start gap-3 opacity-70">
                    <span className="text-[10px] text-white/40 w-8 flex-shrink-0 mt-0.5">{row.time}</span>
                    <span className={`text-xs font-semibold flex-shrink-0 w-16 ${row.task ? 'text-amber-400' : 'text-white/60'}`}>
                      {row.speaker}
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      <div className={`h-2.5 rounded-full bg-white/20 ${row.line}`} />
                      {row.task && (
                        <span className="text-[9px] font-bold text-amber-400 border border-amber-400/40 rounded px-1.5 py-0.5 flex-shrink-0">
                          TAREA
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom summary bar */}
              <div className="absolute inset-x-0 bottom-0 h-14 bg-white/5 border-t border-white/10 flex items-center px-6 gap-4">
                <div className="w-24 h-3 rounded bg-white/20" />
                <div className="w-16 h-3 rounded bg-amber-400/30" />
                <div className="ml-auto text-[10px] text-white/30 font-medium">MeetBox · en vivo</div>
              </div>
            </>
          )}

          {/* Play button overlay */}
          {!playing && (
            <button
              onClick={() => setPlaying(true)}
              className="absolute inset-0 flex items-center justify-center group/play"
              aria-label="Reproducir demo"
            >
              {/* Glow ring */}
              <span className="absolute w-24 h-24 rounded-full bg-white/10 group-hover/play:scale-110 transition-transform duration-300" />
              <span className="relative w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl">
                <svg className="w-6 h-6 text-[#050040] ml-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5.14v14l11-7-11-7z" />
                </svg>
              </span>
            </button>
          )}

          {/* Placeholder when "playing" — swap for a real <video> or <iframe> */}
          {playing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
              <div className="w-12 h-12 rounded-full border-4 border-white/30 border-t-white animate-spin" />
              <p className="text-sm text-white/60">Cargando demo…</p>
              <button
                onClick={() => setPlaying(false)}
                className="text-xs text-white/40 hover:text-white/70 underline transition"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Caption row */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 px-1">
          <span>Reunión de ejemplo · 22 min · 4 participantes</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              3 tareas detectadas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Resumen enviado en 47s
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
