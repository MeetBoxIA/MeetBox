"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Bell, Plus, X, Check, Trash2, Clock,
  Sparkles, CalendarClock, AlertCircle, Pencil,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useNotifications } from "@/lib/notifications";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Reminder {
  id:         string;
  title:      string;
  source:     "ai" | "manual";
  session_id: string | null;
  deadline:   string | null;
  completed:  boolean;
  created_at: string;
}

type Filter = "all" | "pending" | "done" | "deadline" | "ai";

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDeadline(iso: string): { label: string; urgent: boolean } {
  const d    = new Date(iso);
  const now  = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / 86400000);
  if (diff < 0)   return { label: "Vencido",          urgent: true  };
  if (days === 0) return { label: "Hoy",              urgent: true  };
  if (days === 1) return { label: "Mañana",           urgent: true  };
  if (days <= 7)  return { label: `En ${days} días`,  urgent: false };
  return { label: d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }), urgent: false };
}

// ── QuickAdd ───────────────────────────────────────────────────────────────────
function QuickAdd({ onSave }: { onSave: (r: Reminder) => void }) {
  const [open,     setOpen]     = React.useState(false);
  const [title,    setTitle]    = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [saving,   setSaving]   = React.useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  function expand() { setOpen(true); setTimeout(() => inputRef.current?.focus(), 80); }

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/recordatorios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), source: "manual", deadline: deadline || null }),
    });
    if (res.ok) {
      const d = await res.json();
      onSave(d.reminder);
      setTitle(""); setDeadline(""); setOpen(false);
    }
    setSaving(false);
  }

  return (
    <AnimatePresence mode="wait">
      {!open ? (
        <motion.button
          key="trigger"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          onClick={expand}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#050040]/30 hover:bg-[#050040]/3 text-slate-400 hover:text-[#050040] transition-all group"
        >
          <div className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <Plus className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-medium">Añadir recordatorio…</span>
        </motion.button>
      ) : (
        <motion.div
          key="form"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div className="bg-white border-2 border-[#050040]/20 rounded-2xl p-4 space-y-3 shadow-sm">
            <textarea
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === "Escape") { setOpen(false); setTitle(""); } }}
              placeholder="¿Qué no debes olvidar?"
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 focus:ring-2 focus:ring-[#050040]/8 transition resize-none"
            />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <CalendarClock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 outline-none focus:border-[#050040]/50 transition"
                />
              </div>
              <button onClick={() => { setOpen(false); setTitle(""); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={submit}
                disabled={saving || !title.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#050040] text-white text-sm font-semibold hover:bg-[#050040]/90 disabled:opacity-50 transition"
              >
                {saving ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Guardar
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── SwipeCard ──────────────────────────────────────────────────────────────────
const SWIPE_THRESHOLD = 88;

function SwipeCard({ reminder, onToggle, onDelete, onEdit, onOpenMeety, index }: {
  reminder:    Reminder;
  onToggle:    (id: string, done: boolean) => void;
  onDelete:    (id: string) => void;
  onEdit:      (id: string, title: string, deadline: string | null) => void;
  onOpenMeety?: (msg: string) => void;
  index:       number;
}) {
  const [editing,   setEditing]   = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(reminder.title);
  const [editDl,    setEditDl]    = React.useState(
    reminder.deadline ? new Date(reminder.deadline).toISOString().slice(0, 16) : ""
  );
  const [saving,  setSaving]  = React.useState(false);
  const [exiting, setExiting] = React.useState(false);

  const x         = useMotionValue(0);
  const bgOpacity = useTransform(x, [-130, -SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD, 130], [1, 0.8, 0, 0.8, 1]);
  const redOp     = useTransform(x, [-130, -20, 0], [1, 0.4, 0]);
  const greenOp   = useTransform(x, [0, 20, 130], [0, 0.4, 1]);
  const cardScale = useTransform(x, [-130, 0, 130], [0.97, 1, 0.97]);

  const dl = reminder.deadline ? fmtDeadline(reminder.deadline) : null;

  async function saveEdit() {
    if (!editTitle.trim()) return;
    setSaving(true);
    await onEdit(reminder.id, editTitle.trim(), editDl || null);
    setSaving(false);
    setEditing(false);
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x < -SWIPE_THRESHOLD) {
      setExiting(true);
      setTimeout(() => onDelete(reminder.id), 300);
    } else if (info.offset.x > SWIPE_THRESHOLD) {
      setExiting(true);
      setTimeout(() => onToggle(reminder.id, true), 300);
    }
  }

  const accentColor = reminder.completed
    ? "#10b981"
    : dl?.urgent
      ? "#ef4444"
      : reminder.source === "ai"
        ? "#6366f1"
        : "#e2e8f0";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={exiting ? { opacity: 0, x: x.get() < 0 ? -200 : 200, scale: 0.9 } : { opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, scale: 0.95 }}
      transition={{
        layout: { duration: 0.25 },
        delay: index * 0.04,
        duration: 0.3,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="relative"
    >
      {/* Background action layer */}
      <motion.div
        className="absolute inset-0 rounded-2xl flex items-center justify-between px-5 pointer-events-none"
        style={{ opacity: bgOpacity }}
      >
        <motion.div className="flex items-center gap-2" style={{ opacity: greenOp }}>
          <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
            <Check className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-emerald-700 text-sm font-bold">Completar</span>
        </motion.div>
        <motion.div className="flex items-center gap-2" style={{ opacity: redOp }}>
          <span className="text-red-600 text-sm font-bold">Eliminar</span>
          <div className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center shadow-md">
            <Trash2 className="w-4.5 h-4.5 text-white" />
          </div>
        </motion.div>
      </motion.div>

      {/* Card */}
      <motion.div
        drag={editing ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDragEnd={handleDragEnd}
        style={{ x, scale: cardScale }}
        whileTap={editing ? {} : { cursor: "grabbing" }}
        className={cn(
          "relative bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden cursor-default",
          "hover:shadow-md transition-shadow",
          reminder.completed && "opacity-70",
        )}
      >
        {/* Left accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-colors duration-500"
          style={{ backgroundColor: accentColor }}
        />

        <div className="pl-5 pr-4 py-4 flex items-start gap-3">
          {/* Check circle */}
          <motion.button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onToggle(reminder.id, !reminder.completed)}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            className={cn(
              "mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
              reminder.completed ? "bg-emerald-500 border-emerald-500" : "border-slate-300 hover:border-emerald-400",
            )}
          >
            <AnimatePresence>
              {reminder.completed && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-2" onPointerDown={(e) => e.stopPropagation()}>
                <textarea
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === "Escape") { setEditing(false); setEditTitle(reminder.title); } }}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 outline-none focus:border-[#050040]/50 resize-none"
                />
                <input
                  type="datetime-local"
                  value={editDl}
                  onChange={(e) => setEditDl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600 outline-none focus:border-[#050040]/50"
                />
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving || !editTitle.trim()}
                    className="px-3 py-1.5 rounded-lg bg-[#050040] text-white text-xs font-semibold disabled:opacity-50 transition">
                    {saving ? "…" : "Guardar"}
                  </button>
                  <button onClick={() => { setEditing(false); setEditTitle(reminder.title); }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs hover:bg-slate-50 transition">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className={cn("text-sm font-medium leading-snug", reminder.completed ? "line-through text-slate-400" : "text-slate-800")}>
                  {reminder.title}
                </p>

                {/* Badges */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {reminder.source === "ai" ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-semibold">
                      <Sparkles className="w-2.5 h-2.5" />IA
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold">
                      Manual
                    </span>
                  )}
                  {dl && (
                    <span className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
                      dl.urgent ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600",
                    )}>
                      {dl.urgent && <AlertCircle className="w-2.5 h-2.5" />}
                      <Clock className="w-2.5 h-2.5" />{dl.label}
                    </span>
                  )}
                </div>

                {/* Meety help button */}
                {!reminder.completed && onOpenMeety && (
                  <motion.button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onOpenMeety(`Necesito ayuda para completar este recordatorio: "${reminder.title}"`)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#050040]/5 hover:bg-[#050040]/10 text-[#050040] text-[11px] font-semibold transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    ¿Quieres que Meety te ayude?
                  </motion.button>
                )}
              </>
            )}
          </div>

          {/* Edit button (hover) */}
          {!editing && !reminder.completed && (
            <motion.button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setEditing(true)}
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-300 hover:text-slate-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
              style={{ opacity: undefined }}
            >
              <Pencil className="w-3.5 h-3.5" />
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── SwipeHint ──────────────────────────────────────────────────────────────────
function SwipeHint() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    try {
      if (!localStorage.getItem("meetbox_swipe_hint_seen")) {
        setTimeout(() => setVisible(true), 800);
      }
    } catch { /* ignore */ }
  }, []);

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem("meetbox_swipe_hint_seen", "1"); } catch { /* ignore */ }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#050040]/5 border border-[#050040]/10 text-xs text-[#050040]"
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium">
              <motion.div animate={{ x: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}>
                <ChevronRight className="w-3.5 h-3.5 text-emerald-500" />
              </motion.div>
              Desliza derecha para completar
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <motion.div animate={{ x: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}>
                <ChevronLeft className="w-3.5 h-3.5 text-red-500" />
              </motion.div>
              Desliza izquierda para eliminar
            </span>
          </div>
          <button onClick={dismiss} className="p-1 rounded-lg hover:bg-[#050040]/10 transition-colors shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── ProgressRing ───────────────────────────────────────────────────────────────
function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct  = total === 0 ? 0 : Math.round((done / total) * 100);
  const r    = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
        <motion.circle
          cx="24" cy="24" r={r} fill="none"
          stroke={pct === 100 ? "#10b981" : "#050040"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold text-slate-700">{pct}%</span>
      </div>
    </div>
  );
}

// ── RecordatoriosView ──────────────────────────────────────────────────────────
export default function RecordatoriosView({ onOpenMeety }: { onOpenMeety?: (msg: string) => void }) {
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [loading,   setLoading]   = React.useState(true);
  const [filter,    setFilter]    = React.useState<Filter>("pending");
  const { addNotification } = useNotifications();

  React.useEffect(() => {
    fetch("/api/recordatorios")
      .then((r) => r.ok ? r.json() : { reminders: [] })
      .then((d) => setReminders(d.reminders ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(id: string, completed: boolean) {
    const res = await fetch(`/api/recordatorios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    if (res.ok) {
      setReminders((p) => p.map((r) => r.id === id ? { ...r, completed } : r));
      if (completed) addNotification({ title: "Recordatorio completado", description: "", type: "event" });
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/recordatorios/${id}`, { method: "DELETE" });
    setReminders((p) => p.filter((r) => r.id !== id));
    addNotification({ title: "Recordatorio eliminado", description: "", type: "event" });
  }

  async function handleEdit(id: string, title: string, deadline: string | null) {
    const res = await fetch(`/api/recordatorios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, deadline }),
    });
    if (res.ok) {
      const d = await res.json();
      setReminders((p) => p.map((r) => r.id === id ? d.reminder : r));
    }
  }

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "pending",  label: "Pendientes"  },
    { id: "all",      label: "Todos"       },
    { id: "done",     label: "Completados" },
    { id: "deadline", label: "Con fecha"   },
    { id: "ai",       label: "De IA"       },
  ];

  const counts: Record<Filter, number> = {
    all:      reminders.length,
    pending:  reminders.filter((r) => !r.completed).length,
    done:     reminders.filter((r) => r.completed).length,
    deadline: reminders.filter((r) => !!r.deadline && !r.completed).length,
    ai:       reminders.filter((r) => r.source === "ai").length,
  };

  const filtered = reminders.filter((r) => {
    if (filter === "pending")  return !r.completed;
    if (filter === "done")     return r.completed;
    if (filter === "deadline") return !!r.deadline;
    if (filter === "ai")       return r.source === "ai";
    return true;
  });

  const urgent = reminders.filter((r) => r.deadline && !r.completed && fmtDeadline(r.deadline).urgent).length;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">

      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-100 px-6 py-5 shrink-0">
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#050040] to-indigo-600 flex items-center justify-center shadow-sm shrink-0"
          >
            <Bell className="w-5 h-5 text-white" />
          </motion.div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">Recordatorios</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {counts.pending > 0
                ? `${counts.pending} pendiente${counts.pending !== 1 ? "s" : ""}`
                : "Todo al día ✓"}
              {urgent > 0 && (
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="ml-2 text-red-500 font-semibold"
                >
                  · {urgent} urgente{urgent !== 1 ? "s" : ""}
                </motion.span>
              )}
            </p>
          </div>

          {reminders.length > 0 && (
            <ProgressRing done={counts.done} total={counts.all} />
          )}
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 mt-4 overflow-x-auto pb-0.5 scrollbar-none">
          {FILTERS.map((f) => (
            <motion.button
              key={f.id}
              onClick={() => setFilter(f.id)}
              layout
              className={cn(
                "relative px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors",
                filter === f.id ? "text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
              )}
            >
              {filter === f.id && (
                <motion.div
                  layoutId="filterBg"
                  className="absolute inset-0 rounded-xl bg-[#050040]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative">
                {f.label}
                {counts[f.id] > 0 && (
                  <span className={cn(
                    "ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                    filter === f.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600",
                  )}>
                    {counts[f.id]}
                  </span>
                )}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
              className="w-7 h-7 border-2 border-slate-200 border-t-[#050040] rounded-full"
            />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-2.5">
            {/* Quick add */}
            <QuickAdd onSave={(r) => {
              setReminders((p) => [r, ...p]);
              addNotification({ title: "Recordatorio creado", description: "", type: "event" });
            }} />

            {/* Swipe hint */}
            {counts.pending > 0 && <SwipeHint />}

            {/* Cards */}
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                    className="w-16 h-16 rounded-3xl bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-4"
                  >
                    <Bell className="w-7 h-7 text-slate-300" />
                  </motion.div>
                  <p className="text-base font-semibold text-slate-600">
                    {filter === "pending" ? "Sin recordatorios pendientes" : "Nada aquí por ahora"}
                  </p>
                  <p className="text-sm text-slate-400 mt-1 max-w-xs">
                    {filter === "pending"
                      ? "La IA añadirá recordatorios de tus reuniones automáticamente."
                      : "Cambia el filtro o crea uno nuevo."}
                  </p>
                </motion.div>
              ) : (
                filtered.map((r, i) => (
                  <SwipeCard
                    key={r.id}
                    reminder={r}
                    index={i}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onOpenMeety={onOpenMeety}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
