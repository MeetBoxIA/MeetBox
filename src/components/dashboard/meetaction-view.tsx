"use client";
/**
 * MeetAction — Wizard de 4 pasos.
 * Izquierda: stepper con pasos completados como contexto.
 * Derecha: contenido del paso actual, a pantalla completa.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, XCircle, AlertTriangle, Sparkles,
  Edit3, Check, X, RefreshCw, Play, ArrowLeft, ArrowRight,
  Users, Zap, Calendar, BookOpen, BarChart3,
  ExternalLink, Search, Eye,
  Cpu, ChevronDown, DoorOpen, Mic, CalendarCheck,
  ClipboardList, History, FileText, Bell, Layers,
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { SiJira, SiSlack, SiNotion } from "react-icons/si";
import { TbBrandTeams } from "react-icons/tb";

// ── Types ──────────────────────────────────────────────────────────────────────
type ActionStatus  = "pending" | "approved" | "rejected" | "executing" | "executed" | "failed";
type ActionType    = "task" | "decision" | "risk" | "next_step" | "event" | "note";
type Destination   = "jira" | "slack" | "notion" | "teams" | "meetbook";
type Priority      = "low" | "medium" | "high" | "critical";
type SessionStatus = "processing" | "pending_review" | "approved" | "executed" | "partial" | "rejected";
type WizardStep    = 0 | 1 | 2 | 3 | 4;
type Mode          = "summary" | "actions" | "reminders" | "full";

interface SessionReminder { id: string; title: string; source: "ai" | "manual"; deadline: string | null; completed: boolean; session_id: string | null; }

interface Room        { id: string; name: string; color: string; emoji: string; }
interface RoomMember  { id: string; name: string; email: string; }
interface ActionItem  {
  id: string; type: ActionType; destination: Destination; status: ActionStatus;
  title: string; description: string; assignee_name: string; assignee_email: string;
  priority: Priority; external_url?: string;
}
interface ApiSession  {
  id: string; meeting_name: string; meeting_date: string; duration_seconds: number;
  status: SessionStatus; summary_ai: string; room_id: string | null;
  decisions_count: number; tasks_count: number; risks_count: number; next_steps_count: number;
  people_mentioned: string[]; calendar_match_pct: number | null;
  calendar_events: { id: string; title: string; start_at: string } | null;
  rooms: { id: string; name: string; color: string; emoji: string } | null;
}
interface NearbyEvent { id: string; title: string; start_at: string; }
interface HistoryEntry {
  id: string; title: string; destination: Destination;
  status: "success" | "failed"; external_url: string;
  meeting_name: string; executed_at: string;
}

// ── Metadata ───────────────────────────────────────────────────────────────────
const DEST_META: Record<Destination, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  jira:         { label: "Jira",         Icon: SiJira,       color: "#0052CC", bg: "#EFF4FF" },
  slack:        { label: "Slack",        Icon: SiSlack,      color: "#4A154B", bg: "#F5F0F8" },
  notion:       { label: "Notion",       Icon: SiNotion,     color: "#191919", bg: "#F5F5F5" },
  teams:        { label: "Teams",        Icon: TbBrandTeams, color: "#5059C9", bg: "#EEEEFF" },
  meetbook:     { label: "MeetBook",     Icon: BookOpen,     color: "#7c3aed", bg: "#F3EEFF" },
};
const TYPE_META: Record<ActionType, { label: string; color: string }> = {
  task:      { label: "Tarea",        color: "#050040" },
  decision:  { label: "Decisión",     color: "#059669" },
  risk:      { label: "Riesgo",       color: "#dc2626" },
  next_step: { label: "Próximo paso", color: "#d97706" },
  event:     { label: "Evento",       color: "#0891b2" },
  note:      { label: "Nota",         color: "#7c3aed" },
};
const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string }> = {
  low:      { label: "Baja",    color: "#64748b", bg: "#f1f5f9" },
  medium:   { label: "Media",   color: "#d97706", bg: "#fef3c7" },
  high:     { label: "Alta",    color: "#ea580c", bg: "#fff7ed" },
  critical: { label: "Crítica", color: "#dc2626", bg: "#fef2f2" },
};
const STATUS_META: Record<SessionStatus, { label: string; dot: string }> = {
  processing:     { label: "Procesando",  dot: "#d97706" },
  pending_review: { label: "Sin revisar", dot: "#050040" },
  approved:       { label: "Aprobada",    dot: "#059669" },
  executed:       { label: "Ejecutada",   dot: "#059669" },
  partial:        { label: "Parcial",     dot: "#ea580c" },
  rejected:       { label: "Rechazada",   dot: "#dc2626" },
};

// ── Mode selector ──────────────────────────────────────────────────────────────
const MODE_OPTIONS: { id: Mode; icon: React.ElementType; color: string; bg: string; title: string; desc: string; badge?: string }[] = [
  { id: "summary",   icon: FileText, color: "#0891b2", bg: "#f0f9ff", title: "Solo resumen",               desc: "La IA resume los puntos clave, decisiones y próximos pasos.",              badge: "Rápido"    },
  { id: "actions",   icon: Zap,      color: "#050040", bg: "#eef0ff", title: "Acciones con integraciones", desc: "Genera tareas y las distribuye a Jira, Slack, Notion y más.",              badge: "Completo"  },
  { id: "reminders", icon: Bell,     color: "#d97706", bg: "#fef9ee", title: "Generar recordatorios",      desc: "Detecta tareas fantasma de la reunión y las añade a tus recordatorios."                        },
  { id: "full",      icon: Layers,   color: "#7c3aed", bg: "#f5f3ff", title: "Flujo completo",             desc: "Resumen + acciones en integraciones + recordatorios. Todo en uno.",        badge: "⭐ Todo"   },
];

function ModeSelector({ onSelect }: { onSelect: (m: Mode) => void }) {
  return (
    <div className="flex h-full items-center justify-center bg-slate-50 px-6 py-10 overflow-y-auto">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#050040] flex items-center justify-center mx-auto mb-4 shadow-md">
            <Cpu className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">¿Qué quieres hacer hoy?</h1>
          <p className="text-base text-slate-400 mt-2">Elige el tipo de análisis para tu reunión</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <motion.button
                key={opt.id}
                onClick={() => onSelect(opt.id)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02, y: -3, boxShadow: "0 8px 24px -4px rgba(0,0,0,0.10)" }}
                whileTap={{ scale: 0.98 }}
                transition={{ delay: MODE_OPTIONS.findIndex((o) => o.id === opt.id) * 0.06, duration: 0.3 }}
                className="relative text-left p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-slate-300 group"
              >
                {opt.badge && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: opt.bg, color: opt.color }}>
                    {opt.badge}
                  </span>
                )}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: opt.bg }}>
                  <Icon className="w-6 h-6" style={{ color: opt.color }} />
                </div>
                <h3 className="text-base font-bold text-slate-800 group-hover:text-[#050040] transition-colors">{opt.title}</h3>
                <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{opt.desc}</p>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── SwipeReminderCard ──────────────────────────────────────────────────────────
const SWIPE_THRESHOLD = 80;

function SwipeReminderCard({ item, decision, onDecide }: {
  item: ActionItem;
  decision: "accepted" | "skipped" | null;
  onDecide: (id: string, d: "accepted" | "skipped") => void;
}) {
  const x = useMotionValue(0);
  const acceptOpacity  = useTransform(x, [0, SWIPE_THRESHOLD],   [0, 1]);
  const skipOpacity    = useTransform(x, [-SWIPE_THRESHOLD, 0],  [1, 0]);
  const bgColor        = useTransform(x, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], ["#fee2e2", "#ffffff", "#dcfce7"]);

  const TYPE_META_LOCAL: Record<string, { label: string; color: string; bg: string }> = {
    task:      { label: "Tarea",        color: "#0891b2", bg: "#f0f9ff" },
    decision:  { label: "Decisión",     color: "#7c3aed", bg: "#f5f3ff" },
    risk:      { label: "Riesgo",       color: "#dc2626", bg: "#fef2f2" },
    next_step: { label: "Próx. paso",   color: "#d97706", bg: "#fef9ee" },
    event:     { label: "Recordatorio", color: "#d97706", bg: "#fef9ee" },
    note:      { label: "Nota",         color: "#6b7280", bg: "#f9fafb" },
  };
  const meta = TYPE_META_LOCAL[item.type] ?? TYPE_META_LOCAL.note;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Accept background */}
      <motion.div style={{ opacity: acceptOpacity }}
        className="absolute inset-0 bg-emerald-100 rounded-2xl flex items-center justify-end pr-6 pointer-events-none">
        <div className="flex flex-col items-center gap-1">
          <Bell className="w-6 h-6 text-emerald-600" />
          <span className="text-xs font-bold text-emerald-600">Recordatorio</span>
        </div>
      </motion.div>
      {/* Skip background */}
      <motion.div style={{ opacity: skipOpacity }}
        className="absolute inset-0 bg-red-100 rounded-2xl flex items-center justify-start pl-6 pointer-events-none">
        <div className="flex flex-col items-center gap-1">
          <X className="w-6 h-6 text-red-500" />
          <span className="text-xs font-bold text-red-500">Omitir</span>
        </div>
      </motion.div>

      <motion.div
        style={{ x, backgroundColor: bgColor }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        onDragEnd={(_, info) => {
          if (info.offset.x > SWIPE_THRESHOLD) onDecide(item.id, "accepted");
          else if (info.offset.x < -SWIPE_THRESHOLD) onDecide(item.id, "skipped");
        }}
        className={cn(
          "relative border-2 rounded-2xl p-4 cursor-grab active:cursor-grabbing select-none",
          decision === "accepted" ? "border-emerald-400 bg-emerald-50"
          : decision === "skipped" ? "border-slate-200 bg-slate-50 opacity-50"
          : "border-slate-200 bg-white",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: meta.bg, color: meta.color }}>{meta.label}</span>
              {decision === "accepted" && <span className="text-[10px] font-bold text-emerald-600">✓ Recordatorio</span>}
            </div>
            <p className={cn("text-sm font-semibold text-slate-800", decision === "skipped" && "line-through text-slate-400")}>
              {item.title}
            </p>
            {item.description && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
            )}
          </div>
          {/* Quick buttons */}
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => onDecide(item.id, "skipped")}
              className={cn("w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                decision === "skipped" ? "bg-red-100 text-red-500" : "bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-500")}>
              <X className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDecide(item.id, "accepted")}
              className={cn("w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                decision === "accepted" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600")}>
              <Bell className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Session selector (same visual style as ModeSelector) ──────────────────────
function SessionSelector({
  sessions, loading, selectedId, mode, canProceed,
  onSelect, onBack, onNext,
}: {
  sessions: ApiSession[];
  loading: boolean;
  selectedId: string | null;
  mode: Mode;
  canProceed: boolean;
  onSelect: (id: string) => void;
  onBack:  () => void;
  onNext:  () => void;
}) {
  const [showAll, setShowAll] = React.useState(false);
  const visible = showAll ? sessions : sessions.slice(0, 4);

  const question =
    mode === "summary"   ? "¿Qué reunión quieres resumir?"            :
    mode === "reminders" ? "¿De qué reunión extraer recordatorios?"    :
                           "¿Qué reunión quieres procesar?";
  const subtitle =
    mode === "summary"   ? "La IA generará un resumen ejecutivo de la reunión seleccionada." :
    mode === "reminders" ? "Se extraerán las tareas detectadas por IA y se añadirán a tus recordatorios." :
                           "Selecciona la grabación pendiente de revisión.";

  const nextLabel =
    mode === "summary" || mode === "reminders" ? "Generar" : "Siguiente";

  return (
    <div className="flex h-full overflow-y-auto bg-slate-50 px-6 py-10">
      <div className="w-full max-w-2xl mx-auto">

        {/* ── Header ── */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#050040] flex items-center justify-center mx-auto mb-4 shadow-md">
            <Mic className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{question}</h1>
          <p className="text-base text-slate-400 mt-2">{subtitle}</p>
        </div>

        {/* ── Session cards ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Mic className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-lg font-bold text-slate-600">No hay reuniones grabadas</p>
            <p className="text-sm text-slate-400 mt-1.5 max-w-xs">
              Graba una reunión con MeetBox Desktop. Las sesiones procesadas aparecerán aquí.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              {visible.map((s, idx) => {
                const st  = STATUS_META[s.status];
                const sel = s.id === selectedId;
                return (
                  <motion.button
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02, y: -3, boxShadow: "0 8px 24px -4px rgba(0,0,0,0.10)" }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ delay: idx * 0.06, duration: 0.3 }}
                    className={cn(
                      "relative text-left p-6 rounded-2xl border-2 bg-white group transition-colors",
                      sel ? "border-[#050040] shadow-md" : "border-slate-200 hover:border-slate-300",
                    )}
                  >
                    {/* Status badge */}
                    <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: st.dot + "20", color: st.dot }}>
                      {st.label}
                    </span>

                    {/* Icon */}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-2xl",
                      sel ? "bg-[#050040]/10" : "bg-slate-100",
                    )}>
                      🎙️
                    </div>

                    <h3 className={cn(
                      "text-base font-bold leading-snug line-clamp-2 group-hover:text-[#050040] transition-colors",
                      sel ? "text-[#050040]" : "text-slate-800",
                    )}>
                      {s.meeting_name}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1.5">
                      {s.meeting_date ? fmtDate(s.meeting_date) : "Sin fecha"}
                      {s.duration_seconds ? ` · ${fmtDur(s.duration_seconds)}` : ""}
                    </p>

                    {/* Stats */}
                    {(s.tasks_count > 0 || s.decisions_count > 0) && (
                      <div className="flex gap-3 mt-3">
                        {s.tasks_count > 0 && (
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {s.tasks_count} tareas
                          </span>
                        )}
                        {s.decisions_count > 0 && (
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {s.decisions_count} decisiones
                          </span>
                        )}
                      </div>
                    )}

                    {/* Selected indicator */}
                    {sel && (
                      <div className="absolute bottom-3 right-3 w-6 h-6 rounded-full bg-[#050040] flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Ver todas link */}
            {sessions.length > 4 && !showAll && (
              <div className="text-center mt-4">
                <button
                  onClick={() => setShowAll(true)}
                  className="text-sm text-slate-400 hover:text-[#050040] transition-colors inline-flex items-center gap-1.5 underline underline-offset-2"
                >
                  ver todas las reuniones ({sessions.length})
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Footer navigation ── */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-200">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />Cambiar modo
          </button>
          <motion.button
            onClick={onNext}
            disabled={!canProceed}
            whileHover={canProceed ? { scale: 1.02 } : {}}
            whileTap={canProceed ? { scale: 0.98 } : {}}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#050040] text-white text-sm font-semibold hover:bg-[#050040]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {nextLabel}
            {nextLabel === "Siguiente" ? <ArrowRight className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
function fmtDur(secs: number) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

function DestBadge({ dest }: { dest: string }) {
  const meta = DEST_META[dest as Destination];
  if (!meta) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 shrink-0">
        {dest}
      </span>
    );
  }
  const { label, Icon, color, bg } = meta;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
      style={{ backgroundColor: bg, color }}>
      <Icon className="w-3 h-3" style={{ color }} />{label}
    </span>
  );
}

// ── ActionCard ────────────────────────────────────────────────────────────────
function ActionCard({ item, onToggle, onEdit }: {
  item: ActionItem;
  onToggle: (id: string, s: "approved" | "rejected" | "pending") => void;
  onEdit:   (id: string, patch: Partial<ActionItem>) => void;
}) {
  const [editing,  setEditing]  = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [draft,    setDraft]    = React.useState(item);

  const approved = item.status === "approved";
  const rejected = item.status === "rejected";

  function save() {
    onEdit(item.id, { title: draft.title, description: draft.description, assignee_name: draft.assignee_name, priority: draft.priority, destination: draft.destination });
    setEditing(false);
  }

  return (
    <div className={cn(
      "rounded-2xl border transition-all group",
      approved ? "border-emerald-200 bg-emerald-50/50"
        : rejected ? "border-slate-100 opacity-50 bg-slate-50"
        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
    )}>
      <div className="flex items-start gap-4 p-5">
        <div className="flex flex-col gap-1.5 mt-0.5 shrink-0">
          <button onClick={() => onToggle(item.id, approved ? "pending" : "approved")}
            className={cn("w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all",
              approved ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-emerald-400 hover:bg-emerald-50")}>
            {approved && <Check className="w-4 h-4" />}
          </button>
          <button onClick={() => onToggle(item.id, rejected ? "pending" : "rejected")}
            className={cn("w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all",
              rejected ? "bg-red-400 border-red-400 text-white" : "border-slate-300 hover:border-red-300 hover:bg-red-50")}>
            {rejected && <X className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2.5">
              <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                className="w-full text-base font-semibold bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-[#050040]/40" />
              <textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                rows={2} className="w-full text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none resize-none" />
              <div className="flex gap-2 flex-wrap">
                <input value={draft.assignee_name} onChange={(e) => setDraft((d) => ({ ...d, assignee_name: e.target.value }))}
                  placeholder="Responsable" className="flex-1 min-w-0 text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none" />
                <select value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as Priority }))}
                  className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none">
                  {(["low","medium","high","critical"] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                </select>
                <select value={draft.destination} onChange={(e) => setDraft((d) => ({ ...d, destination: e.target.value as Destination }))}
                  className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none">
                  {(Object.keys(DEST_META) as Destination[]).map((d) => <option key={d} value={d}>{DEST_META[d].label}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={save} className="flex items-center gap-1.5 px-4 py-2 bg-[#050040] text-white rounded-xl text-sm font-semibold"><Check className="w-3.5 h-3.5" />Guardar</button>
                <button onClick={() => { setDraft(item); setEditing(false); }} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold"><X className="w-3.5 h-3.5" />Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className={cn("text-base font-semibold leading-snug", rejected ? "line-through text-slate-400" : "text-slate-800")}>
                  {item.title}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: TYPE_META[item.type].color + "15", color: TYPE_META[item.type].color }}>
                    {TYPE_META[item.type].label}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: PRIORITY_META[item.priority].bg, color: PRIORITY_META[item.priority].color }}>
                    {PRIORITY_META[item.priority].label}
                  </span>
                </div>
              </div>
              {expanded && item.description && (
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{item.description}</p>
              )}
              <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
                <DestBadge dest={item.destination} />
                {item.assignee_name && (
                  <span className="flex items-center gap-1.5 text-sm text-slate-500">
                    <div className="w-5 h-5 rounded-full bg-[#050040]/10 flex items-center justify-center text-[9px] font-bold text-[#050040]">
                      {item.assignee_name[0]}
                    </div>
                    {item.assignee_name}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setExpanded((e) => !e)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <ChevronDown className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")} />
            </button>
            <button onClick={() => setEditing(true)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function MeetActionView({ workspaceId }: { workspaceId?: string }) {
  const [mode,      setMode]      = React.useState<Mode | null>(null);
  const [step,      setStep]      = React.useState<WizardStep>(0);
  const [dir,       setDir]       = React.useState<"fwd" | "back">("fwd");
  const [animating, setAnimating] = React.useState(false);

  const [sessions,      setSessions]      = React.useState<ApiSession[]>([]);
  const [selectedId,    setSelectedId]    = React.useState<string | null>(null);
  const [rooms,         setRooms]         = React.useState<Room[]>([]);
  const [roomMembers,   setRoomMembers]   = React.useState<RoomMember[]>([]);
  const [matchedPeople, setMatchedPeople] = React.useState<{ person: string; member_name: string }[]>([]);
  const [unmatchedPpl,  setUnmatchedPpl]  = React.useState<string[]>([]);
  const [matchPct,      setMatchPct]      = React.useState(0);
  const [nearbyEvents,  setNearbyEvents]  = React.useState<NearbyEvent[]>([]);
  const [items,         setItems]         = React.useState<ActionItem[]>([]);
  const [selectedRoom,     setSelectedRoom]     = React.useState<Room | null>(null);
  const [selectedCalMatch, setSelectedCalMatch] = React.useState<NearbyEvent | null>(null);

  const [executing,  setExecuting]  = React.useState(false);
  const [execDone,   setExecDone]   = React.useState(false);
  const [execStep,   setExecStep]   = React.useState(0);

  const [showHistory, setShowHistory] = React.useState(false);
  const [history,     setHistory]     = React.useState<HistoryEntry[]>([]);

  const [loading,           setLoading]           = React.useState(true);
  const [itemsLoading,      setItemsLoading]      = React.useState(false);
  const [sessionReminders,  setSessionReminders]  = React.useState<SessionReminder[]>([]);
  const [filterType,   setFilterType]   = React.useState<ActionType | "all">("all");
  const [search,       setSearch]       = React.useState("");
  const [reminderDecisions, setReminderDecisions] = React.useState<Record<string, "accepted" | "skipped">>({});

  const session      = sessions.find((s) => s.id === selectedId) ?? null;
  // Integration items = items that go to real integrations (exclude stale meetcalendar)
  const integrationItems = items.filter((i) => (i.destination as string) !== "meetcalendar");
  const approved     = integrationItems.filter((i) => i.status === "approved");
  const rejected     = integrationItems.filter((i) => i.status === "rejected");
  const pending      = integrationItems.filter((i) => i.status === "pending");
  const destinations = [...new Set(approved.map((i) => i.destination))];
  const filtered     = integrationItems.filter((i) => {
    if (filterType !== "all" && i.type !== filterType) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const pendingCount = sessions.filter((s) => s.status === "pending_review" || s.status === "processing").length;

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  const loadSessions = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = workspaceId ? `?limit=50&workspaceId=${workspaceId}` : "?limit=50";
      const r = await fetch(`/api/meetaction/sessions${qs}`);
      const d = r.ok ? await r.json() : { sessions: [] };
      setSessions(d.sessions ?? []);
    } catch { setSessions([]); } finally { setLoading(false); }
  }, [workspaceId]);

  const loadHistory = React.useCallback(async () => {
    try {
      const r = await fetch("/api/meetaction/history?limit=100");
      const d = r.ok ? await r.json() : { history: [] };
      type ApiLog = { id: string; title: string; destination: Destination; status: "success" | "failed"; external_url: string | null; executed_at: string; meet_action_sessions: { meeting_name: string } | null };
      setHistory((d.history ?? []).map((h: ApiLog) => ({ id: h.id, title: h.title, destination: h.destination, status: h.status, external_url: h.external_url ?? "#", executed_at: h.executed_at, meeting_name: h.meet_action_sessions?.meeting_name ?? "Reunión" })));
    } catch { setHistory([]); }
  }, []);

  React.useEffect(() => {
    loadSessions(); loadHistory();
    fetch("/api/rooms").then((r) => r.ok ? r.json() : { rooms: [] }).then((d) => setRooms(d.rooms ?? [])).catch(() => {});
  }, [loadSessions, loadHistory]);

  React.useEffect(() => {
    // For "reminders" mode load at swipe step 1.
    // For "actions"/"full" load at step 3 (swipe step) so items are ready
    // both for the swipe review AND the subsequent integration review (step 4).
    const loadAt = mode === "reminders" ? 1 : 3;
    if (step !== loadAt || !selectedId) return;
    setItemsLoading(true);
    fetch(`/api/meetaction/sessions/${selectedId}/items`)
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d) => { setItems(d.items ?? []); setItemsLoading(false); })
      .catch(() => { setItems([]); setItemsLoading(false); });
  }, [step, selectedId, mode]);

  React.useEffect(() => {
    if (step !== 2 || !session?.meeting_date) return;
    const d = new Date(session.meeting_date);
    const s = new Date(d.getTime() - 7 * 86400_000).toISOString();
    const e = new Date(d.getTime() + 7 * 86400_000).toISOString();
    fetch(`/api/meetcalendar/events?start=${s}&end=${e}`)
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((d) => { setNearbyEvents(d.events ?? []); if (session.calendar_events && !selectedCalMatch) setSelectedCalMatch({ id: session.calendar_events.id, title: session.calendar_events.title, start_at: session.calendar_events.start_at }); })
      .catch(() => setNearbyEvents([]));
  }, [step, session?.meeting_date]); // eslint-disable-line react-hooks/exhaustive-deps

  async function selectRoom(r: Room) {
    setSelectedRoom(r); setRoomMembers([]); setMatchedPeople([]); setUnmatchedPpl([]); setMatchPct(0);
    if (!selectedId) return;
    await fetch(`/api/meetaction/sessions/${selectedId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room_id: r.id }) });
    const [mRes, aRes] = await Promise.all([fetch(`/api/rooms/${r.id}/members`), fetch(`/api/meetaction/sessions/${selectedId}/room-analysis`)]);
    const mData = mRes.ok ? await mRes.json() : { members: [] };
    const aData = aRes.ok ? await aRes.json() : { matched: [], unmatched: [], match_pct: 0 };
    setRoomMembers(mData.members ?? []); setMatchedPeople(aData.matched ?? []); setUnmatchedPpl(aData.unmatched ?? []); setMatchPct(aData.match_pct ?? 0);
  }

  async function pickCalMatch(ev: NearbyEvent) {
    setSelectedCalMatch(ev);
    if (!selectedId) return;
    await fetch(`/api/meetaction/sessions/${selectedId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ calendar_event_id: ev.id, calendar_match_pct: 85 }) });
  }

  function canProceed() {
    if (step === 0) return selectedId !== null;
    if ((mode === "actions" || mode === "full") && step === 4) return approved.length > 0;
    return true;
  }

  function navigate(next: WizardStep, direction: "fwd" | "back") {
    if (animating) return; setDir(direction); setAnimating(true);
    setTimeout(() => { setStep(next); setAnimating(false); }, 260);
  }
  async function handleExecuteSummary() {
    setExecuting(true); setExecStep(0);
    await new Promise((r) => setTimeout(r, 900));
    setExecuting(false); setExecDone(true);
  }

  async function handleSaveAndExecuteReminders() {
    setExecuting(true);
    const accepted = items.filter((i) => reminderDecisions[i.id] === "accepted");
    try {
      await Promise.all(
        accepted.map((item) =>
          fetch("/api/recordatorios", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title:      item.title,
              source:     "ai",
              deadline:   null,
              session_id: selectedId,
              room_id:    workspaceId ?? null,
            }),
          }),
        ),
      );
      setSessionReminders(
        accepted.map((i) => ({ id: i.id, title: i.title, source: "ai" as const, deadline: null, completed: false, session_id: selectedId })),
      );
    } finally {
      setExecuting(false);
      setExecDone(true);
    }
  }

  function goNext() {
    if (mode === "summary" && step === 0) { handleExecuteSummary(); return; }
    if (mode === "reminders" && step === 1) { handleSaveAndExecuteReminders(); return; }
    if ((mode === "actions" || mode === "full") && step === 4) { handleExecute(); return; }
    const maxStep = mode === "summary" ? 0 : mode === "reminders" ? 1 : 4;
    if (step < maxStep) navigate((step + 1) as WizardStep, "fwd");
  }
  function goBack() { if (step > 0) navigate((step - 1) as WizardStep, "back"); }

  async function handleExecute() {
    if (!selectedId || approved.length === 0) return;
    const totalSteps = destinations.length + 3; setExecuting(true); setExecStep(0);
    let s = 0; const tick = setInterval(() => { s = Math.min(s + 1, totalSteps - 1); setExecStep(s); }, 700);
    try {
      // Save reminders accepted in the swipe step to /api/recordatorios
      const acceptedReminderItems = items.filter((i) => reminderDecisions[i.id] === "accepted");
      if (acceptedReminderItems.length > 0) {
        await Promise.all(
          acceptedReminderItems.map((item) =>
            fetch("/api/recordatorios", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title:      item.title,
                source:     "ai",
                deadline:   null,
                session_id: selectedId,
                room_id:    workspaceId ?? null,
              }),
            }),
          ),
        );
      }
      await fetch(`/api/meetaction/sessions/${selectedId}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approve: approved.map((i) => i.id), reject: rejected.map((i) => i.id) }) });
      await fetch(`/api/meetaction/sessions/${selectedId}/execute`, { method: "POST" });
    } catch { /* en historial */ } finally {
      clearInterval(tick); setExecStep(totalSteps); setExecuting(false); setExecDone(true);
      setSessions((prev) => prev.map((x) => x.id === selectedId ? { ...x, status: "executed" } : x));
      loadHistory();
    }
  }

  function toggleItem(id: string, status: "approved" | "rejected" | "pending") {
    setItems((p) => p.map((i) => i.id === id ? { ...i, status } : i));
    void fetch(`/api/meetaction/items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  }
  function editItem(id: string, patch: Partial<ActionItem>) {
    setItems((p) => p.map((i) => i.id === id ? { ...i, ...patch } : i));
    void fetch(`/api/meetaction/items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  }
  function approveAll() {
    const ids = items.filter((i) => i.status === "pending").map((i) => i.id);
    setItems((p) => p.map((i) => i.status === "pending" ? { ...i, status: "approved" as ActionStatus } : i));
    void Promise.all(ids.map((id) => fetch(`/api/meetaction/items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "approved" }) })));
  }

  function resetWizard() {
    setMode(null); setStep(0); setSelectedId(null); setSelectedRoom(null); setSelectedCalMatch(null);
    setItems([]); setRoomMembers([]); setMatchedPeople([]); setUnmatchedPpl([]); setMatchPct(0);
    setExecDone(false); setExecStep(0); setSearch(""); setFilterType("all"); setSessionReminders([]);
    setReminderDecisions({}); loadSessions();
  }

  const historyGroups = React.useMemo(() => {
    const g = new Map<string, HistoryEntry[]>();
    for (const h of history) { const l = g.get(h.meeting_name) ?? []; l.push(h); g.set(h.meeting_name, l); }
    return [...g.entries()];
  }, [history]);

  // ─────────────────────────────────────────────────────────────────────────
  // Mode selector
  // ─────────────────────────────────────────────────────────────────────────
  if (!mode) return <ModeSelector onSelect={(m) => setMode(m)} />;

  // ─────────────────────────────────────────────────────────────────────────
  // Session selector — same visual style as ModeSelector
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 0 && !executing && !execDone) {
    return (
      <SessionSelector
        sessions={sessions}
        loading={loading}
        selectedId={selectedId}
        mode={mode}
        canProceed={selectedId !== null}
        onSelect={(id) => setSelectedId(id)}
        onBack={() => { setMode(null); setStep(0); setSelectedId(null); }}
        onNext={goNext}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Historial
  // ─────────────────────────────────────────────────────────────────────────
  if (showHistory) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-slate-50">
        <div className="bg-white border-b border-slate-100 px-7 py-5 flex items-center gap-3 shrink-0">
          <button onClick={() => setShowHistory(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div><h1 className="text-lg font-bold text-slate-800">Historial de ejecuciones</h1><p className="text-sm text-slate-400">Todo lo creado a partir de tus reuniones</p></div>
          <div className="ml-auto flex items-center gap-2 text-sm text-slate-500 bg-slate-100 rounded-xl px-3 py-2">
            <BarChart3 className="w-4 h-4" />{history.filter((h) => h.status === "success").length} / {history.length} exitosos
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-7 space-y-4">
          {history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <History className="w-12 h-12 text-slate-200 mb-3" />
              <p className="text-base text-slate-400">Aún no hay ejecuciones</p>
            </div>
          )}
          {historyGroups.map(([name, entries]) => (
            <div key={name} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 bg-slate-50 border-b border-slate-100">
                <Calendar className="w-4 h-4 text-[#050040]" />
                <p className="text-base font-semibold text-slate-700">{name}</p>
                <span className="ml-auto text-sm text-slate-400">{fmtDate(entries[0].executed_at)}</span>
              </div>
              {entries.map((e) => (
                <div key={e.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group border-b border-slate-50 last:border-0">
                  {e.status === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-400" />}
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-700 truncate">{e.title}</p></div>
                  <DestBadge dest={e.destination} />
                  {e.external_url && e.status === "success" && (
                    <a href={e.external_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl hover:bg-slate-200 text-slate-400 opacity-0 group-hover:opacity-100 transition-all">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Ejecución
  // ─────────────────────────────────────────────────────────────────────────
  if (executing || execDone) {
    // ── Summary / Reminders modes: lightweight result screen ─────────────────
    if (mode === "summary" || mode === "reminders") {
      return (
        <div className="flex h-full overflow-y-auto bg-slate-50">
          <div className="w-full flex items-center justify-center p-8">
            <div className="w-full max-w-lg">
              {executing ? (
                <div className="flex flex-col items-center justify-center py-16 gap-5">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                    className="w-12 h-12 border-4 border-slate-200 border-t-[#050040] rounded-full" />
                  <p className="text-lg font-semibold text-slate-700">
                    {mode === "summary" ? "Generando resumen…" : "Detectando recordatorios…"}
                  </p>
                </div>
              ) : mode === "summary" ? (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_40px_-8px_rgba(5,0,64,0.10)] overflow-hidden">
                  <div className="bg-gradient-to-br from-[#050040] to-indigo-600 px-8 py-7 text-white text-center">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3">
                      <FileText className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-xl font-bold">{session?.meeting_name ?? "Reunión"}</h2>
                    <p className="text-sm text-white/60 mt-1">{session?.meeting_date ? fmtDate(session.meeting_date) : ""}</p>
                  </div>
                  <div className="px-8 py-6 space-y-5">
                    {session?.summary_ai ? (
                      <p className="text-sm text-slate-600 leading-relaxed">{session.summary_ai}</p>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Sin resumen disponible para esta reunión.</p>
                    )}
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      {[
                        { n: session?.tasks_count ?? 0,      label: "Tareas"      },
                        { n: session?.decisions_count ?? 0,  label: "Decisiones"  },
                        { n: session?.next_steps_count ?? 0, label: "Próx. pasos" },
                      ].map(({ n, label }) => (
                        <div key={label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                          <p className="text-2xl font-bold text-[#050040]">{n}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                    <button onClick={resetWizard}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-[#050040] text-white rounded-xl text-sm font-semibold hover:bg-[#050040]/90 transition-colors">
                      <RefreshCw className="w-4 h-4" />Analizar otra reunión
                    </button>
                  </div>
                </div>
              ) : (
                /* Reminders result */
                <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_40px_-8px_rgba(5,0,64,0.10)] overflow-hidden">
                  <div className="bg-gradient-to-br from-amber-500 to-orange-500 px-8 py-7 text-white text-center">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3">
                      <Bell className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-xl font-bold">Recordatorios detectados</h2>
                    <p className="text-sm text-white/70 mt-1">{session?.meeting_name ?? "Reunión"}</p>
                  </div>
                  <div className="px-8 py-6">
                    {sessionReminders.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-base font-semibold text-slate-500">No se encontraron recordatorios de IA en esta reunión.</p>
                        <p className="text-sm text-slate-400 mt-1">La IA los detecta automáticamente al procesar la grabación.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 mb-4">
                        {sessionReminders.map((r) => (
                          <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
                            <Bell className="w-4 h-4 text-amber-500 shrink-0" />
                            <p className="text-sm text-slate-700 flex-1">{r.title}</p>
                            {r.deadline && (
                              <span className="text-xs text-amber-600 font-semibold">{fmtDate(r.deadline)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={resetWizard}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-[#050040] text-white rounded-xl text-sm font-semibold hover:bg-[#050040]/90 transition-colors mt-2">
                      <RefreshCw className="w-4 h-4" />Analizar otra reunión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // ── Actions / Full mode: original progress screen ─────────────────────────
    const totalSteps = destinations.length + 3;
    return (
      <div className="flex h-full overflow-y-auto bg-slate-50">
        <div className="w-full flex items-center justify-center p-8">
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_40px_-8px_rgba(5,0,64,0.10)] overflow-hidden">
              <div className="bg-[#050040] px-8 py-7 text-white text-center">
                <div className={cn("w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4", executing && "animate-pulse")}>
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold">{executing ? "Ejecutando acciones…" : "¡Todo listo!"}</h2>
                <p className="text-base text-white/60 mt-1.5">{executing ? "Enviando a las integraciones" : "Todas las acciones fueron procesadas"}</p>
                <div className="mt-5 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${(execStep / totalSteps) * 100}%` }} />
                </div>
                <p className="text-sm text-white/40 mt-1.5">{execStep} / {totalSteps} pasos</p>
              </div>
              <div className="px-8 py-5 space-y-1">
                {[
                  { label: "Transcripción completada", minStep: 1 },
                  { label: "Resumen generado",         minStep: 2 },
                  { label: "Acciones identificadas",   minStep: 3 },
                  ...destinations.map((d, i) => ({ label: `Enviando a ${DEST_META[d as Destination]?.label ?? d}`, minStep: 4 + i })),
                ].map(({ label, minStep }) => {
                  const s = execStep > minStep ? "done" : execStep === minStep ? "running" : "pending";
                  return (
                    <div key={label} className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                        {s === "done"    && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                        {s === "running" && <RefreshCw    className="w-6 h-6 text-blue-500 animate-spin" />}
                        {s === "pending" && <div className="w-6 h-6 rounded-full border-2 border-slate-200" />}
                      </div>
                      <span className={cn("text-sm font-medium flex-1", s === "done" ? "text-slate-800" : s === "running" ? "text-blue-600" : "text-slate-400")}>{label}</span>
                      {s === "done"    && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Completado</span>}
                      {s === "running" && <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2.5 py-1 rounded-full animate-pulse">En progreso</span>}
                    </div>
                  );
                })}
              </div>
              {execDone && (
                <div className="px-8 pb-7">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[{ n: approved.length, label: "Acciones" }, { n: destinations.length, label: "Integraciones" }, { n: [...new Set(approved.map((i) => i.assignee_name).filter(Boolean))].length, label: "Personas" }].map(({ n, label }) => (
                        <div key={label} className="bg-white rounded-xl p-4 text-center border border-emerald-100">
                          <p className="text-3xl font-bold text-[#050040]">{n}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setShowHistory(true)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors">
                        <Eye className="w-4 h-4" />Ver historial
                      </button>
                      <button onClick={resetWizard} className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                        <RefreshCw className="w-4 h-4" />Nueva reunión
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Wizard principal
  // ─────────────────────────────────────────────────────────────────────────

  // ── Progress dots helper ──────────────────────────────────────────────────
  const totalStepsForMode = mode === "summary" ? 1 : mode === "reminders" ? 2 : 5;

  const STEP_META: Record<number, { icon: React.ElementType; title: string; subtitle: string; color: string }> = {
    1: { icon: DoorOpen,      title: "¿A qué workspace pertenece?",              subtitle: "La IA comparará los participantes de la grabación con los miembros del workspace.", color: "#059669" },
    2: { icon: CalendarCheck, title: "¿Con qué evento del calendario coincide?", subtitle: "Selecciona el evento más cercano a la fecha de la grabación.",                        color: "#2563eb" },
    3: { icon: Bell,          title: "Revisa los recordatorios detectados",       subtitle: "Desliza a la derecha para guardar como recordatorio, a la izquierda para omitir.",    color: "#d97706" },
    4: { icon: ClipboardList, title: "Revisa y aprueba las acciones",             subtitle: "Solo las acciones aprobadas se ejecutarán en las integraciones.",                    color: "#050040" },
  };

  const remindersSwipeStep = mode === "reminders" ? 1 : 3;
  const actionsStep = 4;
  const curMeta = STEP_META[step as 1 | 2 | 3 | 4];

  return (
    <div className="flex h-full overflow-y-auto bg-slate-50 px-6 py-10">
      <div className="w-full max-w-2xl mx-auto flex flex-col">

        {/* ── Progress dots ── */}
        <div className="flex justify-center gap-2 mb-8">
          {Array.from({ length: totalStepsForMode }, (_, i) => (
            <div key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i < step ? "w-6 bg-[#050040]" : i === step - 1 ? "w-8 bg-[#050040]" : "w-3 bg-slate-200",
              )}
            />
          ))}
        </div>

        {/* ── Step header ── */}
        {curMeta && (
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md"
              style={{ backgroundColor: curMeta.color }}>
              <curMeta.icon className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">{curMeta.title}</h1>
            <p className="text-base text-slate-400 mt-2">{curMeta.subtitle}</p>
          </div>
        )}

        {/* ── Step 1: Workspace (for actions/full) ── */}
        {step === 1 && mode !== "reminders" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {rooms.map((r) => {
                const sel = selectedRoom?.id === r.id;
                return (
                  <motion.button key={r.id} onClick={() => selectRoom(r)}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className={cn("p-5 rounded-2xl border-2 text-left transition-all", sel ? "border-[#050040] bg-[#050040]/5 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300")}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: r.color + "20" }}>{r.emoji}</div>
                      <p className={cn("text-base font-bold truncate flex-1", sel ? "text-[#050040]" : "text-slate-800")}>{r.name}</p>
                      {sel && <div className="w-6 h-6 rounded-full bg-[#050040] flex items-center justify-center shrink-0"><Check className="w-3.5 h-3.5 text-white" /></div>}
                    </div>
                  </motion.button>
                );
              })}
              {rooms.length === 0 && (
                <div className="col-span-2 text-center py-12 text-slate-400">
                  <DoorOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-base">No tienes workspaces. Puedes continuar sin asignar.</p>
                </div>
              )}
            </div>
            {selectedRoom && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-[#050040]" />
                  <p className="text-base font-bold text-slate-800">Análisis IA de personas</p>
                  <span className="ml-auto text-2xl font-bold text-[#050040]">{matchPct}%</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#050040] rounded-full transition-all duration-700" style={{ width: `${matchPct}%` }} />
                </div>
                <p className="text-sm text-slate-500">de personas mencionadas coinciden con miembros del workspace</p>
                {matchedPeople.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">Coincidencias</p>
                    <div className="space-y-1.5">
                      {matchedPeople.map(({ person, member_name }) => (
                        <div key={person} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="text-sm text-slate-700">{person}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                          <span className="text-sm text-emerald-700 font-semibold">{member_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {unmatchedPpl.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">No encontrados</p>
                    {unmatchedPpl.map((p) => (
                      <div key={p} className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-sm text-slate-600">{p}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}

        {/* ── Step 2: Calendar match ── */}
        {step === 2 && (
          <div className="space-y-3">
            {session?.calendar_events && (
              <div className="flex items-center gap-3 px-5 py-3.5 bg-[#050040]/5 border border-[#050040]/15 rounded-2xl">
                <Sparkles className="w-4 h-4 text-[#050040]" />
                <span className="text-sm text-[#050040] font-semibold">Sugerencia IA: {session.calendar_events.title}</span>
                <span className="ml-auto text-sm font-bold text-[#050040]">{session.calendar_match_pct ?? 0}% match</span>
              </div>
            )}
            {nearbyEvents.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No hay eventos cercanos a esta fecha.</p>
                <p className="text-sm mt-1">Puedes continuar sin asignar evento.</p>
              </div>
            )}
            {nearbyEvents.map((ev) => {
              const sel = selectedCalMatch?.id === ev.id;
              const diffH = session?.meeting_date ? Math.round(Math.abs(new Date(ev.start_at).getTime() - new Date(session.meeting_date).getTime()) / 3600000) : 999;
              return (
                <motion.button key={ev.id} onClick={() => pickCalMatch(ev)} whileHover={{ scale: 1.01 }}
                  className={cn("w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center gap-4", sel ? "border-[#050040] bg-[#050040]/5 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300")}>
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", sel ? "bg-[#050040] text-white" : "bg-slate-100 text-[#050040]")}>
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-base font-bold truncate", sel ? "text-[#050040]" : "text-slate-800")}>{ev.title}</p>
                    <p className="text-sm text-slate-400 mt-0.5">{fmtDate(ev.start_at)} · {fmtTime(ev.start_at)}</p>
                  </div>
                  {diffH < 999 && <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full shrink-0">{diffH < 1 ? "< 1h" : `${diffH}h`} dif.</span>}
                  {sel && <div className="w-6 h-6 rounded-full bg-[#050040] flex items-center justify-center shrink-0"><Check className="w-3.5 h-3.5 text-white" /></div>}
                </motion.button>
              );
            })}
          </div>
        )}

        {/* ── Reminders swipe step (step 3 for actions/full, step 1 for reminders mode) ── */}
        {step === remindersSwipeStep && (
          <div className="space-y-3">
            {/* Hint */}
            <div className="flex items-center justify-between px-1 mb-2">
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><X className="w-3.5 h-3.5 text-red-400" />izquierda = omitir</span>
                <span className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 text-emerald-500" />derecha = recordatorio</span>
              </div>
              <span className="text-xs font-bold text-emerald-600">
                {Object.values(reminderDecisions).filter((d) => d === "accepted").length} aceptados
              </span>
            </div>
            {itemsLoading && (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
              </div>
            )}
            {!itemsLoading && items.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No se detectaron items en esta reunión</p>
              </div>
            )}
            <AnimatePresence>
              {!itemsLoading && items.map((item) => (
                <motion.div key={item.id} layout
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <SwipeReminderCard
                    item={item}
                    decision={reminderDecisions[item.id] ?? null}
                    onDecide={(id, d) => setReminderDecisions((prev) => ({ ...prev, [id]: d }))}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Step 4 (actions/full): Integration actions review ── */}
        {step === actionsStep && (
          <div>
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">{approved.length} aprobadas</span>
                <span className="text-sm font-bold text-red-500 bg-red-50 border border-red-100 px-3 py-1.5 rounded-full">{rejected.length} rechazadas</span>
                <span className="text-sm font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">{pending.length} pendientes</span>
              </div>
              <button onClick={approveAll}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-colors">
                <CheckCircle2 className="w-4 h-4" />Aprobar todas
              </button>
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar acción…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 outline-none focus:border-[#050040]/50" />
              </div>
            </div>
            <div className="flex gap-2 mb-4 flex-wrap">
              {([ ["all","Todas"], ["task","Tareas"], ["decision","Decisiones"], ["next_step","Próx. pasos"], ["risk","Riesgos"], ["note","Notas"] ] as [string, string][]).map(([v, l]) => (
                <button key={v} onClick={() => setFilterType(v as ActionType | "all")}
                  className={cn("px-4 py-2 rounded-xl text-sm font-semibold transition-all", filterType === v ? "bg-[#050040] text-white shadow-sm" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300")}>
                  {l}
                </button>
              ))}
            </div>
            {itemsLoading && <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>}
            {!itemsLoading && (
              <div className="space-y-3">
                <AnimatePresence>
                  {filtered.map((item) => <ActionCard key={item.id} item={item} onToggle={toggleItem} onEdit={editItem} />)}
                </AnimatePresence>
                {filtered.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Sin acciones para este filtro</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Footer navigation ── */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-200">
          <button onClick={goBack}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="w-4 h-4" />Atrás
          </button>

          {step === actionsStep ? (
            <button onClick={handleExecute} disabled={approved.length === 0}
              className={cn("flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all",
                approved.length > 0 ? "bg-[#050040] text-white hover:bg-[#050040]/90 shadow-md" : "bg-slate-100 text-slate-400 cursor-not-allowed")}>
              <Play className="w-4 h-4" />Aprobar y ejecutar
              {approved.length > 0 && <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1">{approved.length}</span>}
            </button>
          ) : step === remindersSwipeStep && mode === "reminders" ? (
            <button onClick={goNext}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#050040] text-white text-sm font-semibold hover:bg-[#050040]/90 transition-colors">
              <Bell className="w-4 h-4" />Guardar recordatorios
              {Object.values(reminderDecisions).filter((d) => d === "accepted").length > 0 && (
                <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1">
                  {Object.values(reminderDecisions).filter((d) => d === "accepted").length}
                </span>
              )}
            </button>
          ) : (
            <button onClick={goNext} disabled={!canProceed()}
              className={cn("flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all",
                canProceed() ? "bg-[#050040] text-white hover:bg-[#050040]/90" : "bg-slate-100 text-slate-400 cursor-not-allowed")}>
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
