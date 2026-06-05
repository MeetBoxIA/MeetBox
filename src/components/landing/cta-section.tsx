'use client';

import SplitText from '@/components/ui/split-text';

export default function CtaSection() {
  return (
    <section className="bg-[#050040] py-28 px-4 text-white">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6">
          Únete a los primeros
        </p>

        <SplitText
          tag="h2"
          text="Deja de perder lo que se decide en tus reuniones"
          className="text-3xl md:text-5xl font-medium text-white max-w-2xl mx-auto"
          delay={30}
          duration={0.7}
          ease="power3.out"
          splitType="words"
          from={{ opacity: 0, y: 25 }}
          to={{ opacity: 1, y: 0 }}
          threshold={0.2}
          rootMargin="-60px"
          textAlign="center"
        />

        <p className="mt-6 text-slate-400 text-base max-w-xl mx-auto">
          MeetBox no requiere cambiar los hábitos de tu equipo.
          Solo presionar un botón y dejar que el trabajo suceda.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <button className="bg-white text-[#050040] px-8 py-4 rounded-full font-semibold text-sm hover:bg-slate-100 transition">
            Reserva el tuyo — $180
          </button>
          <a
            href="/auth?tab=sign-up"
            className="inline-flex items-center justify-center gap-2 border border-white/20 text-white px-8 py-4 rounded-full text-sm hover:bg-white/10 transition"
          >
            ¿Ya tienes el tuyo?
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M2.5 7h9m0 0L8 3.5M11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        <div className="mt-16 pt-12 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            { stat: '< 60s', label: 'para recibir el resumen tras la reunión' },
            { stat: 'USB-C', label: 'plug & play, sin drivers ni instalación' },
            { stat: '0', label: 'apps nuevas que aprender para tu equipo' },
          ].map(({ stat, label }) => (
            <div key={stat}>
              <p className="text-3xl font-bold text-white mb-1">{stat}</p>
              <p className="text-slate-400 text-sm">{label}</p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-slate-500 text-xs">
          © 2025 MeetBox · Medellín, Colombia · Para equipos en toda Latinoamérica
        </p>
      </div>
    </section>
  );
}
