'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import SplitText from '@/components/ui/split-text';

const plans = [
  {
    name: 'Dispositivo',
    price: '$149.99',
    period: 'pago único',
    description: 'El dispositivo físico MeetBox para sala de juntas. Plug & play, USB-C.',
    features: [
      'Array de 6 micrófonos 360°',
      'Pantalla circular de estado',
      'Botón físico de inicio/fin',
      'Conexión USB-C universal',
      'Actualizaciones de firmware OTA',
    ],
    note: 'Requiere plan Por sala para activarse',
    cta: 'Reservar dispositivo',
    planId: 'plan_dispositivo',
    unitPrice: 649900,
  },
  {
    name: 'Por sala',
    price: '$23.99',
    period: '/mes',
    description: 'Cubre una sala completa — presencial con el Hardware y videollamadas con el Desktop.',
    features: [
      'MeetBox Desktop incluido (Win & Mac)',
      'Transcripción en tiempo real',
      'Detección de tareas y decisiones',
      'Resumen ejecutivo en < 60s',
      'Integración con Slack, Jira y Calendar',
    ],
    note: null,
    cta: 'Empezar prueba gratis',
    planId: 'plan_sala',
    unitPrice: 99900,
  },
  {
    name: 'Empresa',
    price: '$184.99',
    period: '/mes',
    description: 'Salas ilimitadas para toda la organización, con soporte prioritario.',
    features: [
      'Salas y usuarios ilimitados',
      'Dashboard de administración',
      'SSO y gestión de usuarios',
      'API para integraciones custom',
      'Soporte dedicado 24/7',
    ],
    note: null,
    cta: 'Hablar con ventas',
    planId: 'plan_empresa',
    unitPrice: 749900,
  },
];

type AlertState = { msg: string; type: 'error' | 'info' } | null;

export default function PricingSection() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState>(null);

  function showAlert(msg: string, type: 'error' | 'info') {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 5000);
  }

  const handlePayment = async (planId: string, title: string, unitPrice: number) => {
    if (!session) {
      showAlert('Debes registrarte para proceder a la pasarela de pago', 'info');
      setTimeout(() => router.push('/auth?tab=sign-up'), 2000);
      return;
    }
    try {
      setLoadingPlan(planId);
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, title, unitPrice }),
      });
      const data = await response.json();
      if (data.initPoint) {
        window.location.href = data.initPoint;
      } else {
        showAlert('Hubo un error en el proceso de pago', 'error');
      }
    } catch {
      showAlert('Hubo un error en el proceso de pago', 'error');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <section id="precios" className="bg-white pt-20 pb-28 px-4">
      {/* ── Styled alert ── */}
      {alert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4">
          <div className={[
            'flex items-start gap-3 rounded-2xl px-5 py-4 shadow-xl border text-sm font-medium',
            alert.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-[#050040] border-[#050040] text-white',
          ].join(' ')}>
            <span className="text-lg leading-none mt-0.5">
              {alert.type === 'error' ? '⚠️' : 'ℹ️'}
            </span>
            <span className="flex-1">{alert.msg}</span>
            <button onClick={() => setAlert(null)} className="opacity-60 hover:opacity-100 transition-opacity leading-none text-base">✕</button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
            Precios
          </p>
          <SplitText
            tag="h2"
            text="Transparente y predecible"
            className="text-3xl md:text-5xl font-medium text-[#050040]"
            delay={35}
            duration={0.7}
            ease="power3.out"
            splitType="words"
            from={{ opacity: 0, y: 25 }}
            to={{ opacity: 1, y: 0 }}
            threshold={0.2}
            rootMargin="-80px"
            textAlign="center"
          />
          <p className="mt-4 text-slate-500 max-w-md mx-auto text-sm">
            El dispositivo se compra una vez. El software escala con tu empresa.
          </p>
        </div>

        {/* ── Cards — same height, white default, dark on hover ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch mt-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="group rounded-3xl p-8 border border-slate-200 bg-white flex flex-col gap-6 transition-all duration-300 hover:bg-[#050040] hover:border-[#050040] hover:shadow-2xl hover:-translate-y-1"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-slate-400 group-hover:text-slate-400">
                  {plan.name}
                </p>
                <div className="flex items-end gap-1 mb-2">
                  <span className="text-5xl font-bold text-[#050040] group-hover:text-white transition-colors duration-300">
                    {plan.price}
                  </span>
                  <span className="text-sm mb-1.5 text-slate-400 group-hover:text-slate-400">
                    {plan.period}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-500 group-hover:text-slate-300 transition-colors duration-300">
                  {plan.description}
                </p>
              </div>

              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <svg
                      className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#050040] group-hover:text-white transition-colors duration-300"
                      viewBox="0 0 16 16" fill="none"
                    >
                      <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-slate-600 group-hover:text-slate-200 transition-colors duration-300">{f}</span>
                  </li>
                ))}
              </ul>

              {plan.note && (
                <p className="text-xs rounded-xl px-3 py-2 bg-slate-50 text-slate-400 border border-slate-100 group-hover:bg-white/10 group-hover:text-slate-300 group-hover:border-white/10 transition-all duration-300">
                  {plan.note}
                </p>
              )}

              <button
                disabled={loadingPlan === plan.planId}
                onClick={() => handlePayment(plan.planId, plan.name, plan.unitPrice)}
                className="w-full py-3.5 rounded-full text-sm font-semibold transition-all duration-300 bg-[#050040] text-white group-hover:bg-white group-hover:text-[#050040] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loadingPlan === plan.planId ? 'Procesando...' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-slate-400 text-xs mt-8">
          Primeras 100 empresas reciben 3 meses del plan <span className="font-semibold">Por sala</span> sin costo.
        </p>
      </div>
    </section>
  );
}
