"use client";
/**
 * MeetAction — AI-generated action review system.
 *
 * Think of it as a "Pull Request" for meetings: the AI proposes actions
 * after processing a recording, and the user reviews, edits and approves
 * before they are dispatched to Jira, Slack, Notion, Teams, etc.
 *
 * Three main views:
 *   review    → review & approve action items
 *   execution → real-time execution progress
 *   history   → log of past executions
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Sparkles,
  ChevronRight, Edit3, Check, X, RefreshCw, Play,
  Users, Zap, Calendar, BookOpen, MessageSquare, BarChart3,
  ExternalLink, ArrowRight, Filter, Search, Eye,
  ClipboardList, History, Cpu, ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SiJira, SiSlack, SiNotion } from "react-icons/si";
import { TbBrandTeams } from "react-icons/tb";
import { useTranslation } from "@/lib/i18n";

// ── Types ──────────────────────────────────────────────────────────────────────
type ActionStatus   = "pending" | "approved" | "rejected" | "executing" | "executed" | "failed";
type ActionType     = "task" | "decision" | "risk" | "next_step" | "event" | "note";
type Destination    = "jira" | "slack" | "notion" | "teams" | "meetcalendar" | "meetbook";
type Priority       = "low" | "medium" | "high" | "critical";
type SessionStatus  = "processing" | "pending_review" | "approved" | "executed" | "partial" | "rejected";
type View           = "review" | "execution" | "history";

interface ActionItem {
  id:              string;
  type:            ActionType;
  destination:     Destination;
  status:          ActionStatus;
  title:           string;
  description:     string;
  assignee_name:   string;
  assignee_email:  string;
  priority:        Priority;
  external_url?:   string;
}

interface MeetSession {
  id:                string;
  meeting_name:      string;
  meeting_date:      string;
  duration_seconds:  number;
  status:            SessionStatus;
  summary_ai:        string;
  decisions_count:   number;
  tasks_count:       number;
  risks_count:       number;
  next_steps_count:  number;
  people_mentioned:  string[];
  calendar_match:    { name: string; pct: number };
  items:             ActionItem[];
}

interface HistoryEntry {
  id:           string;
  title:        string;
  destination:  Destination;
  status:       "success" | "failed";
  external_url: string;
  meeting_name: string;
  executed_at:  string;
}

// ── Demo data — replace with real API calls ────────────────────────────────────
const DEMO_SESSION: MeetSession = {
  id:               "demo-001",
  meeting_name:     "Reunión Q2 Planning — Producto & Diseño",
  meeting_date:     new Date().toISOString(),
  duration_seconds: 2847,
  status:           "pending_review",
  summary_ai: `La reunión se centró en la planificación del Q2 con énfasis en el rediseño del onboarding,
optimización del funnel de conversión y definición de métricas de retención. Se acordó priorizar
la feature de análisis de grabaciones con IA para agosto. Carlos presenta un riesgo de capacidad
que podría afectar el sprint 3. El equipo de backend bloqueará 2 semanas para refactorización técnica.`,
  decisions_count:  3,
  tasks_count:      5,
  risks_count:      2,
  next_steps_count: 4,
  people_mentioned: ["Carlos Ramírez", "Ana Martínez", "Luis Pérez", "Diana López"],
  calendar_match:   { name: "Q2 Planning Meeting · 10:00", pct: 94 },
  items: [
    { id: "a1", type: "task",      destination: "jira",         status: "pending", title: "Rediseñar flujo de onboarding",            description: "Incluir validación de email, tour interactivo y configuración de organización en 3 pasos",  assignee_name: "Carlos Ramírez", assignee_email: "carlos@meetbox.io", priority: "high" },
    { id: "a2", type: "task",      destination: "jira",         status: "pending", title: "Implementar analytics de retención",       description: "Dashboard con métricas D1, D7, D30 usando eventos de Supabase + visualización Recharts",       assignee_name: "Ana Martínez",   assignee_email: "ana@meetbox.io",    priority: "high" },
    { id: "a3", type: "decision",  destination: "notion",       status: "pending", title: "Priorizar IA de grabaciones para agosto",  description: "Decisión tomada: la feature de análisis IA de grabaciones se lanza en la semana 3 de agosto",   assignee_name: "Luis Pérez",     assignee_email: "luis@meetbox.io",   priority: "medium" },
    { id: "a4", type: "risk",      destination: "slack",        status: "pending", title: "Riesgo de capacidad en Sprint 3",          description: "Carlos no podrá dedicar al 100% en sprint 3 por compromisos con otro equipo. Evaluar contratación temporal.", assignee_name: "Diana López", assignee_email: "diana@meetbox.io", priority: "critical" },
    { id: "a5", type: "next_step", destination: "meetcalendar", status: "pending", title: "Retrospectiva Sprint 2 el próximo lunes",  description: "Agendar sesión de retrospectiva el lunes 10:00 con todo el equipo de producto",                assignee_name: "Carlos Ramírez", assignee_email: "carlos@meetbox.io", priority: "medium" },
    { id: "a6", type: "note",      destination: "meetbook",     status: "pending", title: "Notas completas del Q2 Planning",          description: "Guardar transcripción completa, decisiones y acuerdos en el cuaderno Producto > Planificación",  assignee_name: "Ana Martínez",   assignee_email: "ana@meetbox.io",    priority: "low" },
    { id: "a7", type: "task",      destination: "jira",         status: "pending", title: "Optimizar funnel de conversión trial→paid", description: "A/B test en el upgrade modal con 3 variantes. Implementar con Posthog feature flags",           assignee_name: "Luis Pérez",     assignee_email: "luis@meetbox.io",   priority: "high" },
    { id: "a8", type: "decision",  destination: "notion",       status: "pending", title: "Backend bloquea 2 semanas para refactor", description: "Semanas 3-4 de julio el equipo backend estará en modo refactorización. Sin nuevas features.",      assignee_name: "Diana López",    assignee_email: "diana@meetbox.io",  priority: "medium" },
  ],
};

const DEMO_HISTORY: HistoryEntry[] = [
  { id: "h1", title: "Ticket MEET-142: Onboarding wizard",    destination: "jira",         status: "success", external_url: "#", meeting_name: "Sprint Planning S22",       executed_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "h2", title: "Mensaje en #producto: Decisión pricing", destination: "slack",        status: "success", external_url: "#", meeting_name: "Sprint Planning S22",       executed_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "h3", title: "Página Notion: Roadmap Q2",             destination: "notion",       status: "success", external_url: "#", meeting_name: "Kickoff Q2",                executed_at: new Date(Date.now() - 172800000).toISOString() },
  { id: "h4", title: "Evento: Daily standup recurrente",      destination: "meetcalendar", status: "success", external_url: "#", meeting_name: "Kickoff Q2",                executed_at: new Date(Date.now() - 172800000).toISOString() },
  { id: "h5", title: "Ticket MEET-138: Fix auth bug",          destination: "jira",         status: "failed",  external_url: "#", meeting_name: "Bug triage semanal",        executed_at: new Date(Date.now() - 259200000).toISOString() },
  { id: "h6", title: "Nota MeetBook: Decisiones de diseño",   destination: "meetbook",     status: "success", external_url: "#", meeting_name: "Design Review v2.1",        executed_at: new Date(Date.now() - 345600000).toISOString() },
];

// ── Destination metadata ───────────────────────────────────────────────────────
const DEST_META: Record<Destination, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  jira:         { label: "Jira",          Icon: SiJira,         color: "#0052CC", bg: "#EFF4FF" },
  slack:        { label: "Slack",         Icon: SiSlack,        color: "#4A154B", bg: "#F5F0F8" },
  notion:       { label: "Notion",        Icon: SiNotion,       color: "#191919", bg: "#F5F5F5" },
  teams:        { label: "Teams",         Icon: TbBrandTeams,   color: "#5059C9", bg: "#EEEEFF" },
  meetcalendar: { label: "MeetCalendar",  Icon: Calendar,       color: "#050040", bg: "#EEEEF8" },
  meetbook:     { label: "MeetBook",      Icon: BookOpen,       color: "#7c3aed", bg: "#F3EEFF" },
};

const TYPE_META: Record<ActionType, { label: string; color: string }> = {
  task:      { label: "Tarea",         color: "#050040" },
  decision:  { label: "Decisión",      color: "#059669" },
  risk:      { label: "Riesgo",        color: "#dc2626" },
  next_step: { label: "Próximo paso",  color: "#d97706" },
  event:     { label: "Evento",        color: "#0891b2" },
  note:      { label: "Nota",          color: "#7c3aed" },
};

const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string }> = {
  low:      { label: "Baja",     color: "#64748b", bg: "#f1f5f9" },
  medium:   { label: "Media",    color: "#d97706", bg: "#fef3c7" },
  high:     { label: "Alta",     color: "#ea580c", bg: "#fff7ed" },
  critical: { label: "Crítica",  color: "#dc2626", bg: "#fef2f2" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

// ── DestinationBadge ──────────────────────────────────────────────────────────
function DestinationBadge({ dest }: { dest: Destination }) {
  const { label, Icon, color, bg } = DEST_META[dest];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0"
      style={{ backgroundColor: bg, color }}>
      <Icon className="w-3 h-3" style={{ color }} />
      {label}
    </span>
  );
}

// ── StatusIcon ────────────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: ActionStatus | "success" | "failed" }) {
  if (status === "approved")  return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === "rejected")  return <XCircle       className="w-4 h-4 text-red-400" />;
  if (status === "executing") return <RefreshCw     className="w-4 h-4 text-blue-500 animate-spin" />;
  if (status === "executed" || status === "success") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === "failed")    return <XCircle       className="w-4 h-4 text-red-500" />;
  return <Clock className="w-4 h-4 text-slate-400" />;
}

// ── ActionCard — el componente central (editable, aprobable, rechazable) ──────
function ActionCard({
  item, onToggle, onEdit,
}: {
  item: ActionItem;
  onToggle: (id: string, status: "approved" | "rejected" | "pending") => void;
  onEdit:   (id: string, patch: Partial<ActionItem>) => void;
}) {
  const [editing,  setEditing]  = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [draft,    setDraft]    = React.useState(item);

  const isApproved = item.status === "approved";
  const isRejected = item.status === "rejected";
  const type       = TYPE_META[item.type];
  const priority   = PRIORITY_META[item.priority];

  function saveEdit() {
    onEdit(item.id, { title: draft.title, description: draft.description, assignee_name: draft.assignee_name, priority: draft.priority, destination: draft.destination });
    setEditing(false);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group bg-white rounded-2xl border transition-all duration-200",
        isApproved ? "border-emerald-200 shadow-sm shadow-emerald-50"
          : isRejected ? "border-slate-100 opacity-50"
          : "border-slate-200 hover:border-slate-300 hover:shadow-sm",
      )}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 p-4">
        {/* Approve/Reject controls */}
        <div className="flex flex-col gap-1 shrink-0 mt-0.5">
          <button
            onClick={() => onToggle(item.id, isApproved ? "pending" : "approved")}
            className={cn(
              "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
              isApproved
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "border-slate-300 hover:border-emerald-400 hover:bg-emerald-50",
            )}
          >
            {isApproved && <Check className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onToggle(item.id, isRejected ? "pending" : "rejected")}
            className={cn(
              "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
              isRejected
                ? "bg-red-400 border-red-400 text-white"
                : "border-slate-300 hover:border-red-300 hover:bg-red-50",
            )}
          >
            {isRejected && <X className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                className="w-full text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#050040]/40"
              />
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                rows={2}
                className="w-full text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#050040]/40 resize-none"
              />
              <div className="flex items-center gap-2">
                <input
                  value={draft.assignee_name}
                  onChange={(e) => setDraft((d) => ({ ...d, assignee_name: e.target.value }))}
                  placeholder="Responsable"
                  className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#050040]/40"
                />
                <select
                  value={draft.priority}
                  onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as Priority }))}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
                >
                  {(["low","medium","high","critical"] as Priority[]).map((p) => (
                    <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                  ))}
                </select>
                <select
                  value={draft.destination}
                  onChange={(e) => setDraft((d) => ({ ...d, destination: e.target.value as Destination }))}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
                >
                  {(Object.keys(DEST_META) as Destination[]).map((d) => (
                    <option key={d} value={d}>{DEST_META[d].label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1.5 bg-[#050040] text-white rounded-lg text-xs font-semibold">
                  <Check className="w-3 h-3" />Guardar
                </button>
                <button onClick={() => { setDraft(item); setEditing(false); }} className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold">
                  <X className="w-3 h-3" />Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className={cn("text-sm font-semibold leading-snug", isRejected ? "line-through text-slate-400" : "text-slate-800")}>
                  {item.title}
                </p>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Type badge */}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: type.color + "15", color: type.color }}>
                    {type.label}
                  </span>
                  {/* Priority badge */}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: priority.bg, color: priority.color }}>
                    {priority.label}
                  </span>
                </div>
              </div>

              {expanded && item.description && (
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{item.description}</p>
              )}

              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <DestinationBadge dest={item.destination} />
                {item.assignee_name && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <div className="w-4 h-4 rounded-full bg-[#050040]/10 flex items-center justify-center text-[8px] font-bold text-[#050040]">
                      {item.assignee_name[0]}
                    </div>
                    {item.assignee_name}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        {!editing && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Ver descripción"
            >
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")} />
            </button>
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Editar"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── ExecutionStep ─────────────────────────────────────────────────────────────
function ExecutionStep({ label, status, delay = 0 }: { label: string; status: "done" | "running" | "pending"; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-center gap-3 py-2.5"
    >
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0">
        {status === "done"    && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
        {status === "running" && <RefreshCw    className="w-5 h-5 text-blue-500 animate-spin" />}
        {status === "pending" && <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
      </div>
      <span className={cn(
        "text-sm font-medium",
        status === "done"    ? "text-slate-800" :
        status === "running" ? "text-blue-600" :
                               "text-slate-400",
      )}>
        {label}
      </span>
      {status === "running" && (
        <span className="ml-auto text-[10px] font-semibold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full animate-pulse">
          En progreso…
        </span>
      )}
      {status === "done" && (
        <span className="ml-auto text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
          Completado
        </span>
      )}
    </motion.div>
  );
}

// ── MeetActionView ─────────────────────────────────────────────────────────────
export default function MeetActionView() {
  const { locale } = useTranslation();
  const [view,       setView]       = React.useState<View>("review");
  const [session,    setSession]    = React.useState<MeetSession>(DEMO_SESSION);
  const [history]                   = React.useState<HistoryEntry[]>(DEMO_HISTORY);
  const [executing,  setExecuting]  = React.useState(false);
  const [execStep,   setExecStep]   = React.useState(0);
  const [filterType, setFilterType] = React.useState<ActionType | "all">("all");
  const [search,     setSearch]     = React.useState("");

  const approvedItems = session.items.filter((i) => i.status === "approved");
  const rejectedItems = session.items.filter((i) => i.status === "rejected");
  const pendingItems  = session.items.filter((i) => i.status === "pending");

  const filteredItems = session.items.filter((item) => {
    if (filterType !== "all" && item.type !== filterType) return false;
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function toggleItem(id: string, status: "approved" | "rejected" | "pending") {
    setSession((s) => ({
      ...s,
      items: s.items.map((i) => i.id === id ? { ...i, status } : i),
    }));
  }

  function editItem(id: string, patch: Partial<ActionItem>) {
    setSession((s) => ({
      ...s,
      items: s.items.map((i) => i.id === id ? { ...i, ...patch } : i),
    }));
  }

  function approveAll() {
    setSession((s) => ({
      ...s,
      items: s.items.map((i) => i.status === "pending" ? { ...i, status: "approved" } : i),
    }));
  }

  async function handleExecute() {
    setExecuting(true);
    setView("execution");
    // Simulate step-by-step execution
    const steps = [0, 1, 2, 3, 4, 5];
    for (const step of steps) {
      await new Promise((r) => setTimeout(r, 900 + step * 200));
      setExecStep(step + 1);
    }
    setExecuting(false);
  }

  const destinations = [...new Set(approvedItems.map((i) => i.destination))];
  const assignees    = [...new Set(approvedItems.map((i) => i.assignee_name).filter(Boolean))];

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#050040] to-[#1a1a8c] flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-800 leading-tight truncate">MeetAction</h1>
            <p className="text-[11px] text-slate-400 leading-tight">
              {locale === "en" ? "Review and approve AI-generated actions" : "Revisa y aprueba acciones generadas por IA"}
            </p>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {([
            { id: "review",    icon: ClipboardList, label: locale === "en" ? "Review" : "Revisión" },
            { id: "execution", icon: Zap,           label: locale === "en" ? "Execution" : "Ejecución" },
            { id: "history",   icon: History,       label: locale === "en" ? "History" : "Historial" },
          ] as { id: View; icon: React.ElementType; label: string }[]).map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setView(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                view === id ? "bg-white text-[#050040] shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {/* Primary action */}
        {view === "review" && (
          <button
            onClick={handleExecute}
            disabled={approvedItems.length === 0 || executing}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0",
              approvedItems.length > 0
                ? "bg-[#050040] text-white hover:bg-[#050040]/90 shadow-md shadow-[#050040]/20"
                : "bg-slate-100 text-slate-400 cursor-not-allowed",
            )}
          >
            <Play className="w-4 h-4" />
            {locale === "en" ? "Approve & Execute" : "Aprobar y ejecutar"}
            {approvedItems.length > 0 && (
              <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {approvedItems.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ──────────────── REVIEW VIEW ──────────────── */}
          {view === "review" && (
            <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-6 space-y-6 max-w-none">

              {/* Row 1: Meeting summary + execution stats */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Meeting summary card — 2/3 */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {/* Status bar */}
                  <div className="h-1 bg-gradient-to-r from-[#050040] via-[#0c0c63] to-[#1a1a8c]" />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            {locale === "en" ? "Processed" : "Procesado"}
                          </span>
                        </div>
                        <h2 className="text-base font-bold text-slate-800 leading-tight">{session.meeting_name}</h2>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(session.meeting_date)}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDuration(session.duration_seconds)}</span>
                        </div>
                      </div>
                      {/* Metrics */}
                      <div className="grid grid-cols-4 gap-2 shrink-0">
                        {[
                          { n: session.tasks_count,      label: locale === "en" ? "Tasks" : "Tareas",      color: "#050040" },
                          { n: session.decisions_count,  label: locale === "en" ? "Decisions" : "Decisiones", color: "#059669" },
                          { n: session.risks_count,      label: locale === "en" ? "Risks" : "Riesgos",     color: "#dc2626" },
                          { n: session.next_steps_count, label: locale === "en" ? "Next steps" : "Próx. pasos", color: "#d97706" },
                        ].map(({ n, label, color }) => (
                          <div key={label} className="text-center bg-slate-50 rounded-xl px-3 py-2">
                            <p className="text-xl font-bold" style={{ color }}>{n}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI Summary */}
                    <div className="bg-slate-50 rounded-xl p-3.5 mb-4">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#050040]" />
                        <p className="text-[11px] font-bold text-[#050040] uppercase tracking-wide">
                          {locale === "en" ? "AI Summary" : "Resumen IA"}
                        </p>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{session.summary_ai}</p>
                    </div>

                    {/* AI calendar match */}
                    <div className="flex items-center gap-3 p-3 bg-[#050040]/4 border border-[#050040]/10 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-[#050040]">
                          {locale === "en" ? "AI proposed match" : "Match propuesto por IA"}
                        </p>
                        <p className="text-xs text-slate-600 truncate">{session.calendar_match.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-lg font-bold text-[#050040]">{session.calendar_match.pct}%</p>
                          <p className="text-[9px] text-slate-400">{locale === "en" ? "confidence" : "coincidencia"}</p>
                        </div>
                        <button className="text-xs text-[#050040] font-semibold hover:underline whitespace-nowrap">
                          {locale === "en" ? "Change" : "Cambiar"}
                        </button>
                      </div>
                    </div>

                    {/* People mentioned */}
                    {session.people_mentioned.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span className="text-[11px] font-semibold text-slate-400">
                          {locale === "en" ? "Mentioned:" : "Mencionados:"}
                        </span>
                        {session.people_mentioned.map((name) => (
                          <span key={name} className="inline-flex items-center gap-1 text-[11px] bg-white border border-slate-200 rounded-full px-2.5 py-0.5 text-slate-600 font-medium">
                            <div className="w-3.5 h-3.5 rounded-full bg-[#050040]/10 flex items-center justify-center text-[8px] font-bold text-[#050040]">
                              {name[0]}
                            </div>
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Execution summary card — 1/3 */}
                <div className="space-y-4">

                  {/* Stats */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">
                      {locale === "en" ? "Review Summary" : "Resumen de revisión"}
                    </p>
                    <div className="space-y-3">
                      {[
                        { label: locale === "en" ? "Approved" : "Aprobadas",  count: approvedItems.length, color: "bg-emerald-500", max: session.items.length },
                        { label: locale === "en" ? "Pending" : "Pendientes",  count: pendingItems.length,  color: "bg-amber-400",   max: session.items.length },
                        { label: locale === "en" ? "Rejected" : "Rechazadas", count: rejectedItems.length, color: "bg-red-400",     max: session.items.length },
                      ].map(({ label, count, color, max }) => (
                        <div key={label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-500">{label}</span>
                            <span className="text-xs font-bold text-slate-700">{count}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", color)}
                              style={{ width: `${max > 0 ? (count / max) * 100 : 0}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="h-px bg-slate-100 my-4" />

                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs text-slate-500">{locale === "en" ? "Integrations" : "Integraciones"}</span>
                        <div className="ml-auto flex items-center gap-1">
                          {[...new Set(session.items.map(i => i.destination))].map((d) => {
                            const { Icon, color } = DEST_META[d as Destination];
                            return <Icon key={d} className="w-3.5 h-3.5" style={{ color }} />;
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs text-slate-500">{locale === "en" ? "Assignees" : "Asignadas a"}</span>
                        <span className="ml-auto text-xs font-bold text-slate-700">{session.people_mentioned.length}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-xs text-slate-500">{locale === "en" ? "Risks detected" : "Riesgos"}</span>
                        <span className="ml-auto text-xs font-bold text-red-600">{session.risks_count}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                    <button onClick={approveAll}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors">
                      <CheckCircle2 className="w-4 h-4" />
                      {locale === "en" ? "Approve all pending" : "Aprobar todas pendientes"}
                    </button>
                    <button
                      onClick={() => setSession((s) => ({ ...s, items: s.items.map((i) => ({ ...i, status: "pending" })) }))}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition-colors">
                      <RefreshCw className="w-4 h-4" />
                      {locale === "en" ? "Reset all" : "Reiniciar revisión"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Action items list */}
              <div>
                {/* Filter bar */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={locale === "en" ? "Search actions…" : "Buscar acciones…"}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-sm placeholder:text-slate-400 outline-none focus:border-[#050040]/40 transition"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    {([
                      { value: "all",       label: locale === "en" ? "All" : "Todas" },
                      { value: "task",      label: locale === "en" ? "Tasks" : "Tareas" },
                      { value: "decision",  label: locale === "en" ? "Decisions" : "Decisiones" },
                      { value: "risk",      label: locale === "en" ? "Risks" : "Riesgos" },
                      { value: "next_step", label: locale === "en" ? "Next steps" : "Próx. pasos" },
                    ] as { value: ActionType | "all"; label: string }[]).map(({ value, label }) => (
                      <button key={value} onClick={() => setFilterType(value)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                          filterType === value ? "bg-[#050040] text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300",
                        )}
                      >{label}</button>
                    ))}
                  </div>
                </div>

                {/* Action cards */}
                <div className="space-y-2">
                  <AnimatePresence>
                    {filteredItems.map((item) => (
                      <ActionCard key={item.id} item={item} onToggle={toggleItem} onEdit={editItem} />
                    ))}
                  </AnimatePresence>
                  {filteredItems.length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                      <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">{locale === "en" ? "No actions match the filter" : "Sin acciones para el filtro actual"}</p>
                    </div>
                  )}
                </div>
              </div>

            </motion.div>
          )}

          {/* ──────────────── EXECUTION VIEW ──────────────── */}
          {view === "execution" && (
            <motion.div key="execution" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-6 max-w-2xl mx-auto">

              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#050040] to-[#1a1a8c] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#050040]/20">
                  <Zap className={cn("w-7 h-7 text-white", executing && "animate-pulse")} />
                </div>
                <h2 className="text-xl font-bold text-slate-800">
                  {executing ? (locale === "en" ? "Executing actions…" : "Ejecutando acciones…") : (locale === "en" ? "Execution complete" : "Ejecución completada")}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {execStep} / {destinations.length + 3} {locale === "en" ? "steps completed" : "pasos completados"}
                </p>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full mt-4 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#050040] to-[#1a1a8c] rounded-full"
                    animate={{ width: `${(execStep / (destinations.length + 3)) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Steps */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 divide-y divide-slate-100">
                {[
                  { label: locale === "en" ? "Transcription completed" : "Transcripción completada", minStep: 1 },
                  { label: locale === "en" ? "Summary generated" : "Resumen generado", minStep: 2 },
                  { label: locale === "en" ? "Actions identified" : "Acciones identificadas", minStep: 3 },
                  ...destinations.map((d, i) => ({
                    label: `${locale === "en" ? "Sending to" : "Enviando a"} ${DEST_META[d as Destination].label}`,
                    minStep: 4 + i,
                  })),
                ].map(({ label, minStep }, i) => (
                  <ExecutionStep
                    key={label}
                    label={label}
                    delay={i * 0.08}
                    status={execStep > minStep ? "done" : execStep === minStep ? "running" : "pending"}
                  />
                ))}
              </div>

              {/* Result summary (shown when done) */}
              {!executing && execStep >= destinations.length + 3 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <p className="font-bold text-emerald-800">{locale === "en" ? "All actions executed successfully" : "Todas las acciones ejecutadas con éxito"}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-white rounded-xl p-3 text-center border border-emerald-100">
                      <p className="text-2xl font-bold text-[#050040]">{approvedItems.length}</p>
                      <p className="text-[10px] text-slate-500">{locale === "en" ? "Actions" : "Acciones"}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-center border border-emerald-100">
                      <p className="text-2xl font-bold text-[#050040]">{destinations.length}</p>
                      <p className="text-[10px] text-slate-500">{locale === "en" ? "Integrations" : "Integraciones"}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-center border border-emerald-100">
                      <p className="text-2xl font-bold text-[#050040]">{assignees.length}</p>
                      <p className="text-[10px] text-slate-500">{locale === "en" ? "Assignees" : "Personas"}</p>
                    </div>
                  </div>
                  <button onClick={() => setView("history")}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors">
                    <Eye className="w-4 h-4" />
                    {locale === "en" ? "View history" : "Ver historial de ejecución"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ──────────────── HISTORY VIEW ──────────────── */}
          {view === "history" && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-6 space-y-5">

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{locale === "en" ? "Execution History" : "Historial de ejecuciones"}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{locale === "en" ? "Everything created from your meetings" : "Todo lo creado a partir de tus reuniones"}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 rounded-xl px-3 py-2">
                  <BarChart3 className="w-4 h-4" />
                  {history.filter((h) => h.status === "success").length} / {history.length} {locale === "en" ? "successful" : "exitosos"}
                </div>
              </div>

              {/* Group by meeting */}
              {["Sprint Planning S22", "Kickoff Q2", "Bug triage semanal", "Design Review v2.1"].map((meetingName) => {
                const entries = history.filter((h) => h.meeting_name === meetingName);
                if (!entries.length) return null;
                return (
                  <div key={meetingName} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    {/* Meeting header */}
                    <div className="flex items-center gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-100">
                      <Calendar className="w-4 h-4 text-[#050040]" />
                      <p className="text-sm font-semibold text-slate-700">{meetingName}</p>
                      <span className="ml-auto text-[11px] text-slate-400">
                        {formatDate(entries[0].executed_at)} · {formatTime(entries[0].executed_at)}
                      </span>
                    </div>

                    {/* Log entries */}
                    <div className="divide-y divide-slate-50">
                      {entries.map((entry) => {
                        const dest = DEST_META[entry.destination];
                        return (
                          <div key={entry.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors group">
                            <StatusIcon status={entry.status} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">{entry.title}</p>
                            </div>
                            <DestinationBadge dest={entry.destination} />
                            {entry.external_url && entry.status === "success" && (
                              <a href={entry.external_url} target="_blank" rel="noopener noreferrer"
                                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {entry.status === "failed" && (
                              <span className="text-[10px] text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full font-semibold shrink-0">
                                {locale === "en" ? "Failed" : "Error"}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
