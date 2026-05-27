"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { User, Users, Building, Building2, Video, MapPin, Laptop2, CheckCircle2, Plus, X } from "lucide-react";
import { SiSlack, SiGooglecalendar, SiJira, SiNotion } from "react-icons/si";
import { TbBrandTeams } from "react-icons/tb";


// ── Types ────────────────────────────────────────────────────────────────────
export interface WizardData {
  orgName:      string;
  teamSize:     string;
  meetingTypes: string[];
  tools:        string[];
  customTools:  string[];
}

interface StepProps {
  data:     WizardData;
  onChange: (updated: WizardData) => void;
}

// ── Static options ────────────────────────────────────────────────────────────
const TEAM_SIZES = [
  { id: "solo",  label: "Solo yo",        Icon: User      },
  { id: "2-10",  label: "2–10 personas",  Icon: Users     },
  { id: "11-50", label: "11–50 personas", Icon: Building  },
  { id: "50+",   label: "50+ personas",   Icon: Building2 },
];

const MEETING_TYPES = [
  { id: "presencial", label: "Presenciales", Icon: MapPin  },
  { id: "virtual",    label: "Virtuales",    Icon: Video   },
  { id: "hibrida",    label: "Híbridas",     Icon: Laptop2 },
];

const TOOLS = [
  { id: "slack",  label: "Slack",           Icon: SiSlack,        color: "#4A154B" },
  { id: "teams",  label: "Microsoft Teams", Icon: TbBrandTeams,   color: "#5059C9" },
  { id: "gcal",   label: "Google Calendar", Icon: SiGooglecalendar, color: "#1A73E8" },
  { id: "jira",   label: "Jira",            Icon: SiJira,         color: "#0052CC" },
  { id: "notion", label: "Notion",          Icon: SiNotion,       color: "#191919" },
];

const LOADING_PHRASES = [
  "Preparando tu espacio de trabajo...",
  "Configurando tus integraciones...",
  "Personalizando tu experiencia...",
  "Casi listo para ti...",
];

const TOTAL_QUESTIONS = 4;

function canProceed(step: number, data: WizardData) {
  if (step === 0) return data.orgName.trim().length > 0;
  if (step === 1) return data.teamSize !== "";
  if (step === 2) return data.meetingTypes.length > 0;
  return true;
}

// ── Loading screen ────────────────────────────────────────────────────────────
function LoadingScreen() {
  const [phraseIdx, setPhraseIdx] = React.useState(0);
  const [visible,   setVisible]   = React.useState(true);

  React.useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setPhraseIdx((i) => (i + 1) % LOADING_PHRASES.length);
        setVisible(true);
      }, 300);
    }, 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-6">

      {/* Logo + spinner ring */}
      <div className="relative flex items-center justify-center mb-8">
        <div className="absolute w-20 h-20 rounded-full border-[3px] border-slate-100 border-t-[#050040] animate-spin" />
        <svg width="30" height="38" viewBox="0 0 31 40" fill="none">
          <path
            d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585"
            stroke="#050040" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Cycling phrase */}
      <p className={cn(
        "text-sm font-medium text-slate-500 mb-10 transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0",
      )}>
        {LOADING_PHRASES[phraseIdx]}
      </p>

      {/* Skeleton */}
      <div className="w-full max-w-sm space-y-3">
        <div className="h-6 bg-slate-100 rounded-xl animate-pulse w-2/3" />
        <div className="h-3.5 bg-slate-100 rounded-lg animate-pulse w-full" />
        <div className="h-3.5 bg-slate-100 rounded-lg animate-pulse w-5/6" />
        <div className="h-3.5 bg-slate-100 rounded-lg animate-pulse w-4/5" />
        <div className="mt-4 h-24 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="flex gap-2 pt-1">
          <div className="h-10 bg-slate-100 rounded-xl animate-pulse flex-1" />
          <div className="h-10 bg-slate-100 rounded-xl animate-pulse flex-1" />
          <div className="h-10 bg-slate-100 rounded-xl animate-pulse w-10" />
        </div>
        <div className="h-3.5 bg-slate-100 rounded-lg animate-pulse w-3/5 mx-auto mt-2" />
      </div>
    </div>
  );
}

// ── Step: org name ────────────────────────────────────────────────────────────
function StepOrgName({ data, onChange }: StepProps) {
  return (
    <>
      <h2 className="text-2xl font-bold text-[#050040] mb-2">
        ¿Cómo se llama tu organización?
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        Usaremos este nombre para personalizar tu espacio en MeetBox.
      </p>
      <input
        type="text"
        autoFocus
        placeholder="Ej. Acme Corp"
        value={data.orgName}
        onChange={(e) => onChange({ ...data, orgName: e.target.value })}
        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#050040] focus:ring-4 focus:ring-[#050040]/10 transition text-base"
      />
    </>
  );
}

// ── Step: team size ───────────────────────────────────────────────────────────
function StepTeamSize({ data, onChange }: StepProps) {
  return (
    <>
      <h2 className="text-2xl font-bold text-[#050040] mb-2">
        ¿Cuántas personas hay en tu equipo?
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        Esto nos permite adaptar las funciones a tu escala.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {TEAM_SIZES.map(({ id, label, Icon }) => {
          const active = data.teamSize === id;
          return (
            <button
              key={id}
              onClick={() => onChange({ ...data, teamSize: id })}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all",
                active ? "border-[#050040] bg-[#050040]/5" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100",
              )}
            >
              <Icon className={cn("w-5 h-5 shrink-0", active ? "text-[#050040]" : "text-slate-400")} />
              <span className={cn("text-sm font-medium", active ? "text-[#050040]" : "text-slate-600")}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── Step: meeting types ───────────────────────────────────────────────────────
function StepMeetingTypes({ data, onChange }: StepProps) {
  function toggle(id: string) {
    const next = data.meetingTypes.includes(id)
      ? data.meetingTypes.filter((t) => t !== id)
      : [...data.meetingTypes, id];
    onChange({ ...data, meetingTypes: next });
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-[#050040] mb-2">
        ¿Qué tipo de reuniones tienes?
      </h2>
      <p className="text-sm text-slate-500 mb-6">Puedes seleccionar más de una opción.</p>
      <div className="flex flex-col gap-3">
        {MEETING_TYPES.map(({ id, label, Icon }) => {
          const active = data.meetingTypes.includes(id);
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all",
                active ? "border-[#050040] bg-[#050040]/5" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100",
              )}
            >
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                active ? "bg-[#050040] text-white" : "bg-slate-200 text-slate-500",
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <span className={cn("text-sm font-medium flex-1", active ? "text-[#050040]" : "text-slate-600")}>
                {label}
              </span>
              <Checkmark active={active} />
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── Step: tools ───────────────────────────────────────────────────────────────
function StepTools({ data, onChange }: StepProps) {
  const [otroOpen, setOtroOpen]   = React.useState(() => data.customTools.length > 0);
  const [inputVal, setInputVal]   = React.useState("");
  const inputRef                  = React.useRef<HTMLInputElement>(null);

  function toggleTool(id: string) {
    const next = data.tools.includes(id)
      ? data.tools.filter((t) => t !== id)
      : [...data.tools, id];
    onChange({ ...data, tools: next });
  }

  function toggleOtro() {
    const next = !otroOpen;
    setOtroOpen(next);
    if (next) setTimeout(() => inputRef.current?.focus(), 120);
  }

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || data.customTools.includes(tag)) return;
    onChange({ ...data, customTools: [...data.customTools, tag] });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === " " || e.key === "Enter") && inputVal.trim()) {
      e.preventDefault();
      addTag(inputVal);
      setInputVal("");
    } else if (e.key === "Backspace" && !inputVal && data.customTools.length > 0) {
      onChange({ ...data, customTools: data.customTools.slice(0, -1) });
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const words = e.clipboardData.getData("text").split(/\s+/).filter(Boolean);
    const unique = words.filter((w) => !data.customTools.includes(w));
    if (unique.length) onChange({ ...data, customTools: [...data.customTools, ...unique] });
  }

  function removeTag(tag: string) {
    onChange({ ...data, customTools: data.customTools.filter((t) => t !== tag) });
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-[#050040] mb-2">
        ¿Qué herramientas usa tu equipo?
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        Las integraremos automáticamente en tu configuración.
      </p>
      <div className="flex flex-col gap-2.5">
        {TOOLS.map(({ id, label, Icon, color }) => {
          const active = data.tools.includes(id);
          return (
            <button
              key={id}
              onClick={() => toggleTool(id)}
              className={cn(
                "flex items-center gap-4 p-3.5 rounded-xl border-2 text-left transition-all",
                active ? "border-[#050040] bg-[#050040]/5" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100",
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0">
                <Icon style={{ color }} className="w-4 h-4" />
              </div>
              <span className={cn("text-sm font-medium flex-1", active ? "text-[#050040]" : "text-slate-600")}>
                {label}
              </span>
              <Checkmark active={active} />
            </button>
          );
        })}

        {/* Otro */}
        <button
          onClick={toggleOtro}
          className={cn(
            "flex items-center gap-4 p-3.5 rounded-xl border-2 text-left transition-all",
            otroOpen ? "border-[#050040] bg-[#050040]/5" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100",
          )}
        >
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
            otroOpen ? "bg-[#050040] text-white" : "bg-slate-200 text-slate-500",
          )}>
            <Plus className="w-4 h-4" />
          </div>
          <span className={cn("text-sm font-medium flex-1", otroOpen ? "text-[#050040]" : "text-slate-600")}>
            Otro
          </span>
          <Checkmark active={otroOpen} />
        </button>

        {/* Tag input area */}
        {otroOpen && (
          <div className="rounded-xl border-2 border-[#050040]/20 bg-slate-50 p-3 transition-all">
            {data.customTools.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {data.customTools.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 bg-[#050040]/10 text-[#050040] rounded-lg px-2.5 py-1 text-xs font-medium"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="opacity-60 hover:opacity-100 transition-opacity ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              ref={inputRef}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Escribe y presiona espacio o Enter para agregar..."
              className="w-full bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
            />
          </div>
        )}
      </div>
    </>
  );
}

// ── Step: welcome ─────────────────────────────────────────────────────────────
function StepWelcome({ data }: { data: WizardData }) {
  const totalTools = data.tools.length + data.customTools.length;
  return (
    <div className="text-center py-2">
      <div className="flex items-center justify-center gap-2 mb-8">
        <svg width="24" height="31" viewBox="0 0 31 40" fill="none">
          <path
            d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585"
            stroke="#050040" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
        <span className="text-xl font-semibold tracking-tight text-[#050040]">MeetBox</span>
      </div>
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
        <CheckCircle2 className="w-8 h-8 text-green-500" />
      </div>
      <h2 className="text-2xl font-bold text-[#050040] mb-2">
        {data.orgName ? `¡Todo listo, ${data.orgName}!` : "¡Todo listo!"}
      </h2>
      <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
        Tu espacio de trabajo está configurado. Ya puedes empezar a transcribir y analizar tus reuniones.
      </p>
      {totalTools > 0 && (
        <div className="mt-5 inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5">
          <span className="text-xs text-slate-500">
            {totalTools} integración{totalTools !== 1 ? "es" : ""} configurada{totalTools !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Shared checkmark ──────────────────────────────────────────────────────────
function Checkmark({ active }: { active: boolean }) {
  return (
    <div className={cn(
      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
      active ? "bg-[#050040] border-[#050040]" : "border-slate-300",
    )}>
      {active && (
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────
interface OnboardingWizardProps {
  onComplete?: () => void;
}

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [loading,   setLoading]   = React.useState(false);
  const [step,      setStep]      = React.useState(0);
  const [dir,       setDir]       = React.useState<"fwd" | "back">("fwd");
  const [animating, setAnimating] = React.useState(false);
  const [data,      setData]      = React.useState<WizardData>({
    orgName: "", teamSize: "", meetingTypes: [], tools: [], customTools: [],
  });

  function navigate(next: number, direction: "fwd" | "back") {
    if (animating) return;
    setDir(direction);
    setAnimating(true);
    setTimeout(() => { setStep(next); setAnimating(false); }, 280);
  }

  async function finish() {
    setLoading(true);

    // Persist to DB in parallel with the loading animation
    fetch("/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch((err) => console.error("Error guardando perfil:", err));

    setTimeout(() => {
      onComplete?.();
    }, 3600);
  }

  if (loading) return <LoadingScreen />;

  const isWelcome = step === TOTAL_QUESTIONS;
  const progress  = isWelcome ? 100 : ((step + 1) / TOTAL_QUESTIONS) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white px-4">
      <div className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-[0_8px_40px_-8px_rgba(5,0,64,0.18),0_2px_12px_-2px_rgba(5,0,64,0.08)]">

        {/* Progress bar */}
        <div className="h-1 w-full bg-slate-100">
          <div
            className="h-full bg-[#050040] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="px-8 py-8">
          {!isWelcome && (
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6">
              Paso {step + 1} de {TOTAL_QUESTIONS}
            </p>
          )}

          <div className={cn(
            "transition-all duration-300",
            animating && dir === "fwd"  && "opacity-0 translate-x-4",
            animating && dir === "back" && "opacity-0 -translate-x-4",
            !animating && "opacity-100 translate-x-0",
          )}>
            {step === 0 && <StepOrgName      data={data} onChange={setData} />}
            {step === 1 && <StepTeamSize     data={data} onChange={setData} />}
            {step === 2 && <StepMeetingTypes data={data} onChange={setData} />}
            {step === 3 && <StepTools        data={data} onChange={setData} />}
            {isWelcome  && <StepWelcome      data={data} />}
          </div>

          <div className={cn(
            "flex items-center mt-8",
            step > 0 && !isWelcome ? "justify-between" : "justify-end",
          )}>
            {step > 0 && !isWelcome && (
              <button
                onClick={() => navigate(step - 1, "back")}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                Atrás
              </button>
            )}

            {!isWelcome && (
              <button
                onClick={() => navigate(step + 1, "fwd")}
                disabled={!canProceed(step, data)}
                className="px-6 py-2.5 rounded-xl bg-[#050040] text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {step === TOTAL_QUESTIONS - 1 ? "Finalizar" : "Siguiente"}
                {step < TOTAL_QUESTIONS - 1 && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            )}

            {isWelcome && (
              <button
                onClick={finish}
                className="w-full px-6 py-3 rounded-xl bg-[#050040] text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                Empezar con MeetBox
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
