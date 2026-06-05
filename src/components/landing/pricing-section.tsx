'use client';

import { useState } from 'react';
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
    highlight: false,
    // Datos para el pago — precio en COP
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
    highlight: true,
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
    highlight: false,
    planId: 'plan_empresa',
    unitPrice: 749900,
  },
];

export default function PricingSection() {
  // Guardamos qué plan está en proceso de pago
  // null significa que ninguno está cargando
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Función que se ejecuta cuando el usuario hace clic en un plan
  const handlePayment = async (planId: string, title: string, unitPrice: number) => {
    try {
      // Marcamos este plan como cargando
      setLoadingPlan(planId);

      // Llamamos a nuestra API route de Next.js
      // que a su vez llama al microservicio Spring Boot
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, title, unitPrice }),
      });

      const data = await response.json();

      if (data.initPoint) {
        // Redirigimos al usuario a la página de pago de Mercado Pago
        window.location.href = data.initPoint;
      } else {
        alert('Error al procesar el pago, intenta de nuevo');
      }

    } catch (error) {
      console.error('Error en el pago:', error);
      alert('Error de conexión, intenta de nuevo');
    } finally {
      // Quitamos el estado de carga sin importar si hubo error o no
      setLoadingPlan(null);
    }
  };

  return (
      <section id="precios" className="bg-white pt-20 pb-28 px-4">
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mt-8">
            {plans.map((plan) => (
                <div
                    key={plan.name}
                    className={[
                      'rounded-3xl p-8 border flex flex-col gap-6 transition-all duration-300',
                      plan.highlight
                          ? 'bg-[#050040] border-[#050040] text-white shadow-2xl md:-mt-4 md:mb-4'
                          : 'bg-white border-slate-200 text-[#050040] hover:border-slate-300 hover:shadow-md',
                    ].join(' ')}
                >
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${plan.highlight ? 'text-slate-400' : 'text-slate-400'}`}>
                      {plan.name}
                    </p>
                    <div className="flex items-end gap-1 mb-2">
                      <span className="text-5xl font-bold">{plan.price}</span>
                      <span className={`text-sm mb-1.5 ${plan.highlight ? 'text-slate-400' : 'text-slate-400'}`}>{plan.period}</span>
                    </div>
                    <p className={`text-sm leading-relaxed ${plan.highlight ? 'text-slate-300' : 'text-slate-500'}`}>
                      {plan.description}
                    </p>
                  </div>

                  <ul className="space-y-2.5 flex-1">
                    {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm">
                          <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.highlight ? 'text-white' : 'text-[#050040]'}`} viewBox="0 0 16 16" fill="none">
                            <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className={plan.highlight ? 'text-slate-200' : 'text-slate-600'}>{f}</span>
                        </li>
                    ))}
                  </ul>

                  {plan.note && (
                      <p className={`text-xs rounded-xl px-3 py-2 ${plan.highlight ? 'bg-white/10 text-slate-300' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                        {plan.note}
                      </p>
                  )}

                  <button
                      // Deshabilitamos el botón mientras está cargando
                      disabled={loadingPlan === plan.planId}
                      onClick={() => handlePayment(plan.planId, plan.name, plan.unitPrice)}
                      className={[
                        'w-full py-3.5 rounded-full text-sm font-semibold transition',
                        plan.highlight
                            ? 'bg-white text-[#050040] hover:bg-slate-100'
                            : 'bg-[#050040] text-white hover:bg-slate-800',
                        // Estilo cuando está cargando
                        loadingPlan === plan.planId ? 'opacity-70 cursor-not-allowed' : '',
                      ].join(' ')}
                  >
                    {/* Mostramos "Procesando..." mientras carga */}
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