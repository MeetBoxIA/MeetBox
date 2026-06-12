"use client";
/**
 * PlansView — in-dashboard pricing screen.
 *
 * Mirrors the public landing pricing but lives inside the dashboard so a
 * logged-in user can upgrade. Each plan's CTA calls POST /api/payments, which
 * proxies to the Spring Boot service and returns a Mercado Pago init_point the
 * browser is redirected to.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, Sparkles, Loader2, ArrowLeft, Zap, Building2, Cpu } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

// Same plans as the landing pricing section (prices in COP for Mercado Pago).
const PLANS = [
  {
    id:        "plan_sala",
    name:      "Por sala",
    price:     "$23.99",
    period:    "/mes",
    unitPrice: 99900,
    icon:      Zap,
    color:     "#050040",
    highlight: false,
    description: "Cubre una sala completa — presencial con el hardware y videollamadas con el Desktop.",
    features: [
      "MeetBox Desktop incluido (Win & Mac)",
      "Transcripción en tiempo real",
      "Detección de tareas y decisiones",
      "Resumen ejecutivo en < 60s",
      "Integración con Slack, Jira y Calendar",
    ],
  },
  {
    id:        "plan_empresa",
    name:      "Empresa",
    price:     "$184.99",
    period:    "/mes",
    unitPrice: 749900,
    icon:      Building2,
    color:     "#7c3aed",
    highlight: false,
    description: "Salas ilimitadas para toda la organización, con soporte prioritario.",
    features: [
      "Salas y usuarios ilimitados",
      "Dashboard de administración",
      "SSO y gestión de usuarios",
      "API para integraciones custom",
      "Soporte dedicado 24/7",
    ],
  },
  {
    id:        "plan_dispositivo",
    name:      "Dispositivo",
    price:     "$149.99",
    period:    "pago único",
    unitPrice: 649900,
    icon:      Cpu,
    color:     "#059669",
    highlight: false,
    description: "El dispositivo físico MeetBox para sala de juntas. Plug & play, USB-C.",
    features: [
      "Array de 6 micrófonos 360°",
      "Pantalla circular de estado",
      "Botón físico de inicio/fin",
      "Conexión USB-C universal",
      "Actualizaciones de firmware OTA",
    ],
  },
];

export default function PlansView({ onBack }: { onBack: () => void }) {
  const { locale } = useTranslation();
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);
  const [error,       setError]       = React.useState<string | null>(null);

  // Calls /api/payments → Mercado Pago init_point → redirect.
  async function handleUpgrade(planId: string, title: string, unitPrice: number) {
    setError(null);
    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, title, unitPrice }),
      });
      const data = await res.json();
      if (data.initPoint) {
        // Remember the chosen plan so SettingsAccount can display it after the
        // Mercado Pago redirect (until real subscriptions land in the DB).
        localStorage.setItem("meetbox_plan", JSON.stringify({ id: planId, name: title }));
        window.location.href = data.initPoint;   // off to Mercado Pago
      } else {
        setError(data.error ?? (locale === "en" ? "Could not start checkout. Try again." : "No se pudo iniciar el pago. Intenta de nuevo."));
        setLoadingPlan(null);
      }
    } catch {
      setError(locale === "en" ? "Connection error. Try again." : "Error de conexión. Intenta de nuevo.");
      setLoadingPlan(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back link */}
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#050040] transition-colors mb-5">
        <ArrowLeft className="w-4 h-4" />
        {locale === "en" ? "Back to account" : "Volver a cuenta"}
      </button>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#050040]/8 text-[#050040] px-3 py-1.5 rounded-full mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          {locale === "en" ? "Upgrade your plan" : "Mejora tu plan"}
        </div>
        <h1 className="text-3xl font-bold text-slate-800">
          {locale === "en" ? "Choose the plan that fits your team" : "Elige el plan ideal para tu equipo"}
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          {locale === "en"
            ? "Unlock unlimited meetings, integrations and AI features."
            : "Desbloquea reuniones ilimitadas, integraciones y funciones de IA."}
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-5 text-center max-w-md mx-auto">
          {error}
        </p>
      )}

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map((plan) => {
          const Icon      = plan.icon;
          const isLoading = loadingPlan === plan.id;
          return (
            <div key={plan.id}
              className={cn(
                "relative bg-white rounded-2xl border p-6 flex flex-col transition-all duration-300 group h-full",
                "border-slate-200 hover:bg-[#050040] hover:border-[#050040] hover:text-white hover:shadow-2xl hover:-translate-y-2",
              )}>

              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
                style={{ backgroundColor: plan.color + "15" }}>
                <Icon className="w-5 h-5 group-hover:text-white" style={{ color: plan.color }} />
              </div>

              <h3 className="text-lg font-bold text-slate-800 group-hover:text-white">{plan.name}</h3>
              <div className="flex items-end gap-1 mt-1 mb-3">
                <span className="text-3xl font-bold text-slate-900 group-hover:text-white">{plan.price}</span>
                <span className="text-sm text-slate-400 mb-1 group-hover:text-white/70">{plan.period}</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-5 group-hover:text-slate-300">{plan.description}</p>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-slate-600 group-hover:text-slate-200">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id, plan.name, plan.unitPrice)}
                disabled={isLoading}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60",
                  "bg-slate-100 text-slate-700 hover:bg-slate-200 group-hover:bg-white group-hover:text-[#050040] group-hover:hover:bg-slate-100",
                )}
              >
                {isLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{locale === "en" ? "Redirecting…" : "Redirigiendo…"}</>
                  : (locale === "en" ? "Choose plan" : "Elegir plan")}
              </button>
            </div>
          );
        })}
      </div>

      {/* Trust note */}
      <p className="text-center text-xs text-slate-400 mt-6">
        {locale === "en"
          ? "Secure payment via Mercado Pago · Cancel anytime"
          : "Pago seguro vía Mercado Pago · Cancela cuando quieras"}
      </p>
    </div>
  );
}
