'use client';

import SplitText from '@/components/ui/split-text';

const steps = [
  {
    number: '01',
    title: 'Presiona el botón',
    description:
      'En el Dispositivo: el botón físico. En Desktop: el botón en la app. Ambos inician la misma captura de audio — sin login, sin configuración, sin setup previo.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <circle cx="24" cy="24" r="20" stroke="#050040" strokeWidth="2.5" />
        <circle cx="24" cy="24" r="8" fill="#050040" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'La IA procesa en tiempo real',
    description:
      'El audio llega por WebSocket al backend compartido. Whisper transcribe identificando quién habla. La IA detecta tareas, decisiones y acuerdos automáticamente mientras ocurren.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <path d="M8 36V28M16 36V20M24 36V12M32 36V20M40 36V28" stroke="#050040" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Todos reciben el resumen',
    description:
      'En menos de 60 segundos: resumen ejecutivo, decisiones tomadas y tareas asignadas con responsable y fecha. Por Slack, Jira o email — igual para reuniones presenciales y videollamadas.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <path d="M8 14h32M8 24h24M8 34h16" stroke="#050040" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="38" cy="34" r="6" fill="#050040" />
        <path d="M35 34l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-white py-28 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
            Cómo funciona
          </p>
          <SplitText
            tag="h2"
            text="Tan simple como presionar un botón"
            className="text-3xl md:text-5xl font-medium text-[#050040] max-w-2xl mx-auto"
            delay={35}
            duration={0.7}
            ease="power3.out"
            splitType="words"
            from={{ opacity: 0, y: 30 }}
            to={{ opacity: 1, y: 0 }}
            threshold={0.2}
            rootMargin="-80px"
            textAlign="center"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.number} className="group relative border border-slate-100 rounded-3xl p-8 hover:border-slate-200 hover:shadow-lg transition-all duration-300">
              <span className="text-8xl font-bold text-slate-50 absolute top-6 right-8 select-none group-hover:text-slate-100 transition-colors">
                {step.number}
              </span>
              <div className="mb-6">{step.icon}</div>
              <h3 className="text-xl font-semibold text-[#050040] mb-3">{step.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>

        {/* Two-product detail row */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#050040] rounded-3xl p-8 flex flex-col gap-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-white/40">Dispositivo</span>
            <h3 className="text-xl font-semibold text-white">Sala de juntas presencial</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              El dispositivo va al centro de la mesa. Beamforming 360° identifica quién habla.
              USB-C, plug &amp; play. El botón físico lo controla todo.
            </p>
            <div className="mt-auto flex justify-end">
              <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                <svg viewBox="0 0 60 60" fill="none" className="w-12 h-12">
                  {[0,60,120,180,240,300].map((deg, i) => (
                    <circle key={i} cx={30 + 20 * Math.cos((deg-90)*Math.PI/180)} cy={30 + 20 * Math.sin((deg-90)*Math.PI/180)} r="3" fill="white" fillOpacity="0.7" />
                  ))}
                  <circle cx="30" cy="30" r="7" fill="white" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-3xl p-8 flex flex-col gap-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-600">Desktop</span>
            <h3 className="text-xl font-semibold text-[#050040]">Videollamada en cualquier plataforma</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              La app corre en segundo plano en Windows y Mac. Captura el audio del sistema
              mientras tienes activo Zoom, Meet, Teams — sin bots, sin integraciones especiales.
            </p>
            <div className="mt-auto bg-white border border-amber-100 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-2 h-2 rounded-full bg-slate-200" />
                <div className="w-2 h-2 rounded-full bg-slate-200" />
                <div className="w-2 h-2 rounded-full bg-slate-200" />
                <span className="text-[10px] text-slate-400 ml-1">MeetBox Desktop — grabando</span>
                <span className="ml-auto w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <div className="h-2 bg-amber-100 rounded-full w-full" />
                <div className="h-2 bg-amber-100 rounded-full w-4/5" />
                <div className="h-2 bg-amber-200 rounded-full w-3/5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
