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
  ClipboardList, History,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SiJira, SiSlack, SiNotion } from "react-icons/si";
import { TbBrandTeams } from "react-icons/tb";

// ── Types ──────────────────────────────────────────────────────────────────────
type ActionStatus  = "pending" | "approved" | "rejected" | "executing" | "executed" | "failed";
type ActionType    = "task" | "decision" | "risk" | "next_step" | "event" | "note";
type Destination   = "jira" | "slack" | "notion" | "teams" | "meetcalendar" | "meetbook";
type Priority      = "low" | "medium" | "high" | "critical";
type SessionStatus = "processing" | "pending_review" | "approved" | "executed" | "partial" | "rejected";
type WizardStep    = 0 | 1 | 2 | 3;

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
  meetcalendar: { label: "MeetCalendar", Icon: Calendar,     color: "#050040", bg: "#EEEEF8" },
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

const STEPS = [
  { icon: Mic,           label: "Reunión",    hint: "Elige qué reunión procesar" },
  { icon: DoorOpen,      label: "Sala",       hint: "Asigna el equipo de trabajo" },
  { icon: CalendarCheck, label: "Calendario", hint: "Confirma el evento del calendario" },
  { icon: ClipboardList, label: "Acciones",   hint: "Revisa y aprueba las acciones" },
];

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

function DestBadge({ dest }: { dest: Destination }) {
  const { label, Icon, color, bg } = DEST_META[dest];
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
      style={{ backgroundColor: bg, color }}>
      <Icon className="w-3 h-3" style={{ color }} />{label}
    </span>
  );
}

// ── Left stepper ───────────────────────────────────────────────────────────────
function StepperPanel({
  step, session, room, calMatch, approvedCount, totalCount,
  onHistory, pendingCount,
}: {
  step: WizardStep;
  session: ApiSession | null;
  room: Room | null;
  calMatch: NearbyEvent | null;
  approvedCount: number;
  totalCount: number;
  onHistory: () => void;
  pendingCount: number;
}) {
  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-100">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#050040] flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">MeetAction</p>
            {pendingCount > 0 && (
              <p className="text-[11px] text-[#050040] font-semibold">{pendingCount} pendientes</p>
            )}
          </div>
        </div>
        <button onClick={onHistory}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
          <History className="w-4 h-4" />
        </button>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-2">
        {STEPS.map((s, i) => {
          const done    = i < step;
          const current = i === step;
          const pending = i > step;
          const Icon    = s.icon;

          return (
            <div key={i} className="relative">
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "absolute left-5 top-[3.25rem] w-px h-4 transition-colors",
                  done ? "bg-emerald-300" : "bg-slate-200",
                )} />
              )}

              <div className={cn(
                "flex items-start gap-3 p-3.5 rounded-2xl transition-all",
                current ? "bg-[#050040]/6 border border-[#050040]/12"
                  : done  ? "bg-emerald-50/60 border border-emerald-100"
                  : "border border-transparent",
              )}>
                {/* Circle icon */}
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base transition-all",
                  current ? "bg-[#050040] text-white shadow-md shadow-[#050040]/25"
                    : done  ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-400",
                )}>
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>

                <div className="flex-1 min-w-0 pt-0.5">
                  <p className={cn(
                    "text-sm font-bold leading-tight",
                    current ? "text-[#050040]" : done ? "text-emerald-700" : "text-slate-400",
                  )}>{s.label}</p>

                  {/* Completed context */}
                  {done && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 space-y-0.5">
                      {i === 0 && session && (
                        <>
                          <p className="text-xs font-semibold text-slate-700 truncate">{session.meeting_name}</p>
                          <p className="text-[11px] text-slate-500">
                            {session.meeting_date ? fmtDate(session.meeting_date) : "Sin fecha"}
                            {session.duration_seconds ? ` · ${fmtDur(session.duration_seconds)}` : ""}
                          </p>
                        </>
                      )}
                      {i === 1 && room && (
                        <>
                          <p className="text-xs font-semibold text-slate-700">{room.emoji} {room.name}</p>
                        </>
                      )}
                      {i === 1 && !room && (
                        <p className="text-[11px] text-slate-400 italic">Sin sala asignada</p>
                      )}
                      {i === 2 && calMatch && (
                        <>
                          <p className="text-xs font-semibold text-slate-700 truncate">{calMatch.title}</p>
                          <p className="text-[11px] text-slate-500">{fmtDate(calMatch.start_at)} · {fmtTime(calMatch.start_at)}</p>
                        </>
                      )}
                      {i === 2 && !calMatch && (
                        <p className="text-[11px] text-slate-400 italic">Sin evento asignado</p>
                      )}
                    </motion.div>
                  )}

                  {/* Current hint */}
                  {current && (
                    <p className="text-[11px] text-[#050040]/60 mt-0.5">{s.hint}</p>
                  )}

                  {/* Pending hint */}
                  {pending && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{s.hint}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Approved actions summary on step 3 */}
        {step === 3 && totalCount > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <p className="text-xs font-bold text-slate-600 mb-2">Progreso de aprobación</p>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${(approvedCount / totalCount) * 100}%` }} />
              </div>
              <span className="text-xs font-bold text-slate-700">{approvedCount}/{totalCount}</span>
            </div>
            <p className="text-[11px] text-slate-500">acciones aprobadas</p>
          </motion.div>
        )}
      </div>
    </div>
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
export default function MeetActionView() {
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

  const [loading,      setLoading]      = React.useState(true);
  const [itemsLoading, setItemsLoading] = React.useState(false);
  const [filterType,   setFilterType]   = React.useState<ActionType | "all">("all");
  const [search,       setSearch]       = React.useState("");

  const session      = sessions.find((s) => s.id === selectedId) ?? null;
  const approved     = items.filter((i) => i.status === "approved");
  const rejected     = items.filter((i) => i.status === "rejected");
  const pending      = items.filter((i) => i.status === "pending");
  const destinations = [...new Set(approved.map((i) => i.destination))];
  const filtered     = items.filter((i) => {
    if (filterType !== "all" && i.type !== filterType) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const pendingCount = sessions.filter((s) => s.status === "pending_review" || s.status === "processing").length;

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  const loadSessions = React.useCallback(async () => {
    setLoading(true);
    try { const r = await fetch("/api/meetaction/sessions?limit=50"); const d = r.ok ? await r.json() : { sessions: [] }; setSessions(d.sessions ?? []); }
    catch { setSessions([]); } finally { setLoading(false); }
  }, []);

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
    if (step !== 3 || !selectedId) return;
    setItemsLoading(true);
    fetch(`/api/meetaction/sessions/${selectedId}/items`)
      .then((r) => r.ok ? r.json() : { items: [] }).then((d) => setItems(d.items ?? []))
      .catch(() => setItems([])).finally(() => setItemsLoading(false));
  }, [step, selectedId]);

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

  function canProceed() { if (step === 0) return selectedId !== null; if (step === 3) return approved.length > 0; return true; }

  function navigate(next: WizardStep, direction: "fwd" | "back") {
    if (animating) return; setDir(direction); setAnimating(true);
    setTimeout(() => { setStep(next); setAnimating(false); }, 260);
  }
  function goNext() { if (step < 3) navigate((step + 1) as WizardStep, "fwd"); }
  function goBack() { if (step > 0) navigate((step - 1) as WizardStep, "back"); }

  async function handleExecute() {
    if (!selectedId || approved.length === 0) return;
    const totalSteps = destinations.length + 3; setExecuting(true); setExecStep(0);
    let s = 0; const tick = setInterval(() => { s = Math.min(s + 1, totalSteps - 1); setExecStep(s); }, 700);
    try {
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
    setStep(0); setSelectedId(null); setSelectedRoom(null); setSelectedCalMatch(null);
    setItems([]); setRoomMembers([]); setMatchedPeople([]); setUnmatchedPpl([]); setMatchPct(0);
    setExecDone(false); setExecStep(0); setSearch(""); setFilterType("all"); loadSessions();
  }

  const historyGroups = React.useMemo(() => {
    const g = new Map<string, HistoryEntry[]>();
    for (const h of history) { const l = g.get(h.meeting_name) ?? []; l.push(h); g.set(h.meeting_name, l); }
    return [...g.entries()];
  }, [history]);

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
    const totalSteps = destinations.length + 3;
    return (
      <div className="flex h-full overflow-hidden">
        <div className="w-64 shrink-0">
          <StepperPanel step={3} session={session} room={selectedRoom} calMatch={selectedCalMatch}
            approvedCount={approved.length} totalCount={items.length}
            onHistory={() => setShowHistory(true)} pendingCount={pendingCount} />
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50 flex items-center justify-center p-8">
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
                  ...destinations.map((d, i) => ({ label: `Enviando a ${DEST_META[d as Destination].label}`, minStep: 4 + i })),
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
  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Stepper izquierdo ──────────────────────────────────────────── */}
      <div className="w-64 shrink-0">
        <StepperPanel step={step} session={session} room={selectedRoom} calMatch={selectedCalMatch}
          approvedCount={approved.length} totalCount={items.length}
          onHistory={() => setShowHistory(true)} pendingCount={pendingCount} />
      </div>

      {/* ── Contenido del paso ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">

        {/* Header del paso */}
        <div className="bg-white border-b border-slate-100 px-8 py-6 shrink-0">
          <h1 className="text-2xl font-bold text-slate-900">
            {step === 0 && "¿Qué reunión quieres procesar?"}
            {step === 1 && "¿A qué sala pertenece?"}
            {step === 2 && "¿Con qué evento del calendario coincide?"}
            {step === 3 && "Revisa y aprueba las acciones"}
          </h1>
          <p className="text-base text-slate-500 mt-1">
            {step === 0 && "Selecciona la grabación pendiente de revisión."}
            {step === 1 && "La IA analizará las personas mencionadas vs los miembros de la sala."}
            {step === 2 && "Selecciona el evento más cercano a la fecha de la grabación."}
            {step === 3 && "Aprueba o rechaza cada acción. Solo las aprobadas se ejecutarán."}
          </p>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto px-8 py-7">
          <div className={cn(
            "transition-all duration-260 max-w-3xl",
            animating && dir === "fwd"  && "opacity-0 translate-x-4",
            animating && dir === "back" && "opacity-0 -translate-x-4",
            !animating && "opacity-100 translate-x-0",
          )}>

            {/* ── Paso 0: Elegir reunión ── */}
            {step === 0 && (
              <div className="space-y-3">
                {loading && <div className="flex items-center justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>}
                {!loading && sessions.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4"><Mic className="w-8 h-8 text-slate-300" /></div>
                    <p className="text-lg font-bold text-slate-600">No hay reuniones grabadas</p>
                    <p className="text-sm text-slate-400 mt-1.5 max-w-xs">Graba una reunión con MeetBox Desktop. Las sesiones procesadas aparecerán aquí.</p>
                    <button onClick={loadSessions} className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#050040] text-white text-sm font-semibold"><RefreshCw className="w-4 h-4" />Actualizar</button>
                  </div>
                )}
                {sessions.map((s) => {
                  const st = STATUS_META[s.status]; const sel = s.id === selectedId;
                  return (
                    <button key={s.id} onClick={() => setSelectedId(s.id)}
                      className={cn("w-full text-left p-5 rounded-2xl border-2 transition-all", sel ? "border-[#050040] bg-[#050040]/5 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm")}>
                      <div className="flex items-start gap-4">
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl", sel ? "bg-[#050040]/10" : "bg-slate-100")}>🎙️</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <p className={cn("text-base font-bold truncate", sel ? "text-[#050040]" : "text-slate-800")}>{s.meeting_name}</p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.dot }} />
                              <span className="text-xs font-semibold text-slate-500">{st.label}</span>
                            </div>
                          </div>
                          <p className="text-sm text-slate-400 mt-1">
                            {s.meeting_date ? fmtDate(s.meeting_date) : "Sin fecha"}
                            {s.duration_seconds ? ` · ${fmtDur(s.duration_seconds)}` : ""}
                          </p>
                          {s.people_mentioned.length > 0 && (
                            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              {s.people_mentioned.slice(0, 5).map((p) => (
                                <span key={p} className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{p}</span>
                              ))}
                              {s.people_mentioned.length > 5 && <span className="text-xs text-slate-400">+{s.people_mentioned.length - 5}</span>}
                            </div>
                          )}
                        </div>
                        {sel && <div className="w-6 h-6 rounded-full bg-[#050040] flex items-center justify-center shrink-0 mt-0.5"><Check className="w-3.5 h-3.5 text-white" /></div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Paso 1: Sala ── */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  {rooms.map((r) => {
                    const sel = selectedRoom?.id === r.id;
                    return (
                      <button key={r.id} onClick={() => selectRoom(r)}
                        className={cn("p-5 rounded-2xl border-2 text-left transition-all", sel ? "border-[#050040] bg-[#050040]/5 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm")}>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: r.color + "20" }}>{r.emoji}</div>
                          <p className={cn("text-base font-bold truncate flex-1", sel ? "text-[#050040]" : "text-slate-800")}>{r.name}</p>
                          {sel && <div className="w-6 h-6 rounded-full bg-[#050040] flex items-center justify-center shrink-0"><Check className="w-3.5 h-3.5 text-white" /></div>}
                        </div>
                      </button>
                    );
                  })}
                  {rooms.length === 0 && (
                    <div className="col-span-2 text-center py-12 text-slate-400">
                      <DoorOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-base">No tienes salas. Puedes continuar sin asignar sala.</p>
                    </div>
                  )}
                </div>
                {selectedRoom && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-[#050040]" />
                      <p className="text-base font-bold text-slate-800">Análisis IA de personas</p>
                      <span className="ml-auto text-2xl font-bold text-[#050040]">{matchPct}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#050040] rounded-full transition-all duration-700" style={{ width: `${matchPct}%` }} />
                    </div>
                    <p className="text-sm text-slate-500">de personas mencionadas coinciden con miembros de la sala</p>
                    {matchedPeople.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-3">Coincidencias</p>
                        <div className="space-y-2">
                          {matchedPeople.map(({ person, member_name }) => (
                            <div key={person} className="flex items-center gap-3">
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
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-3">No encontrados</p>
                        <div className="space-y-2">
                          {unmatchedPpl.map((p) => (
                            <div key={p} className="flex items-center gap-3">
                              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                              <span className="text-sm text-slate-600">{p}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {roomMembers.length > 0 && (
                      <div className="pt-4 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Miembros de la sala</p>
                        <div className="flex flex-wrap gap-2">
                          {roomMembers.map((m) => (
                            <span key={m.id} className="text-sm bg-slate-50 border border-slate-200 rounded-full px-3 py-1 text-slate-600 font-medium">{m.name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            )}

            {/* ── Paso 2: Calendario ── */}
            {step === 2 && (
              <div className="space-y-3">
                {session?.calendar_events && (
                  <div className="flex items-center gap-3 px-5 py-3.5 bg-[#050040]/5 border border-[#050040]/15 rounded-2xl mb-2">
                    <Sparkles className="w-4 h-4 text-[#050040]" />
                    <span className="text-sm text-[#050040] font-semibold">Sugerencia IA: {session.calendar_events.title}</span>
                    <span className="ml-auto text-sm font-bold text-[#050040]">{session.calendar_match_pct ?? 0}% match</span>
                  </div>
                )}
                {nearbyEvents.length === 0 && (
                  <div className="text-center py-16 text-slate-400">
                    <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-base">No hay eventos cercanos a esta fecha.</p>
                    <p className="text-sm mt-1">Puedes continuar sin asignar evento.</p>
                  </div>
                )}
                {nearbyEvents.map((ev) => {
                  const sel   = selectedCalMatch?.id === ev.id;
                  const diffMs = session?.meeting_date ? Math.abs(new Date(ev.start_at).getTime() - new Date(session.meeting_date).getTime()) : Infinity;
                  const diffH  = Math.round(diffMs / 3600000);
                  return (
                    <button key={ev.id} onClick={() => pickCalMatch(ev)}
                      className={cn("w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center gap-4", sel ? "border-[#050040] bg-[#050040]/5 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm")}>
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors", sel ? "bg-[#050040] text-white" : "bg-slate-100 text-[#050040]")}>
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-base font-bold truncate", sel ? "text-[#050040]" : "text-slate-800")}>{ev.title}</p>
                        <p className="text-sm text-slate-400 mt-0.5">{fmtDate(ev.start_at)} · {fmtTime(ev.start_at)}</p>
                      </div>
                      {diffH < 999 && <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full shrink-0">{diffH < 1 ? "< 1h" : `${diffH}h`} dif.</span>}
                      {sel && <div className="w-6 h-6 rounded-full bg-[#050040] flex items-center justify-center shrink-0"><Check className="w-3.5 h-3.5 text-white" /></div>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Paso 3: Acciones ── */}
            {step === 3 && (
              <div>
                {/* Toolbar */}
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
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar acciones…"
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm placeholder:text-slate-400 outline-none focus:border-[#050040]/40" />
                  </div>
                </div>
                {/* Filtros */}
                <div className="flex items-center gap-2 mb-5 flex-wrap">
                  {([
                    { v: "all"      as const, l: "Todas"      },
                    { v: "task"     as const, l: "Tareas"     },
                    { v: "decision" as const, l: "Decisiones" },
                    { v: "risk"     as const, l: "Riesgos"    },
                    { v: "next_step"as const, l: "Próx. pasos"},
                  ]).map(({ v, l }) => (
                    <button key={v} onClick={() => setFilterType(v)}
                      className={cn("px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                        filterType === v ? "bg-[#050040] text-white shadow-sm" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300")}>
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
                        <p className="text-base">Sin acciones para este filtro</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer navegación ─────────────────────────────────────────── */}
        <div className="bg-white border-t border-slate-100 px-8 py-5 flex items-center justify-between gap-4 shrink-0">
          {step > 0 ? (
            <button onClick={goBack}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 text-base font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <ArrowLeft className="w-5 h-5" />Atrás
            </button>
          ) : <div />}

          {step < 3 ? (
            <button onClick={goNext} disabled={!canProceed()}
              className={cn(
                "flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold transition-all",
                canProceed()
                  ? "bg-[#050040] text-white hover:bg-[#050040]/90 shadow-md shadow-[#050040]/20"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed",
              )}>
              {step === 1 || step === 2 ? "Continuar" : "Siguiente"}
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={handleExecute} disabled={approved.length === 0}
              className={cn(
                "flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold transition-all",
                approved.length > 0
                  ? "bg-[#050040] text-white hover:bg-[#050040]/90 shadow-md shadow-[#050040]/20"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed",
              )}>
              <Play className="w-5 h-5" />
              Aprobar y ejecutar
              {approved.length > 0 && (
                <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1">{approved.length}</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
