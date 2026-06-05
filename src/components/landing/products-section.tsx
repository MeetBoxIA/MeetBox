'use client';

import { useState } from 'react';
import SplitText from '@/components/ui/split-text';
import LogoLoop from '@/components/ui/logo-loop';
import { Mic2, ListChecks, Zap, Link2, LayoutDashboard, ShieldCheck, UserRound, MonitorSmartphone } from 'lucide-react';

const sharedFeatures = [
  { label: 'Transcripción con Whisper', icon: <Mic2 className="w-4 h-4 flex-shrink-0" /> },
  { label: 'Detección de tareas y decisiones', icon: <ListChecks className="w-4 h-4 flex-shrink-0" /> },
  { label: 'Resumen en menos de 60 segundos', icon: <Zap className="w-4 h-4 flex-shrink-0" /> },
  { label: 'Integración con Slack, Jira y Calendar', icon: <Link2 className="w-4 h-4 flex-shrink-0" /> },
  { label: 'Dashboard unificado', icon: <LayoutDashboard className="w-4 h-4 flex-shrink-0" /> },
  { label: 'Audio cifrado con AES-256', icon: <ShieldCheck className="w-4 h-4 flex-shrink-0" /> },
  { label: 'Identificación de quién habla', icon: <UserRound className="w-4 h-4 flex-shrink-0" /> },
  { label: 'Presencial y videollamada', icon: <MonitorSmartphone className="w-4 h-4 flex-shrink-0" /> },
];

const tickerLogos = sharedFeatures.map(({ label, icon }) => ({
  node: (
    <span className="inline-flex items-center gap-2.5 text-sm font-medium text-white/80 whitespace-nowrap">
      <span className="text-amber-400">{icon}</span>
      {label}
    </span>
  ),
  title: label,
}));

const stats = [
  { value: '< 60s', label: 'resumen post-reunión' },
  { value: '6', label: 'micrófonos beamforming' },
  { value: '100%', label: 'plug & play, sin drivers' },
];

export default function ProductsSection() {

  // Estado de carga por botón
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Función que llama al microservicio de pagos
  const handlePayment = async (planId: string, title: string, unitPrice: number) => {
    try {
      setLoadingPlan(planId);

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, title, unitPrice }),
      });

      const data = await response.json();

      if (data.initPoint) {
        // Redirigimos al checkout de Mercado Pago
        window.location.href = data.initPoint;
      } else {
        alert('Error al procesar el pago, intenta de nuevo');
      }
    } catch (error) {
      console.error('Error en el pago:', error);
      alert('Error de conexión, intenta de nuevo');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <section id="productos" className="bg-white py-28 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
            El sistema MeetBox
          </p>
          <SplitText
            tag="h2"
            text="Un sistema, dos productos"
            className="text-3xl md:text-5xl font-medium text-[#050040]"
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
          <p className="mt-4 text-slate-500 text-sm md:text-base max-w-2xl mx-auto">
            El mismo backend, la misma IA, el mismo dashboard.
            Elige según dónde ocurren tus reuniones — o usa los dos.
          </p>
        </div>

        {/* Two product cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Dispositivo card */}
          <div className="relative rounded-3xl border border-slate-200 overflow-hidden group hover:shadow-xl transition-shadow duration-300">
            <div className="bg-[#050040] px-8 pt-8 pb-16">
              <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs font-semibold text-white/70 mb-5">
                <span className="w-2 h-2 rounded-full bg-white" />
                MeetBox Dispositivo
              </span>
              <h3 className="text-2xl md:text-3xl font-semibold text-white leading-snug">
                Para reuniones<br />presenciales
              </h3>
              <p className="mt-3 text-white/60 text-sm leading-relaxed">
                El dispositivo con array de 6 micrófonos que va en el centro de la mesa de juntas.
                Plug &amp; play por USB-C. Sin drivers. Sin configuración.
              </p>
            </div>

            <div className="absolute right-8 top-6 w-28 h-28 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                <svg viewBox="0 0 80 80" fill="none" className="w-14 h-14">
                  {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                    <circle key={i}
                      cx={40 + 26 * Math.cos((deg - 90) * Math.PI / 180)}
                      cy={40 + 26 * Math.sin((deg - 90) * Math.PI / 180)}
                      r="4" fill="white" fillOpacity="0.7" />
                  ))}
                  <circle cx="40" cy="40" r="10" fill="white" />
                </svg>
              </div>
            </div>

            <div className="bg-white px-8 py-7 -mt-8 rounded-t-3xl relative z-10">
              <ul className="space-y-2.5 mb-6">
                {[
                  'Array de 6 micrófonos con beamforming 360°',
                  'Identifica quién habla en cada momento',
                  'Botón físico para iniciar y terminar',
                  'Conexión USB-C — sin drivers ni instalación',
                  'Pantalla circular de estado integrada',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <svg className="w-4 h-4 mt-0.5 text-[#050040] flex-shrink-0" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between pt-5 border-t border-slate-100">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Dispositivo físico</p>
                  <p className="text-2xl font-bold text-[#050040]">$149.99 <span className="text-sm font-normal text-slate-400">USD</span></p>
                </div>
                {/* Botón conectado al pago — plan_dispositivo, $649.900 COP */}
                <button
                  disabled={loadingPlan === 'plan_dispositivo'}
                  onClick={() => handlePayment('plan_dispositivo', 'MeetBox Dispositivo', 649900)}
                  className="bg-[#050040] hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loadingPlan === 'plan_dispositivo' ? 'Procesando...' : 'Reservar'}
                </button>
              </div>
            </div>
          </div>

          {/* Desktop card */}
          <div className="relative rounded-3xl border border-slate-200 overflow-hidden group hover:shadow-xl transition-shadow duration-300">
            <div className="bg-amber-500 px-8 pt-8 pb-16">
              <span className="inline-flex items-center gap-2 bg-white/20 border border-white/30 rounded-full px-3 py-1 text-xs font-semibold text-white/90 mb-5">
                <span className="w-2 h-2 rounded-full bg-white" />
                MeetBox Desktop
              </span>
              <h3 className="text-2xl md:text-3xl font-semibold text-white leading-snug">
                Para videollamadas<br />Zoom, Meet, Teams
              </h3>
              <p className="mt-3 text-white/80 text-sm leading-relaxed">
                App liviana que corre en segundo plano en Windows y Mac. Captura el audio
                del sistema mientras tienes activa cualquier videollamada. Sin bots, sin integraciones especiales.
              </p>
            </div>

            <div className="absolute right-6 top-5 w-32 h-20 bg-white/15 rounded-xl border border-white/20 p-2.5">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-2 h-2 rounded-full bg-white/40" />
                <div className="w-2 h-2 rounded-full bg-white/40" />
                <div className="w-2 h-2 rounded-full bg-white/40" />
              </div>
              <div className="space-y-1.5">
                <div className="h-1.5 bg-white/30 rounded-full w-full" />
                <div className="h-1.5 bg-white/30 rounded-full w-4/5" />
                <div className="h-1.5 bg-white/50 rounded-full w-3/5" />
              </div>
            </div>

            <div className="bg-white px-8 py-7 -mt-8 rounded-t-3xl relative z-10">
              <ul className="space-y-2.5 mb-6">
                {[
                  'Captura audio del sistema y micrófono simultáneamente',
                  'Compatible con Zoom, Google Meet, Teams y cualquier otra',
                  'Sin bots que entren como participantes a la llamada',
                  'Botón en la app igual al botón físico del Hardware',
                  'Disponible para Windows y macOS',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <svg className="w-4 h-4 mt-0.5 text-amber-500 flex-shrink-0" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between pt-5 border-t border-slate-100">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Incluido en el plan</p>
                  <p className="text-2xl font-bold text-amber-500">$23.99 <span className="text-sm font-normal text-slate-400">/mes</span></p>
                </div>
                {/* Botón conectado al pago — plan_sala, $99.900 COP */}
                <button
                  disabled={loadingPlan === 'plan_sala'}
                  onClick={() => handlePayment('plan_sala', 'MeetBox Desktop - Plan Por Sala', 99900)}
                  className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loadingPlan === 'plan_sala' ? 'Procesando...' : 'Descargar'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Shared backend banner */}
        <div className="mt-4 rounded-3xl overflow-hidden bg-[#050040]">
          <div className="px-10 pt-10 pb-8 flex flex-col md:flex-row md:items-center gap-8">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">
                Lo que comparten los dos
              </p>
              <p className="text-2xl md:text-4xl font-semibold text-white leading-snug">
                Un solo backend.<br className="hidden md:block" /> La misma IA para todo.
              </p>
              <p className="mt-3 text-white/50 text-sm leading-relaxed max-w-sm">
                Sin importar si usas el Dispositivo en sala o el Desktop en videollamada — el motor es idéntico.
              </p>
            </div>
            <div className="flex gap-10 md:gap-14 flex-shrink-0">
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-4xl font-bold text-white">{s.value}</p>
                  <p className="text-xs text-white/40 mt-1.5 max-w-[80px] leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-white/10" />
          <div className="py-7 overflow-hidden" style={{ position: 'relative' }}>
            <LogoLoop
              logos={tickerLogos}
              speed={60}
              direction="left"
              logoHeight={36}
              gap={56}
              hoverSpeed={0}
              fadeOut
              fadeOutColor="#050040"
              ariaLabel="Funcionalidades compartidas"
            />
          </div>
        </div>
      </div>
    </section>
  );
}