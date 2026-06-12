"use client";
/**
 * MeetCalendarView — full calendar component with month/week/day views.
 *
 * Supports:
 *   - Three views: month (grid), week (hourly column), day (hourly single)
 *   - Event types: meeting, event, reminder — each with its own color and icon
 *   - Recurrence: daily and weekly patterns with optional end date
 *   - Google Calendar push via the events API (when user has linked their account)
 *   - Keyboard navigation: arrow keys move the current date; Escape closes modals
 *
 * Recurring events are expanded server-side and returned as virtual instances
 * that share the original event's id but have shifted start_at/end_at.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, Plus, X, Clock, MapPin, Bell,
  Trash2, Video, CalendarDays, AlignLeft, Check, RefreshCw,
  GripVertical, Share2, Copy, Link2, ExternalLink,
  ArrowLeft, ArrowRight, Sparkles, Pencil, Repeat,
} from "lucide-react";
import { SiGooglecalendar, SiApple } from "react-icons/si";
import { useNotifications } from "@/lib/notifications";

// ── Types ──────────────────────────────────────────────────────────────────────
type EventType = "meeting" | "event" | "reminder";
type CalView   = "month" | "week" | "day";
type RecurrenceFreq = "none" | "daily" | "weekly";

interface CalEvent {
  id:             string;
  title:          string;
  description:    string | null;
  location:       string | null;
  type:           EventType;
  start_at:       string;
  end_at:         string | null;
  all_day:        boolean;
  color:          string;
  notify_email:   boolean;
  notify_minutes: number;
  google_event_id?: string | null;
  // Recurrence (also present on instances returned by the API)
  recurrence_freq?:  RecurrenceFreq | null;
  recurrence_days?:  number[] | null;
  recurrence_until?: string  | null;
  // Zoom
  zoom_meeting_id?: string | null;
  zoom_join_url?:   string | null;
  zoom_status?:     string | null;
  with_zoom?:       boolean;
}

interface EventFormData {
  title:          string;
  type:           EventType;
  all_day:        boolean;
  start_date:     string;
  start_time:     string;
  end_date:       string;
  end_time:       string;
  location:       string;
  description:    string;
  color:          string;
  notify:         boolean;
  notify_minutes: number;
  notify_email:   boolean;
  // Recurrence
  recurrence_freq:  RecurrenceFreq;
  recurrence_days:  number[];     // 0=Mon … 6=Sun, only used when freq === "weekly"
  recurrence_until: string;       // "" = never, else "YYYY-MM-DD"
  // Zoom
  with_zoom:      boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────
// Week starts on Monday (ISO 8601) — JS getDay() returns 0=Sun, so we remap
// with (day + 6) % 7 everywhere to get 0=Mon … 6=Sun.
const MONTHS_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DAYS_LONG  = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const DAYS_SHORT = ["Lu","Ma","Mi","Ju","Vi","Sá","Do"];
const HOURS      = Array.from({ length: 24 }, (_, i) => i);
const HOUR_H     = 60; // px per hour in week/day view

const EVENT_COLORS = [
  "#050040","#059669","#d97706","#7c3aed",
  "#dc2626","#2563eb","#db2777","#0891b2",
];

const TYPE_META: Record<EventType, { label: string; color: string; icon: React.ElementType }> = {
  meeting:  { label: "Reunión",      color: "#050040", icon: Video       },
  event:    { label: "Evento",       color: "#059669", icon: CalendarDays },
  reminder: { label: "Recordatorio", color: "#d97706", icon: Bell         },
};

const NOTIFY_OPTS = [
  { value: 5,   label: "5 min antes"  },
  { value: 10,  label: "10 min antes" },
  { value: 15,  label: "15 min antes" },
  { value: 30,  label: "30 min antes" },
  { value: 60,  label: "1 h antes"    },
  { value: 120, label: "2 h antes"    },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function isoTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function startOfWeekMon(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  r.setHours(0, 0, 0, 0);
  return r;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function fmtDateLong(d: Date): string {
  return `${DAYS_LONG[(d.getDay() + 6) % 7]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}
/**
 * Compute the API query range for the current view.
 * Month view fetches one extra month on each side so events near the grid
 * edges (days from adjacent months) are also included.
 */
function getViewRange(view: CalView, date: Date): { start: string; end: string } {
  if (view === "month") {
    const y = date.getFullYear(), m = date.getMonth();
    return {
      start: new Date(y, m - 1, 1).toISOString(),
      end:   new Date(y, m + 2, 0, 23, 59, 59).toISOString(),
    };
  }
  if (view === "week") {
    const ws = startOfWeekMon(date);
    const we = addDays(ws, 6);
    we.setHours(23, 59, 59);
    return { start: ws.toISOString(), end: we.toISOString() };
  }
  const s = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  const e = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
  return { start: s.toISOString(), end: e.toISOString() };
}
function formDefaults(type: EventType, dateOrTime?: Date): EventFormData {
  const d = dateOrTime ?? new Date();
  const roundedMinutes = Math.ceil(d.getMinutes() / 30) * 30;
  const start = new Date(d);
  start.setMinutes(roundedMinutes, 0, 0);
  if (roundedMinutes === 60) { start.setHours(d.getHours() + 1); start.setMinutes(0); }
  const end = new Date(start); end.setHours(end.getHours() + 1);
  return {
    title: "", type, all_day: false,
    start_date: isoDate(start), start_time: isoTimeStr(start),
    end_date:   isoDate(end),   end_time:   isoTimeStr(end),
    location: "", description: "",
    color: TYPE_META[type].color,
    notify: false, notify_minutes: 15, notify_email: false,
    recurrence_freq: "none", recurrence_days: [], recurrence_until: "",
    with_zoom: type === "meeting",
  };
}
function eventToForm(ev: CalEvent): EventFormData {
  const s = new Date(ev.start_at);
  const e = ev.end_at ? new Date(ev.end_at) : null;
  return {
    title:          ev.title,
    type:           ev.type,
    all_day:        ev.all_day,
    start_date:     isoDate(s),
    start_time:     isoTimeStr(s),
    end_date:       e ? isoDate(e)     : isoDate(s),
    end_time:       e ? isoTimeStr(e)  : isoTimeStr(new Date(s.getTime() + 3600000)),
    location:       ev.location    ?? "",
    description:    ev.description ?? "",
    color:          ev.color,
    notify:         ev.notify_email || ev.notify_minutes !== 15,
    notify_minutes: ev.notify_minutes,
    notify_email:   ev.notify_email,
    recurrence_freq:  ev.recurrence_freq ?? "none",
    recurrence_days:  ev.recurrence_days ?? [],
    recurrence_until: ev.recurrence_until ? ev.recurrence_until.split("T")[0] : "",
    with_zoom:        ev.zoom_meeting_id ? true : false,
  };
}
/**
 * Return the local UTC offset as a string like "+05:30" or "-03:00".
 * Used to build ISO 8601 timestamps that carry the user's timezone so the
 * server stores the event in the right local time.
 */
function localOffsetStr(): string {
  const off  = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs  = Math.abs(off);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
function formToPayload(f: EventFormData): Omit<CalEvent, "id" | "google_event_id"> {
  const tz = localOffsetStr();
  const start_at = f.all_day
    ? `${f.start_date}T00:00:00${tz}`
    : `${f.start_date}T${f.start_time}:00${tz}`;
  const end_at = f.all_day
    ? `${f.end_date || f.start_date}T23:59:59${tz}`
    : f.end_date && f.end_time
      ? `${f.end_date}T${f.end_time}:00${tz}`
      : null;

  // Normalize recurrence — only persist what's meaningful
  const isRec     = f.recurrence_freq !== "none";
  const recDays   = f.recurrence_freq === "weekly" && f.recurrence_days.length > 0
                      ? [...f.recurrence_days].sort((a, b) => a - b)
                      : null;
  const recUntil  = isRec && f.recurrence_until
                      ? `${f.recurrence_until}T23:59:59${tz}`
                      : null;

  return {
    title:          f.title.trim() || "Sin título",
    description:    f.description || null,
    location:       f.location    || null,
    type:           f.type,
    start_at,
    end_at,
    all_day:        f.all_day,
    color:          f.color,
    notify_email:   f.notify ? f.notify_email : false,
    notify_minutes: f.notify_minutes,
    recurrence_freq:  isRec ? f.recurrence_freq : null,
    recurrence_days:  recDays,
    recurrence_until: recUntil,
    with_zoom:        f.with_zoom,
  };
}

// ── EventModal ─────────────────────────────────────────────────────────────────
interface ModalProps {
  editing:  CalEvent | null;
  defaults: EventFormData;
  onSave:   (payload: Omit<CalEvent, "id" | "google_event_id">) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose:  () => void;
}
// ── Quick time presets ───────────────────────────────────────────────────────
const QUICK_PRESETS: { label: string; getStart: () => Date }[] = [
  { label: "Ahora",          getStart: () => { const d = new Date(); d.setMinutes(Math.round(d.getMinutes()/15)*15, 0, 0); return d; } },
  { label: "En 30 min",      getStart: () => { const d = new Date(Date.now() + 30 * 60000); d.setMinutes(Math.round(d.getMinutes()/15)*15, 0, 0); return d; } },
  { label: "En 1 hora",      getStart: () => { const d = new Date(Date.now() + 60 * 60000); d.setMinutes(Math.round(d.getMinutes()/15)*15, 0, 0); return d; } },
  { label: "Mañana 9:00",    getStart: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
  { label: "Esta tarde 15:00", getStart: () => { const d = new Date(); d.setHours(15, 0, 0, 0); return d; } },
];

const TYPE_HINTS: Record<EventType, string> = {
  meeting:  "Con personas, llamadas o videollamadas",
  event:    "Una actividad o cita",
  reminder: "Un aviso o tarea simple",
};

const TYPE_PLACEHOLDERS: Record<EventType, string> = {
  meeting:  "Ej. Sync con producto",
  event:    "Ej. Demo trimestral",
  reminder: "Ej. Llamar al equipo legal",
};

function EventModal({ editing, defaults, onSave, onDelete, onClose }: ModalProps) {
  const [form, setForm]         = React.useState<EventFormData>(() => editing ? eventToForm(editing) : defaults);
  const [step, setStep]         = React.useState(0);
  const [direction, setDirection] = React.useState<"fwd" | "back">("fwd");
  const [saving,   setSaving]   = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  function set<K extends keyof EventFormData>(key: K, value: EventFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function applyPreset(getStart: () => Date) {
    const s = getStart();
    const e = new Date(s.getTime() + 60 * 60000);
    const pad = (n: number) => String(n).padStart(2, "0");
    setForm((f) => ({
      ...f,
      all_day:    false,
      start_date: `${s.getFullYear()}-${pad(s.getMonth()+1)}-${pad(s.getDate())}`,
      start_time: `${pad(s.getHours())}:${pad(s.getMinutes())}`,
      end_date:   `${e.getFullYear()}-${pad(e.getMonth()+1)}-${pad(e.getDate())}`,
      end_time:   `${pad(e.getHours())}:${pad(e.getMinutes())}`,
    }));
  }

  function goto(s: number) {
    setDirection(s > step ? "fwd" : "back");
    setStep(s);
  }
  function next() {
    if (step >= 2) return;
    setDirection("fwd"); setStep(step + 1);
  }
  function back() {
    if (step <= 0) return;
    setDirection("back"); setStep(step - 1);
  }

  async function handleSave() {
    setSaving(true);
    await onSave(formToPayload(form));
    setSaving(false);
  }
  async function handleDelete() {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  }

  // Enter key handling
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
        if (step === 0 && form.title.trim()) { e.preventDefault(); next(); }
        else if (step === 1) { e.preventDefault(); next(); }
      }
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, form.title]); // eslint-disable-line react-hooks/exhaustive-deps

  const TypeIcon  = TYPE_META[form.type].icon;
  const canNext0  = form.title.trim().length > 0;
  const slideAnim = direction === "fwd" ? "evSlideFwd" : "evSlideBack";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <style>{`
        @keyframes evSlideFwd  { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes evSlideBack { from { opacity: 0; transform: translateX(-24px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes evPop       { from { opacity: 0; transform: scale(0.9) } to { opacity: 1; transform: scale(1) } }
      `}</style>

      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        style={{ animation: "mcalOverlay 0.18s ease both" }} onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden"
        style={{ animation: "mcalModal 0.22s cubic-bezier(0.16,1,0.3,1) both" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors"
              style={{ backgroundColor: form.color + "1F" }}>
              <TypeIcon style={{ color: form.color }} className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-800 leading-tight truncate">
                {editing ? "Editar" : "Nuevo"} {TYPE_META[form.type].label.toLowerCase()}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Paso {step + 1} de 3</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="px-6 pt-3 pb-1 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <button key={i}
              onClick={() => goto(i)}
              disabled={i > 0 && !canNext0}
              aria-label={`Paso ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 disabled:opacity-40",
                i === step ? "flex-1" : i < step ? "flex-1 opacity-50" : "w-8",
              )}
              style={i <= step ? { backgroundColor: form.color } : { backgroundColor: "#e2e8f0" }} />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div key={`step-${step}`} style={{ animation: `${slideAnim} 0.28s cubic-bezier(0.16,1,0.3,1) both` }}>

            {/* ── Step 1 — What? ── */}
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 leading-tight">¿Qué quieres crear?</h3>
                  <p className="text-sm text-slate-500 mt-1">Elige el tipo y dale un nombre.</p>
                </div>

                {/* Type cards */}
                <div className="grid grid-cols-3 gap-2.5">
                  {(["meeting","event","reminder"] as EventType[]).map((t) => {
                    const m = TYPE_META[t];
                    const active = form.type === t;
                    return (
                      <button key={t}
                        onClick={() => { set("type", t); if (!editing) set("color", m.color); }}
                        className={cn(
                          "p-3 rounded-2xl border-2 text-left transition-all duration-200",
                          active
                            ? "shadow-sm scale-[1.02]"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:-translate-y-0.5",
                        )}
                        style={active ? { backgroundColor: m.color + "10", borderColor: m.color } : {}}
                      >
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2 transition-colors"
                          style={{ backgroundColor: active ? m.color : m.color + "15" }}>
                          <m.icon className="w-4 h-4" style={{ color: active ? "#fff" : m.color }} />
                        </div>
                        <p className="text-sm font-bold text-slate-800 leading-tight">{m.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{TYPE_HINTS[t].split(",")[0]}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Title input */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Pencil className="w-3 h-3" />Nombre
                  </label>
                  <input
                    autoFocus type="text" value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder={TYPE_PLACEHOLDERS[form.type]}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-200 text-base text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white transition-all"
                    style={form.title ? { borderColor: form.color + "60" } : {}} />
                  <p className="text-xs text-slate-400 mt-1.5">{TYPE_HINTS[form.type]}</p>
                </div>
              </div>
            )}

            {/* ── Step 2 — When? ── */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 leading-tight">¿Cuándo es?</h3>
                  <p className="text-sm text-slate-500 mt-1">Fecha y hora. Usa los atajos para ir más rápido.</p>
                </div>

                {/* All-day pill */}
                <button onClick={() => set("all_day", !form.all_day)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all",
                    form.all_day
                      ? "text-white border-transparent"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                  )}
                  style={form.all_day ? { backgroundColor: form.color, borderColor: form.color } : {}}>
                  <div className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center transition-all",
                    form.all_day ? "bg-white border-white" : "border-slate-300",
                  )}>
                    {form.all_day && <Check className="w-3 h-3" style={{ color: form.color }} />}
                  </div>
                  Todo el día
                </button>

                {/* Quick presets — only when not all-day */}
                {!form.all_day && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" />Atajos
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_PRESETS.map(({ label, getStart }) => (
                        <button key={label} onClick={() => applyPreset(getStart)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-white hover:border-slate-300 hover:-translate-y-0.5 transition-all">
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Date / Time */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Inicio</label>
                    <div className={cn("grid gap-2", form.all_day ? "grid-cols-1" : "grid-cols-[1fr_auto]")}>
                      <input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)}
                        className="px-3 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-sm text-slate-700 outline-none focus:bg-white focus:border-slate-300 transition-all" />
                      {!form.all_day && (
                        <input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)}
                          className="px-3 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-sm text-slate-700 outline-none focus:bg-white focus:border-slate-300 transition-all" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-slate-300">
                    <div className="flex-1 h-px bg-slate-100" />
                    <ArrowRight className="w-3 h-3 shrink-0" />
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Fin</label>
                    <div className={cn("grid gap-2", form.all_day ? "grid-cols-1" : "grid-cols-[1fr_auto]")}>
                      <input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)}
                        className="px-3 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-sm text-slate-700 outline-none focus:bg-white focus:border-slate-300 transition-all" />
                      {!form.all_day && (
                        <input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)}
                          className="px-3 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-sm text-slate-700 outline-none focus:bg-white focus:border-slate-300 transition-all" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Recurrence */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Repeat className="w-3 h-3" />Se repite
                  </label>

                  {/* Frequency cards */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {([
                      { id: "none",   label: "No se repite", hint: "Una sola vez"      },
                      { id: "daily",  label: "Cada día",     hint: "Todos los días"    },
                      { id: "weekly", label: "Cada semana",  hint: "Días específicos"  },
                    ] as { id: RecurrenceFreq; label: string; hint: string }[]).map(({ id, label, hint }) => {
                      const active = form.recurrence_freq === id;
                      return (
                        <button key={id}
                          onClick={() => {
                            // When switching to weekly with no preselected days, pick the start day's weekday
                            if (id === "weekly" && form.recurrence_days.length === 0) {
                              const sd = new Date(form.start_date + "T00:00:00");
                              const wd = (sd.getDay() + 6) % 7;
                              setForm((f) => ({ ...f, recurrence_freq: id, recurrence_days: [wd] }));
                            } else {
                              set("recurrence_freq", id);
                            }
                          }}
                          className={cn(
                            "px-2.5 py-2 rounded-xl border-2 text-left transition-all",
                            active
                              ? "shadow-sm scale-[1.02]"
                              : "bg-white border-slate-200 hover:border-slate-300",
                          )}
                          style={active ? { borderColor: form.color, backgroundColor: form.color + "10" } : {}}>
                          <p className="text-xs font-bold text-slate-800 leading-tight">{label}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{hint}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Weekly day picker */}
                  {form.recurrence_freq === "weekly" && (
                    <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 mb-3"
                      style={{ animation: "evSlideFwd 0.22s cubic-bezier(0.16,1,0.3,1) both" }}>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Días de la semana</p>
                      <div className="flex gap-1.5">
                        {DAYS_SHORT.map((d, idx) => {
                          const on = form.recurrence_days.includes(idx);
                          return (
                            <button key={idx}
                              onClick={() => {
                                setForm((f) => ({
                                  ...f,
                                  recurrence_days: on
                                    ? f.recurrence_days.filter((x) => x !== idx)
                                    : [...f.recurrence_days, idx],
                                }));
                              }}
                              className={cn(
                                "flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-all",
                                on ? "text-white shadow-sm scale-105" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
                              )}
                              style={on ? { backgroundColor: form.color, borderColor: form.color } : {}}>
                              {d}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        <button
                          onClick={() => setForm((f) => ({ ...f, recurrence_days: [0, 1, 2, 3, 4] }))}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 hover:border-slate-300 transition">
                          L–V (entre semana)
                        </button>
                        <button
                          onClick={() => setForm((f) => ({ ...f, recurrence_days: [0, 1, 2, 3, 4, 5, 6] }))}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 hover:border-slate-300 transition">
                          Todos
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Until date */}
                  {form.recurrence_freq !== "none" && (
                    <div style={{ animation: "evSlideFwd 0.22s cubic-bezier(0.16,1,0.3,1) both" }}>
                      <label className="text-[11px] font-semibold text-slate-500 mb-1.5 block">Termina (opcional)</label>
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <input type="date" value={form.recurrence_until}
                          onChange={(e) => set("recurrence_until", e.target.value)}
                          min={form.start_date}
                          className="px-3 py-2 rounded-xl bg-white border-2 border-slate-200 text-sm text-slate-700 outline-none focus:border-slate-300 transition-all" />
                        {form.recurrence_until && (
                          <button onClick={() => set("recurrence_until", "")}
                            className="px-3 rounded-xl border-2 border-slate-200 text-xs font-medium text-slate-500 hover:bg-slate-50 transition">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {!form.recurrence_until && (
                        <p className="text-[10px] text-slate-400 mt-1">Sin fecha límite — se repite indefinidamente.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 3 — Details ── */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 leading-tight">Detalles</h3>
                  <p className="text-sm text-slate-500 mt-1">Todo opcional. Personaliza si quieres.</p>
                </div>

                {/* Location */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" />Ubicación
                  </label>
                  <input type="text" value={form.location} onChange={(e) => set("location", e.target.value)}
                    placeholder="Sala, URL de la llamada o lugar"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:bg-white focus:border-slate-300 transition-all" />
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <AlignLeft className="w-3 h-3" />Descripción
                  </label>
                  <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
                    placeholder="Agenda, notas o contexto…" rows={3}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:bg-white focus:border-slate-300 transition-all resize-none" />
                </div>

                {/* Color */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {EVENT_COLORS.map((c) => {
                      const active = form.color === c;
                      return (
                        <button key={c} onClick={() => set("color", c)}
                          className={cn(
                            "rounded-full transition-all",
                            active ? "w-9 h-9 ring-2 ring-offset-2" : "w-8 h-8 hover:scale-110",
                          )}
                          style={{ backgroundColor: c, ...(active ? { animation: "evPop 0.25s ease both" } : {}) }} />
                      );
                    })}
                  </div>
                </div>

                {/* Notification card */}
                <div className={cn(
                  "rounded-2xl border-2 p-4 transition-all",
                  form.notify ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100",
                )}>
                  <button onClick={() => set("notify", !form.notify)}
                    className="w-full flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Bell className="w-4 h-4 text-slate-400" />Recordatorio
                    </span>
                    <div className={cn(
                      "relative rounded-full transition-colors shrink-0",
                      form.notify ? "bg-[#050040]" : "bg-slate-300",
                    )} style={{ width: 36, height: 20 }}>
                      <span className={cn(
                        "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200",
                        form.notify ? "translate-x-[18px]" : "translate-x-0.5",
                      )} />
                    </div>
                  </button>

                  {form.notify && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3"
                      style={{ animation: "evSlideFwd 0.25s cubic-bezier(0.16,1,0.3,1) both" }}>
                      <div>
                        <p className="text-xs text-slate-500 mb-1.5">¿Cuánto antes?</p>
                        <div className="flex flex-wrap gap-1.5">
                          {NOTIFY_OPTS.map(({ value, label }) => (
                            <button key={value} onClick={() => set("notify_minutes", value)}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                                form.notify_minutes === value
                                  ? "bg-[#050040] text-white border-[#050040]"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                              )}>{label}</button>
                          ))}
                        </div>
                      </div>

                      <button onClick={() => set("notify_email", !form.notify_email)}
                        className="w-full flex items-center justify-between">
                        <span className="text-xs text-slate-600">También por email</span>
                        <div className={cn(
                          "relative rounded-full transition-colors shrink-0",
                          form.notify_email ? "bg-[#050040]" : "bg-slate-300",
                        )} style={{ width: 32, height: 18 }}>
                          <span className={cn(
                            "absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform duration-200",
                            form.notify_email ? "translate-x-[15px]" : "translate-x-0.5",
                          )} />
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Zoom toggle */}
                {form.type === "meeting" && !form.all_day && !form.recurrence_freq && (
                  <div className={cn(
                    "rounded-2xl border-2 p-4 transition-all",
                    form.with_zoom ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100",
                  )}>
                    <button onClick={() => set("with_zoom", !form.with_zoom)}
                      className="w-full flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Video className="w-4 h-4 text-slate-400" />Reunión Zoom
                      </span>
                      <div className={cn(
                        "relative rounded-full transition-colors shrink-0",
                        form.with_zoom ? "bg-[#050040]" : "bg-slate-300",
                      )} style={{ width: 36, height: 20 }}>
                        <span className={cn(
                          "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200",
                          form.with_zoom ? "translate-x-[18px]" : "translate-x-0.5",
                        )} />
                      </div>
                    </button>
                    {form.with_zoom && (
                      <p className="text-xs text-slate-400 mt-2">Se creará una reunión de Zoom automáticamente.</p>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0 gap-2">
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button onClick={back}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                <ArrowLeft className="w-3.5 h-3.5" />Atrás
              </button>
            ) : editing ? (
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-red-600 border border-red-100 bg-red-50 hover:bg-red-100 transition-all disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" />{deleting ? "Eliminando…" : "Eliminar"}
              </button>
            ) : (
              <button onClick={onClose}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                Cancelar
              </button>
            )}
          </div>

          {step < 2 ? (
            <button onClick={next} disabled={step === 0 && !canNext0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-40 hover:brightness-110 hover:shadow-md"
              style={{ backgroundColor: form.color }}>
              Siguiente <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving || !form.title.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-40 hover:brightness-110 hover:shadow-md"
              style={{ backgroundColor: form.color }}>
              {saving
                ? "Guardando…"
                : editing
                  ? <>Guardar cambios <Check className="w-4 h-4" /></>
                  : <>Crear <Check className="w-4 h-4" /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TimeGrid (shared by Week & Day views) ─────────────────────────────────────
interface TimeGridProps {
  days:         Date[];
  events:       CalEvent[];
  today:        Date;
  onSlotClick:  (date: Date, hour: number) => void;
  onEventClick: (ev: CalEvent) => void;
}
function TimeGrid({ days, events, today, onSlotClick, onEventClick }: TimeGridProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Scroll to 7am on mount
    scrollRef.current?.scrollTo({ top: HOUR_H * 7 - 16, behavior: "instant" });
  }, []);

  // Current time line
  const now          = new Date();
  const nowMinutes   = now.getHours() * 60 + now.getMinutes();
  const nowTop       = (nowMinutes / 60) * HOUR_H;
  const isThisWeek   = days.some((d) => sameDay(d, now));

  function getEventsForDay(day: Date) {
    return events.filter((ev) => {
      const s = new Date(ev.start_at);
      return sameDay(s, day);
    });
  }

  function layoutDay(dayEvents: CalEvent[]): (CalEvent & { col: number; cols: number })[] {
    const timed = dayEvents.filter((e) => !e.all_day).sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
    const result: (CalEvent & { col: number; cols: number })[] = [];
    const groups: number[][] = []; // each group: [endMs]

    for (const ev of timed) {
      const startMs = new Date(ev.start_at).getTime();
      const endMs   = ev.end_at ? new Date(ev.end_at).getTime() : startMs + 3600000;
      let col = 0;
      for (let g = 0; g < groups.length; g++) {
        if (groups[g][groups[g].length - 1] <= startMs) { col = g; break; }
        if (g === groups.length - 1) col = g + 1;
      }
      if (!groups[col]) groups[col] = [];
      groups[col].push(endMs);
      result.push({ ...ev, col, cols: 0 });
    }

    const totalCols = groups.length || 1;
    result.forEach((ev) => { ev.cols = totalCols; });
    return result;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers */}
      <div className="flex shrink-0 border-b border-slate-100">
        <div className="w-14 shrink-0" />
        {days.map((day, i) => {
          const isToday = sameDay(day, today);
          const allDayEvs = getEventsForDay(day).filter((e) => e.all_day);
          return (
            <div key={i} className="flex-1 border-l border-slate-100 min-w-0">
              <div className={cn("text-center py-3 px-1", isToday && "bg-[#050040]/4")}>
                <p className={cn("text-xs font-semibold uppercase tracking-wide", isToday ? "text-[#050040]" : "text-slate-400")}>
                  {DAYS_SHORT[(day.getDay() + 6) % 7]}
                </p>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-bold",
                  isToday ? "bg-[#050040] text-white" : "text-slate-700",
                )}>
                  {day.getDate()}
                </div>
              </div>
              {allDayEvs.length > 0 && (
                <div className="px-1 pb-1 space-y-0.5">
                  {allDayEvs.map((ev) => (
                    <button
                      key={`${ev.id}-${ev.start_at}`}
                      onClick={() => onEventClick(ev)}
                      className="w-full text-left text-xs font-medium text-white px-1.5 py-0.5 rounded truncate flex items-center gap-1"
                      style={{ backgroundColor: ev.color }}
                    >
                      {ev.recurrence_freq && <Repeat className="w-2.5 h-2.5 shrink-0 opacity-80" />}
                      <span className="truncate">{ev.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrollable time area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ height: HOUR_H * 24 }}>
          {/* Hour labels */}
          <div className="w-14 shrink-0 relative">
            {HOURS.map((h) => (
              <div key={h} className="absolute left-0 right-0 flex items-start justify-end pr-2"
                style={{ top: h * HOUR_H, height: HOUR_H }}>
                <span className="text-[10px] text-slate-400 -mt-2">{String(h).padStart(2,"0")}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, di) => {
            const isToday = sameDay(day, today);
            const dayEvs  = layoutDay(getEventsForDay(day));
            return (
              <div key={di} className="flex-1 border-l border-slate-100 relative min-w-0" style={{ height: HOUR_H * 24 }}>
                {/* Hour grid lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-slate-100 cursor-pointer hover:bg-slate-50/60 transition-colors"
                    style={{ top: h * HOUR_H, height: HOUR_H }}
                    onClick={() => onSlotClick(day, h)}
                  >
                    {/* half-hour line */}
                    <div className="absolute left-0 right-0 border-t border-slate-50" style={{ top: HOUR_H / 2 }} />
                  </div>
                ))}

                {/* Current time line */}
                {isThisWeek && isToday && (
                  <div className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
                    style={{ top: nowTop }}>
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                    <div className="flex-1 h-0.5 bg-red-500" />
                  </div>
                )}

                {/* Events */}
                {dayEvs.map((ev) => {
                  const s = new Date(ev.start_at);
                  const e = ev.end_at ? new Date(ev.end_at) : new Date(s.getTime() + 3600000);
                  const topPct  = ((s.getHours() * 60 + s.getMinutes()) / 60) * HOUR_H;
                  const heightPx = Math.max(28, ((e.getTime() - s.getTime()) / 3600000) * HOUR_H);
                  const widthPct = (1 / ev.cols) * 100;
                  const leftPct  = (ev.col / ev.cols) * 100;
                  return (
                    <button
                      key={`${ev.id}-${ev.start_at}`}
                      onClick={(e2) => { e2.stopPropagation(); onEventClick(ev); }}
                      className="absolute z-10 rounded-lg px-1.5 py-1 text-left overflow-hidden text-white hover:brightness-90 transition-all"
                      style={{
                        top:    topPct,
                        height: heightPx,
                        left:   `calc(${leftPct}% + 2px)`,
                        width:  `calc(${widthPct}% - 4px)`,
                        backgroundColor: ev.color,
                      }}
                    >
                      <div className="flex items-center gap-1">
                        {ev.recurrence_freq && <Repeat className="w-2.5 h-2.5 shrink-0 opacity-80" />}
                        <p className="text-[10px] font-semibold leading-tight truncate">{ev.title}</p>
                      </div>
                      {heightPx >= 40 && (
                        <p className="text-[9px] opacity-80 leading-tight mt-0.5">
                          {fmtTime(ev.start_at)}{ev.end_at ? ` – ${fmtTime(ev.end_at)}` : ""}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── MonthView ──────────────────────────────────────────────────────────────────
interface MonthViewProps {
  year:          number;
  month:         number;
  today:         Date;
  events:        CalEvent[];
  draggingId:    string | null;
  dragOverDate:  string | null;
  onDayClick:    (day: Date) => void;
  onEventDown:   (e: React.MouseEvent, ev: CalEvent) => void;
}
function MonthView({ year, month, today, events, draggingId, dragOverDate, onDayClick, onEventDown }: MonthViewProps) {
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const firstDayRaw  = new Date(year, month, 1).getDay();
  const startOffset  = (firstDayRaw + 6) % 7;
  const cells: (number | null)[] = Array.from({ length: startOffset + daysInMonth }, (_, i) =>
    i < startOffset ? null : i - startOffset + 1,
  );
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const key = isoDate(new Date(ev.start_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  return (
    <div className="flex flex-col flex-1 min-h-0 select-none">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 shrink-0 border-b border-slate-100">
        {DAYS_LONG.map((d, i) => (
          <div key={d} className={cn("text-center py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide", i >= 5 && "text-slate-300")}>
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{DAYS_SHORT[i]}</span>
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="flex-1 grid grid-cols-7 gap-px bg-slate-100" style={{ gridAutoRows: "1fr" }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="bg-slate-50 opacity-0 pointer-events-none" />;

          const date       = new Date(year, month, day);
          const dateKey    = isoDate(date);
          const isToday    = sameDay(date, today);
          const isWeekend  = idx % 7 >= 5;
          const dayEvents  = eventsByDate.get(dateKey) ?? [];
          const isDragOver = dragOverDate === dateKey;

          return (
            <div
              key={idx}
              data-date={dateKey}
              onClick={() => onDayClick(date)}
              className={cn(
                "bg-white p-1.5 cursor-pointer flex flex-col transition-colors group",
                isToday && "bg-[#050040]/4",
                isWeekend && !isToday && "bg-slate-50/60",
                isDragOver && "bg-[#050040]/10 ring-2 ring-[#050040]/30 ring-inset",
                "hover:bg-slate-50",
              )}
            >
              <div className="flex items-center justify-between mb-1 shrink-0">
                <span className={cn(
                  "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full",
                  isToday ? "bg-[#050040] text-white" : isWeekend ? "text-slate-400" : "text-slate-600",
                )}>{day}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDayClick(date); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-200"
                >
                  <Plus className="w-3 h-3 text-slate-500" />
                </button>
              </div>

              <div className="flex-1 space-y-0.5 overflow-hidden min-h-0">
                {dayEvents.slice(0, 3).map((ev) => {
                  const isRec = !!ev.recurrence_freq;
                  return (
                    <div
                      key={`${ev.id}-${ev.start_at}`}
                      onMouseDown={(e) => { e.stopPropagation(); onEventDown(e, ev); }}
                      className={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium text-white truncate transition-opacity",
                        isRec ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
                        draggingId === ev.id && !isRec && "opacity-40",
                      )}
                      style={{ backgroundColor: ev.color }}
                    >
                      {isRec && <Repeat className="w-2.5 h-2.5 shrink-0 opacity-80" />}
                      {!ev.all_day && (
                        <span className="shrink-0 opacity-80">{fmtTime(ev.start_at)}</span>
                      )}
                      <span className="truncate">{ev.title}</span>
                      {!isRec && <GripVertical className="w-2.5 h-2.5 shrink-0 opacity-50 hidden sm:block" />}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <p className="text-[10px] text-slate-400 pl-1.5 font-medium">+{dayEvents.length - 3} más</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ShareModal ────────────────────────────────────────────────────────────────
function ShareModal({ onClose }: { onClose: () => void }) {
  const [token,       setToken]       = React.useState<string | null>(null);
  const [loadingTok,  setLoadingTok]  = React.useState(true);
  const [fetchError,  setFetchError]  = React.useState<string | null>(null);
  const [copiedShare, setCopiedShare] = React.useState(false);
  const [copiedIcal,  setCopiedIcal]  = React.useState(false);
  const [resetting,   setResetting]   = React.useState(false);

  React.useEffect(() => {
    fetch("/api/meetcalendar/share")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { token: string }) => setToken(d.token))
      .catch((e: Error) => setFetchError(e.message))
      .finally(() => setLoadingTok(false));
  }, []);

  const origin   = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = token ? `${origin}/calendar/${token}` : "";
  const icalUrl  = token ? `${origin}/api/meetcalendar/ical/${token}` : "";
  const gcalUrl  = icalUrl
    ? `https://www.google.com/calendar/render?cid=${encodeURIComponent(icalUrl.replace(/^https?/, "webcal"))}`
    : "#";

  async function copy(text: string, set: (v: boolean) => void) {
    await navigator.clipboard.writeText(text);
    set(true); setTimeout(() => set(false), 2000);
  }

  async function reset() {
    setResetting(true);
    try {
      const r = await fetch("/api/meetcalendar/share", { method: "DELETE" });
      if (r.ok) { const d = await r.json(); setToken(d.token); }
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        style={{ animation: "mcalOverlay 0.18s ease both" }}
        onClick={onClose}
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md"
        style={{ animation: "mcalModal 0.22s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#050040]/8 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-[#050040]" />
            </div>
            <h2 className="text-base font-semibold text-slate-800">Compartir calendario</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {loadingTok ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="w-5 h-5 text-slate-300 animate-spin" />
            </div>
          ) : fetchError ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-red-600 mb-1">No se pudo generar el enlace</p>
              <p className="text-xs text-slate-400">Asegúrate de haber ejecutado la migración SQL en Supabase:</p>
              <pre className="mt-3 text-left bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 overflow-x-auto">
                {`ALTER TABLE users\nADD COLUMN IF NOT EXISTS\ncalendar_share_token TEXT UNIQUE;`}
              </pre>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Share URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  <Link2 className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />Enlace de vista pública
                </label>
                <div className="flex gap-2">
                  <input readOnly value={shareUrl}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 outline-none truncate" />
                  <button
                    onClick={() => copy(shareUrl, setCopiedShare)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all shrink-0",
                      copiedShare
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    {copiedShare ? <><Check className="w-3.5 h-3.5" />Copiado</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">Cualquiera con este enlace puede ver tu calendario</p>
              </div>

              {/* iCal URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  <RefreshCw className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />URL de suscripción iCal
                </label>
                <div className="flex gap-2">
                  <input readOnly value={icalUrl}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 outline-none truncate" />
                  <button
                    onClick={() => copy(icalUrl, setCopiedIcal)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all shrink-0",
                      copiedIcal
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    {copiedIcal ? <><Check className="w-3.5 h-3.5" />Copiado</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">Pega esta URL en cualquier app para suscribirte</p>
              </div>

              {/* Quick subscribe */}
              <div className="flex flex-col sm:flex-row gap-2">
                <a href={gcalUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:border-[#1A73E8]/40 hover:text-[#1A73E8] transition-all">
                  <SiGooglecalendar className="w-4 h-4 text-[#1A73E8]" />
                  Google Calendar
                  <ExternalLink className="w-3 h-3 opacity-40" />
                </a>
                <a href={icalUrl} download
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                  <SiApple className="w-4 h-4" />Descargar .ics
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loadingTok && !fetchError && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <button onClick={reset} disabled={resetting}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50">
              {resetting ? "Regenerando…" : "Regenerar enlace"}
            </button>
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#050040] text-white text-xs font-semibold hover:bg-[#050040]/90 transition-colors">
              Listo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MeetCalendarView ───────────────────────────────────────────────────────────
export default function MeetCalendarView() {
  const { addNotification } = useNotifications();
  const today = React.useMemo(() => new Date(), []);

  const [view,        setView]        = React.useState<CalView>("month");
  const [currentDate, setCurrentDate] = React.useState(() => new Date(today));
  const [events,      setEvents]      = React.useState<CalEvent[]>([]);
  const [loading,     setLoading]     = React.useState(true);

  // Event modal
  const [modalOpen,    setModalOpen]    = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<CalEvent | null>(null);
  const [modalDefs,    setModalDefs]    = React.useState<EventFormData>(() => formDefaults("meeting"));

  // Drag state (also tracks pointer movement to distinguish click vs drag)
  const [draggingId,   setDraggingId]   = React.useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = React.useState<string | null>(null);
  const dragRef = React.useRef<{
    event: CalEvent | null; startDate: string; isDragging: boolean;
    startX: number; startY: number; moved: boolean;
  }>({ event: null, startDate: "", isDragging: false, startX: 0, startY: 0, moved: false });

  // Latest openEdit closure for use inside window event handlers
  const openEditRef = React.useRef<(ev: CalEvent) => void>(() => {});

  const [shareOpen, setShareOpen] = React.useState(false);

  // ── Load events ──────────────────────────────────────────────────────────────
  React.useEffect(() => { loadEvents(); }, [view, currentDate]);

  async function loadEvents() {
    setLoading(true);
    const { start, end } = getViewRange(view, currentDate);
    try {
      const res = await fetch(`/api/meetcalendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Browser & email notifications ───────────────────────────────────────────
  const notifTimers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  React.useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  React.useEffect(() => {
    notifTimers.current.forEach(clearTimeout);
    notifTimers.current = [];

    const now = Date.now();
    events.forEach((ev) => {
      if (!ev.notify_email && ev.notify_minutes === 15) return;
      const notifyAt = new Date(ev.start_at).getTime() - ev.notify_minutes * 60 * 1000;
      const delay    = notifyAt - now;
      if (delay <= 0 || delay > 24 * 3600 * 1000) return;

      const t = setTimeout(() => {
        if (Notification.permission === "granted") {
          new Notification(`⏰ ${ev.title}`, {
            body: `Comienza en ${ev.notify_minutes} min${ev.location ? ` · ${ev.location}` : ""}`,
            icon: "/favicon.ico",
          });
        }
        if (ev.notify_email) {
          fetch(`/api/meetcalendar/events/${ev.id}`, { method: "POST" });
        }
      }, delay);
      notifTimers.current.push(t);
    });

    return () => notifTimers.current.forEach(clearTimeout);
  }, [events]);

  // ── Drag & drop / click on month view ───────────────────────────────────────
  // - mousedown on event chip → start tracking
  // - if pointer moves > 5px → drag (rearrange)
  // - if pointer barely moves → treat as click → open edit form
  React.useEffect(() => {
    const MOVE_THRESHOLD = 5;

    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current.isDragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (!dragRef.current.moved && Math.hypot(dx, dy) > MOVE_THRESHOLD) {
        dragRef.current.moved = true;
        if (dragRef.current.event) setDraggingId(dragRef.current.event.id);
      }
      if (!dragRef.current.moved) return;
      const el  = document.elementFromPoint(e.clientX, e.clientY);
      const day = (el?.closest("[data-date]") as HTMLElement | null)?.dataset.date ?? null;
      setDragOverDate(day);
    }

    async function onMouseUp(e: MouseEvent) {
      if (!dragRef.current.isDragging) return;
      dragRef.current.isDragging = false;
      setDraggingId(null);

      // Click without significant movement → open the editor
      if (!dragRef.current.moved) {
        setDragOverDate(null);
        const ev = dragRef.current.event;
        if (ev) openEditRef.current(ev);
        return;
      }

      const el      = document.elementFromPoint(e.clientX, e.clientY);
      const newDate = (el?.closest("[data-date]") as HTMLElement | null)?.dataset.date;
      const { event, startDate } = dragRef.current;
      setDragOverDate(null);

      if (!newDate || !event || newDate === startDate) return;

      // Recurring events cannot be moved by drag — would shift the whole series
      if (event.recurrence_freq) return;

      const oldStart = new Date(event.start_at);
      const [ny, nm, nd] = newDate.split("-").map(Number);
      const newStart = new Date(oldStart);
      newStart.setFullYear(ny, nm - 1, nd);

      const delta  = newStart.getTime() - oldStart.getTime();
      const newEnd = event.end_at ? new Date(new Date(event.end_at).getTime() + delta).toISOString() : null;

      // Optimistic update
      setEvents((prev) => prev.map((ev) =>
        ev.id === event.id
          ? { ...ev, start_at: newStart.toISOString(), end_at: newEnd }
          : ev,
      ));

      await fetch(`/api/meetcalendar/events/${event.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ start_at: newStart.toISOString(), end_at: newEnd }),
      });
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };
  }, []);

  function handleEventMouseDown(e: React.MouseEvent, ev: CalEvent) {
    e.preventDefault();
    dragRef.current = {
      event:      ev,
      startDate:  isoDate(new Date(ev.start_at)),
      isDragging: true,
      startX:     e.clientX,
      startY:     e.clientY,
      moved:      false,
    };
  }

  // ── Animation state ──────────────────────────────────────────────────────────
  const [calAnimKey, setCalAnimKey] = React.useState(0);
  const navDirRef = React.useRef<"fwd" | "back" | "fade">("fade");

  // ── Navigation ───────────────────────────────────────────────────────────────
  function navigate(dir: -1 | 1) {
    navDirRef.current = dir === 1 ? "fwd" : "back";
    setCalAnimKey((k) => k + 1);
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  }

  function switchView(v: CalView) {
    navDirRef.current = "fade";
    setCalAnimKey((k) => k + 1);
    setView(v);
  }

  function headerTitle(): string {
    if (view === "month") return `${MONTHS_ES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (view === "week") {
      const ws = startOfWeekMon(currentDate);
      const we = addDays(ws, 6);
      if (ws.getMonth() === we.getMonth())
        return `${ws.getDate()}–${we.getDate()} ${MONTHS_ES[ws.getMonth()]} ${ws.getFullYear()}`;
      return `${ws.getDate()} ${MONTHS_ES[ws.getMonth()]} – ${we.getDate()} ${MONTHS_ES[we.getMonth()]} ${we.getFullYear()}`;
    }
    return fmtDateLong(currentDate);
  }

  // ── Event CRUD ───────────────────────────────────────────────────────────────
  async function createEvent(payload: Omit<CalEvent, "id" | "google_event_id">) {
    const res = await fetch("/api/meetcalendar/events", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      // Recurring events expand into multiple instances on the server, so reload
      if (data.event?.recurrence_freq) await loadEvents();
      else setEvents((prev) => [...prev, data.event]);
      addNotification({ title: "Evento creado", description: `El evento "${data.event.title}" se creó correctamente`, type: "event" });
    }
    closeModal();
  }

  async function updateEvent(id: string, payload: Omit<CalEvent, "id" | "google_event_id">) {
    const res = await fetch(`/api/meetcalendar/events/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      // Refetch if the event is (now or was) recurring, so all instances refresh
      const wasRecurring = events.some((ev) => ev.id === id && !!ev.recurrence_freq);
      if (data.event?.recurrence_freq || wasRecurring) await loadEvents();
      else setEvents((prev) => prev.map((ev) => ev.id === id ? data.event : ev));
    }
    closeModal();
  }

  async function deleteEvent(id: string) {
    await fetch(`/api/meetcalendar/events/${id}`, { method: "DELETE" });
    // Deleting a series removes every instance, so just refilter
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
    closeModal();
  }

  // ── Modal helpers ────────────────────────────────────────────────────────────
  function openNew(type: EventType, day?: Date) {
    setEditingEvent(null);
    setModalDefs(formDefaults(type, day));
    setModalOpen(true);
  }
  function openEdit(ev: CalEvent) {
    setEditingEvent(ev);
    setModalDefs(eventToForm(ev));
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setEditingEvent(null);
  }

  // Keep the latest openEdit in a ref for the global mouseup handler
  openEditRef.current = openEdit;

  // ── Day click (month view) — opens the create form directly ──────────────────
  function handleDayClick(date: Date) {
    const d = new Date(date);
    const now = new Date();
    if (sameDay(d, now)) {
      // Pick the next 30-minute slot
      const mins = Math.ceil((now.getMinutes() + 1) / 30) * 30;
      d.setHours(now.getHours(), 0, 0, 0);
      d.setMinutes(mins);
    } else {
      d.setHours(9, 0, 0, 0);
    }
    openNew("meeting", d);
  }

  // ── Slot click (week/day view) ────────────────────────────────────────────────
  function handleSlotClick(date: Date, hour: number) {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    openNew("meeting", d);
  }

  // ── Week days ────────────────────────────────────────────────────────────────
  const weekDays = React.useMemo(() => {
    const ws = startOfWeekMon(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [currentDate]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const calAnim =
    navDirRef.current === "fwd"  ? "mcalFwd  0.24s cubic-bezier(0.4,0,0.2,1) both" :
    navDirRef.current === "back" ? "mcalBack 0.24s cubic-bezier(0.4,0,0.2,1) both" :
                                   "mcalFade 0.2s  cubic-bezier(0.4,0,0.2,1) both";

  return (
    <div
      className="flex flex-col bg-white rounded-2xl border border-slate-100 overflow-hidden"
      style={{ height: "calc(100vh - 7rem)" }}
    >
      <style>{`
        @keyframes mcalFwd  { from { opacity:0; transform:translateX(18px) } to { opacity:1; transform:translateX(0) } }
        @keyframes mcalBack { from { opacity:0; transform:translateX(-18px)} to { opacity:1; transform:translateX(0) } }
        @keyframes mcalFade { from { opacity:0; transform:scale(0.985)     } to { opacity:1; transform:scale(1)     } }
        @keyframes mcalModal{ from { opacity:0; transform:scale(0.94) translateY(12px) } to { opacity:1; transform:scale(1) translateY(0) } }
        @keyframes mcalPanel{ from { opacity:0; transform:translateX(100%) } to { opacity:1; transform:translateX(0) } }
        @keyframes mcalOverlay{ from { opacity:0 } to { opacity:1 } }
      `}</style>
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0 gap-3 flex-wrap">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(new Date(today))}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
          >Hoy</button>
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <button onClick={() => navigate(1)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
          <h2 className="text-base font-bold text-slate-800 min-w-[160px]">{headerTitle()}</h2>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            {(["month","week","day"] as CalView[]).map((v) => (
              <button
                key={v}
                onClick={() => switchView(v)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold transition-colors capitalize",
                  view === v ? "bg-[#050040] text-white" : "text-slate-500 hover:bg-slate-50",
                )}
              >
                {{month:"Mes",week:"Semana",day:"Día"}[v]}
              </button>
            ))}
          </div>

          {/* Share */}
          <button
            onClick={() => setShareOpen(true)}
            title="Compartir calendario"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-[#050040]" />
            <span className="hidden sm:inline">Compartir</span>
          </button>

          {/* New event button */}
          <button
            onClick={() => openNew("meeting", currentDate)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#050040] text-white text-xs font-semibold hover:bg-[#050040]/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nuevo</span>
          </button>
        </div>
      </div>

      {/* ── Calendar body ── */}
      <div key={calAnimKey} className="flex-1 min-h-0 flex flex-col" style={{ animation: calAnim }}>
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : view === "month" ? (
          <MonthView
            year={currentDate.getFullYear()}
            month={currentDate.getMonth()}
            today={today}
            events={events}
            draggingId={draggingId}
            dragOverDate={dragOverDate}
            onDayClick={handleDayClick}
            onEventDown={handleEventMouseDown}
          />
        ) : view === "week" ? (
          <TimeGrid
            days={weekDays}
            events={events}
            today={today}
            onSlotClick={handleSlotClick}
            onEventClick={openEdit}
          />
        ) : (
          <TimeGrid
            days={[currentDate]}
            events={events}
            today={today}
            onSlotClick={handleSlotClick}
            onEventClick={openEdit}
          />
        )}
      </div>


      {/* ── Event Modal ── */}
      {modalOpen && (
        <EventModal
          editing={editingEvent}
          defaults={modalDefs}
          onSave={async (payload) => {
            if (editingEvent) await updateEvent(editingEvent.id, payload);
            else await createEvent(payload);
          }}
          onDelete={async () => {
            if (editingEvent) await deleteEvent(editingEvent.id);
          }}
          onClose={closeModal}
        />
      )}

      {/* ── Share Modal ── */}
      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}
    </div>
  );
}
