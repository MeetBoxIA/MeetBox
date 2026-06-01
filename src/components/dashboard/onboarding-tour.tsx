"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  ArrowRight, ArrowLeft, X, Calendar, DoorOpen, BookOpen,
  Video, Sparkles, Check, LayoutDashboard,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface TourStep {
  badge?: string;
  icon?: React.ElementType;
  title: string;
  description: string;
  image: string;
  hint?: string;
}

interface SectionTour { color: string; steps: TourStep[]; }

// ── Tours per section ────────────────────────────────────────────────────────
function buildTours(name: string): Record<string, SectionTour> {
  return {
    home: {
      color: "#050040",
      steps: [
        {
          icon: LayoutDashboard,
          title: `¡Hola, ${name}! Bienvenido a MeetBox`,
          description: "Esta es tu base. Verás un saludo, tu próxima reunión del día y atajos rápidos a las secciones principales.",
          image: "/undraw_business-decisions_7vkl.svg",
        },
        {
          badge: "Inicio", icon: LayoutDashboard,
          title: "Tu día en un vistazo",
          description: "Desde aquí navegas a tu calendario, salas, notas y reuniones. Te iremos guiando por cada sección la primera vez que la abras.",
          image: "/undraw_online-meeting_qe61.svg",
          hint: "Las opciones de tu cuenta están en tu foto arriba a la derecha.",
        },
      ],
    },

    meetcalendar: {
      color: "#050040",
      steps: [
        {
          badge: "MeetCalendar", icon: Calendar,
          title: "Tu calendario, tu ritmo",
          description: "Cambia entre vistas de mes, semana o día. Haz clic en cualquier día para ver su detalle o arrastra eventos para reorganizarlos.",
          image: "/undraw_booking_8vl5.svg",
        },
        {
          badge: "Crear eventos", icon: Calendar,
          title: "Reuniones, eventos y recordatorios",
          description: "Tres tipos de eventos, cada uno con su color. Activa recordatorios con notificación en el navegador o por correo.",
          image: "/undraw_morning-news_h9nz.svg",
        },
        {
          badge: "Compartir", icon: Calendar,
          title: "Un enlace para todo el equipo",
          description: "Comparte tu calendario con un enlace público o suscríbete desde Google Calendar y Apple Calendar con un solo clic.",
          image: "/undraw_collaboration_hkrb.svg",
          hint: "Puedes regenerar el enlace cuando quieras para invalidar el anterior.",
        },
      ],
    },

    rooms: {
      color: "#059669",
      steps: [
        {
          badge: "Salas", icon: DoorOpen,
          title: "Espacios para tus equipos",
          description: "Crea una sala para cada propósito: junta directiva, producto, clientes. Personaliza con emoji y color para reconocerlas al instante.",
          image: "/undraw_collaboration_hkrb.svg",
        },
        {
          badge: "Personas y reuniones", icon: DoorOpen,
          title: "Tu equipo en cada sala",
          description: "Añade personas con su nombre y correo. Programa reuniones desde la sala y aparecerán automáticamente en tu MeetCalendar del día.",
          image: "/undraw_meet-the-team_fau8.svg",
        },
      ],
    },

    meetbook: {
      color: "#7c3aed",
      steps: [
        {
          badge: "MeetBook", icon: BookOpen,
          title: "Cuadernos para tus ideas",
          description: "Organiza tus notas por cuadernos: actas, proyectos, journaling. Cada cuaderno con su propio emoji y color.",
          image: "/undraw_writing-online_x665.svg",
        },
        {
          badge: "Editor por bloques", icon: BookOpen,
          title: "Escribe sin fricciones",
          description: "Títulos, listas, citas, código. Todo se guarda automáticamente. Fija tus notas más importantes para tenerlas siempre arriba.",
          image: "/undraw_programming_j1zw.svg",
          hint: "¿Borraste algo por error? Recupéralo desde la papelera del cuaderno.",
        },
      ],
    },

    meetings: {
      color: "#d97706",
      steps: [
        {
          badge: "Reuniones hoy", icon: Video,
          title: "Tus reuniones del día",
          description: "Todas las reuniones programadas para hoy, con su sala, ubicación y descripción, en orden cronológico.",
          image: "/undraw_conference-call_jgi5.svg",
        },
        {
          badge: "Importar grabación", icon: Video,
          title: "Guarda tus grabaciones",
          description: "Sube video o audio de tus llamadas. Arrastra el archivo o haz clic. Vincúlalo a la reunión correspondiente para tener todo junto.",
          image: "/undraw_morning-news_h9nz.svg",
        },
        {
          badge: "Historial", icon: Video,
          title: "Encuentra cualquier reunión pasada",
          description: "Busca por título, navega tu historial completo y revisa cuántas grabaciones hay vinculadas a cada reunión.",
          image: "/undraw_my-app_jscv.svg",
        },
      ],
    },
  };
}

// nav id → tour id (rooms-meetings reuses the rooms tour)
const NAV_TO_TOUR: Record<string, string> = {
  home:             "home",
  meetcalendar:     "meetcalendar",
  rooms:            "rooms",
  "rooms-meetings": "rooms",
  meetbook:         "meetbook",
  meetings:         "meetings",
};

function flagKey(uid: string, section: string) { return `meetbox_tour_${section}_${uid}`; }
function wizardStorageKey(uid: string)          { return `meetbox_wizard_${uid}`; }

// ── Component ──────────────────────────────────────────────────────────────────
interface Props {
  userName:  string;
  userEmail: string;
  activeNav: string;
}

export default function OnboardingTour({ userName, userEmail, activeNav }: Props) {
  const uid = userEmail || "anon";

  const [wizardReady, setWizardReady] = React.useState(false);
  const [activeTour,  setActiveTour]  = React.useState<string | null>(null);
  const [step,        setStep]        = React.useState(0);
  const [direction,   setDirection]   = React.useState<"fwd" | "back">("fwd");

  // ── Wait until the wizard is done before any tour can appear ────────────────
  React.useEffect(() => {
    if (wizardReady) return;
    function check(): boolean {
      try { return !!localStorage.getItem(wizardStorageKey(uid)); }
      catch { return false; }
    }
    if (check()) { setWizardReady(true); return; }
    const t = setInterval(() => {
      if (check()) { setWizardReady(true); clearInterval(t); }
    }, 600);
    return () => clearInterval(t);
  }, [uid, wizardReady]);

  // ── Queue the tour for the current section when navigating ──────────────────
  React.useEffect(() => {
    if (!wizardReady)  return;
    if (activeTour)    return;

    const tourId = NAV_TO_TOUR[activeNav];
    if (!tourId) return;

    try {
      if (localStorage.getItem(flagKey(uid, tourId))) return; // already seen
    } catch { return; }

    // Slight delay so the new section is visible behind the modal
    const t = setTimeout(() => {
      setActiveTour(tourId);
      setStep(0);
      setDirection("fwd");
    }, 550);
    return () => clearTimeout(t);
  }, [wizardReady, activeNav, activeTour, uid]);

  const tours   = React.useMemo(() => buildTours(userName), [userName]);
  const tour    = activeTour ? tours[activeTour] : null;
  const current = tour ? tour.steps[step] : null;
  const isFirst = step === 0;
  const isLast  = tour ? step === tour.steps.length - 1 : false;

  const dismiss = React.useCallback(() => {
    if (!activeTour) return;
    try { localStorage.setItem(flagKey(uid, activeTour), "1"); } catch { /* ignore */ }
    setActiveTour(null);
  }, [activeTour, uid]);

  const next = React.useCallback(() => {
    if (!tour) return;
    if (isLast) { dismiss(); return; }
    setDirection("fwd");
    setStep((s) => s + 1);
  }, [tour, isLast, dismiss]);

  const back = React.useCallback(() => {
    setDirection("back");
    setStep((s) => Math.max(0, s - 1));
  }, []);

  // Keyboard
  React.useEffect(() => {
    if (!activeTour) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft" && !isFirst) back();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTour, dismiss, next, back, isFirst]);

  if (!tour || !current) return null;

  const slideAnim = direction === "fwd" ? "tourSlideIn" : "tourSlideInBack";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <style>{`
        @keyframes tourOverlay     { from { opacity: 0 } to { opacity: 1 } }
        @keyframes tourModal       { from { opacity: 0; transform: scale(0.96) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes tourSlideIn     { from { opacity: 0; transform: translateX(28px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes tourSlideInBack { from { opacity: 0; transform: translateX(-28px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes tourArt         { from { opacity: 0; transform: scale(0.92) } to { opacity: 1; transform: scale(1) } }
      `}</style>

      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        style={{ animation: "tourOverlay 0.25s ease both" }}
        onClick={dismiss} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: "tourModal 0.3s cubic-bezier(0.16,1,0.3,1) both" }}>

        <button onClick={dismiss}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 backdrop-blur-sm transition-colors">
          {isLast ? "Cerrar" : "Saltar"} <X className="w-3.5 h-3.5" />
        </button>

        <div className="grid md:grid-cols-2 min-h-[440px]">
          {/* Left: illustration */}
          <div key={`art-${activeTour}-${step}`}
            className="relative overflow-hidden flex items-center justify-center p-8 sm:p-10 min-h-[220px]"
            style={{
              background: `linear-gradient(135deg, ${tour.color}0F 0%, ${tour.color}26 100%)`,
              animation: "tourArt 0.4s cubic-bezier(0.16,1,0.3,1) both",
            }}>
            <div className="absolute -top-16 -right-12 w-48 h-48 rounded-full opacity-20" style={{ backgroundColor: tour.color }} />
            <div className="absolute -bottom-20 -left-12 w-44 h-44 rounded-full opacity-10" style={{ backgroundColor: tour.color }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.image} alt="" className="relative w-full max-w-[260px] h-auto drop-shadow-lg" draggable={false} />
          </div>

          {/* Right: content */}
          <div className="flex flex-col p-8 sm:p-10">
            <div key={`text-${activeTour}-${step}`} className="flex-1 flex flex-col"
              style={{ animation: `${slideAnim} 0.35s cubic-bezier(0.16,1,0.3,1) both` }}>

              {current.badge && current.icon && (
                <div className="inline-flex items-center gap-2 self-start px-2.5 py-1 rounded-full mb-4"
                  style={{ backgroundColor: tour.color + "15" }}>
                  <current.icon className="w-3.5 h-3.5" style={{ color: tour.color }} />
                  <span className="text-xs font-semibold" style={{ color: tour.color }}>{current.badge}</span>
                </div>
              )}

              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 leading-tight">{current.title}</h2>
              <p className="text-base text-slate-500 mt-3 leading-relaxed">{current.description}</p>

              {current.hint && (
                <p className="text-xs text-slate-400 mt-5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: tour.color }} />
                  {current.hint}
                </p>
              )}
            </div>

            {/* Step dots + navigation */}
            <div className="pt-6 mt-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {tour.steps.map((_, i) => (
                  <button key={i}
                    onClick={() => { setDirection(i > step ? "fwd" : "back"); setStep(i); }}
                    aria-label={`Paso ${i + 1}`}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      i === step ? "w-6" : "w-1.5 bg-slate-200 hover:bg-slate-300",
                    )}
                    style={i === step ? { backgroundColor: tour.color } : undefined} />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {!isFirst && (
                  <button onClick={back} aria-label="Atrás"
                    className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <button onClick={next}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:brightness-110 hover:shadow-md"
                  style={{ backgroundColor: tour.color }}>
                  {isLast
                    ? <>Entendido <Check className="w-4 h-4" /></>
                    : <>Siguiente <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
