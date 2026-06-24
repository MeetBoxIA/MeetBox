'use client';

import SplitText from '@/components/ui/split-text';

export default function ProblemSection() {
  return (
    <section className="bg-[#050040] text-white py-28 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6">
          El problema
        </p>

        <div className="mb-8">
          <SplitText
            tag="h2"
            text="67%"
            className="text-[120px] md:text-[180px] font-bold leading-none text-white"
            delay={80}
            duration={1}
            ease="power4.out"
            splitType="chars"
            from={{ opacity: 0, scale: 0.5 }}
            to={{ opacity: 1, scale: 1 }}
            threshold={0.2}
            rootMargin="-50px"
            textAlign="center"
          />
        </div>

        <SplitText
          tag="p"
          text="de las tareas asignadas en reuniones nunca se completan"
          className="text-2xl md:text-4xl font-medium text-white/90 max-w-3xl mx-auto"
          delay={30}
          duration={0.7}
          ease="power3.out"
          splitType="words"
          from={{ opacity: 0, y: 20 }}
          to={{ opacity: 1, y: 0 }}
          threshold={0.2}
          rootMargin="-50px"
          textAlign="center"
        />

        <p className="mt-6 text-slate-400 text-base md:text-lg max-w-xl mx-auto">
          No porque los equipos sean negligentes. Porque nadie las registró correctamente cuando se asignaron.
        </p>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          {[
            { stat: '2.5h', label: 'promedio semanal perdido en reuniones sin seguimiento' },
            { stat: '4×', label: 'más probable que un proyecto falle si las decisiones no se documentan' },
            { stat: '$0', label: 'valor generado por una reunión cuyos acuerdos nadie recuerda al día siguiente' },
          ].map(({ stat, label }) => (
            <div key={stat} className="border border-white/10 rounded-2xl p-6 bg-white/5">
              <p className="text-4xl font-bold text-white mb-2">{stat}</p>
              <p className="text-slate-400 text-sm leading-relaxed">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
