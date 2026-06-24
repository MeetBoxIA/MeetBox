"use client";
/**
 * WorkspaceSelectorScreen — full-screen gateway shown before entering the dashboard.
 * User must pick (or create) a workspace to continue.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  DoorOpen, Plus, ChevronRight, ChevronDown, X, LogIn, Sparkles, Check, Pencil,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface WorkspaceInfo {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string | null;
  myRole?: string;
  memberCount?: number;
  ownerName?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const COLORS = ["#050040","#059669","#d97706","#7c3aed","#dc2626","#2563eb","#db2777","#0891b2"];
const EMOJIS = ["🏢","🏛️","💼","🎯","🚀","💡","🔬","📊","🎤","🖥️","📝","☕"];

// ── CreateWorkspaceModal ──────────────────────────────────────────────────────
export function CreateWorkspaceModal({
  onSave,
  onClose,
}: {
  onSave: (data: { name: string; description: string; color: string; emoji: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [name,   setName]   = React.useState("");
  const [desc,   setDesc]   = React.useState("");
  const [color,  setColor]  = React.useState("#050040");
  const [emoji,  setEmoji]  = React.useState("🏢");
  const [saving, setSaving] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), description: desc.trim(), color, emoji });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border border-slate-100 bg-slate-50">
            {emoji}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Crear workspace</h2>
            <p className="text-sm text-slate-400">Tu nuevo espacio de trabajo</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
              Nombre del workspace *
            </label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Marketing Team, Producto Digital…"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-[#050040]/40 focus:ring-2 focus:ring-[#050040]/10"
              required autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
              Descripción (opcional)
            </label>
            <input
              value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="¿Para qué es este workspace?"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-[#050040]/40 focus:ring-2 focus:ring-[#050040]/10"
            />
          </div>

          {/* Emoji */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Emoji</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((em) => (
                <button key={em} type="button" onClick={() => setEmoji(em)}
                  className={cn("w-9 h-9 rounded-lg text-lg flex items-center justify-center border-2 transition-all",
                    emoji === em ? "border-[#050040] bg-[#050040]/5" : "border-slate-100 hover:border-slate-200")}>
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={cn("w-7 h-7 rounded-full border-2 transition-all", color === c ? "border-slate-800 scale-110" : "border-transparent hover:scale-105")}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: color + "20" }}>
              {emoji}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{name || "Nombre del workspace"}</p>
              <p className="text-xs text-slate-400">{desc || "Sin descripción"}</p>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={!name.trim() || saving}
              className={cn("flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all",
                name.trim() && !saving ? "bg-[#050040] text-white hover:bg-[#050040]/90" : "bg-slate-100 text-slate-400 cursor-not-allowed")}>
              {saving ? "Creando…" : "Crear workspace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── JoinWorkspaceModal ──────────────────────────────────────────────────────────
function JoinWorkspaceModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
          <X className="w-4 h-4" />
        </button>
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mb-4">
            <LogIn className="w-7 h-7 text-purple-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Unirte a un workspace</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Pide al administrador o propietario del workspace que te añada como miembro desde su configuración.
          </p>
          <div className="w-full bg-slate-50 rounded-xl p-4 border border-slate-200 text-left mb-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">¿Cómo te añaden?</p>
            <ol className="text-sm text-slate-600 space-y-1.5 list-decimal list-inside">
              <li>El admin entra a su workspace</li>
              <li>Va a la sección <strong>Personas / Miembros</strong></li>
              <li>Hace clic en <strong>+ Añadir miembro</strong></li>
              <li>Introduce tu email para añadirte</li>
            </ol>
          </div>
          <button onClick={onClose}
            className="w-full py-3 rounded-xl bg-[#050040] text-white text-sm font-semibold hover:bg-[#050040]/90 transition-colors">
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

// ── WorkspaceListItem ──────────────────────────────────────────────────────────
function WorkspaceListItem({ workspace, onClick }: { workspace: WorkspaceInfo; onClick: () => void }) {
  const isOwner = workspace.myRole === "owner";
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50/80 transition-all text-left group relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: workspace.color }} />
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 border border-slate-100 bg-slate-50 ml-1">
        {workspace.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-900 truncate">{workspace.name}</span>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border",
            isOwner ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-purple-50 text-purple-700 border-purple-200",
          )}>
            {isOwner ? "Propietario" : "Invitado"}
          </span>
        </div>
        <p className="text-sm text-slate-400 mt-0.5 truncate">
          {!isOwner && workspace.ownerName
            ? `Invitado por ${workspace.ownerName}`
            : workspace.description || "Espacio de trabajo propio"}
        </p>
        <p className="text-xs text-slate-300 mt-0.5">
          {workspace.memberCount ?? 0} miembro{(workspace.memberCount ?? 0) !== 1 ? "s" : ""}
        </p>
      </div>
      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" />
    </button>
  );
}

// ── WorkspaceSelectorScreen ────────────────────────────────────────────────────
export function WorkspaceSelectorScreen({
  onSelect,
}: {
  onSelect: (workspace: WorkspaceInfo) => void;
}) {
  const [owned,      setOwned]      = React.useState<WorkspaceInfo[]>([]);
  const [joined,     setJoined]     = React.useState<WorkspaceInfo[]>([]);
  const [userName,   setUserName]   = React.useState("");
  const [loading,    setLoading]    = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [showJoin,   setShowJoin]   = React.useState(false);

  React.useEffect(() => {
    fetch("/api/rooms")
      .then((r) => r.ok ? r.json() : { rooms: [], joined: [], userName: "" })
      .then((d) => {
        setOwned(d.rooms  ?? []);
        setJoined(d.joined ?? []);
        setUserName(d.userName ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  // Called by CreateWorkspaceModal → onSave prop
  async function handleCreate(data: { name: string; description: string; color: string; emoji: string }) {
    const res = await fetch("/api/rooms", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (!res.ok) return; // modal stays open, user can retry
    const d   = await res.json();
    const newWs: WorkspaceInfo = { ...d.room, myRole: "owner", memberCount: 0 };
    // Close modal first, then navigate — both batched by React 18
    setShowCreate(false);
    onSelect(newWs);
  }

  const firstName  = userName.split(" ")[0] || "tú";
  const hasSpaces  = owned.length > 0 || joined.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-8">
      {/* Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 w-full max-w-2xl overflow-hidden animate-[fadeUp_.3s_ease_both]"
        style={{ animation: "fadeUp .3s ease both" }}>

        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {/* Header */}
        <div className="px-8 sm:px-12 pt-10 pb-6 text-center border-b border-slate-50">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <DoorOpen className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            ¡Bienvenid@, {firstName}! 👋
          </h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-sm mx-auto">
            {hasSpaces
              ? "Estos son tus espacios de trabajo. Elige en cuál quieres continuar."
              : "Para empezar, elige o crea tu espacio de trabajo.\nDesde allí podrás colaborar, organizar y alcanzar tus objetivos."}
          </p>
        </div>

        {/* Body */}
        <div className="px-8 sm:px-12 py-8">
          {loading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !hasSpaces ? (
            /* ── Empty state ── */
            <div className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/undraw_collaboration_hkrb.svg" alt=""
                className="w-48 h-auto mb-8 opacity-80 select-none" draggable={false} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                {/* Join */}
                <button onClick={() => setShowJoin(true)}
                  className="flex items-center gap-4 p-5 rounded-xl border-2 border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 text-left transition-all group relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-l-xl" />
                  <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0 ml-1">
                    <LogIn className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm">Unirme a un workspace</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Únete a un espacio existente con una invitación.
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>

                {/* Create */}
                <button onClick={() => setShowCreate(true)}
                  className="flex items-center gap-4 p-5 rounded-xl border-2 border-slate-100 hover:border-purple-200 hover:bg-purple-50/30 text-left transition-all group relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 rounded-l-xl" />
                  <div className="w-11 h-11 bg-purple-50 rounded-xl flex items-center justify-center shrink-0 ml-1">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm">Crear un workspace</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Crea tu propio espacio de trabajo desde cero.
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              </div>

              <p className="text-center text-xs text-slate-300 mt-6">
                Siempre puedes crear o unirte a un workspace más tarde desde el menú.
              </p>
            </div>
          ) : (
            /* ── Has workspaces ── */
            <div className="space-y-6">
              {owned.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Mis workspaces</p>
                  <div className="space-y-2">
                    {owned.map((ws) => (
                      <WorkspaceListItem key={ws.id} workspace={ws} onClick={() => onSelect(ws)} />
                    ))}
                  </div>
                </div>
              )}

              {joined.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Workspaces en los que participas
                  </p>
                  <div className="space-y-2">
                    {joined.map((ws) => (
                      <WorkspaceListItem key={ws.id} workspace={ws} onClick={() => onSelect(ws)} />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-50">
                <button onClick={() => setShowJoin(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
                  <Plus className="w-4 h-4" />Unirse a otro workspace
                </button>
                <button onClick={() => setShowCreate(true)}
                  className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                  Crear un nuevo workspace
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateWorkspaceModal onSave={handleCreate} onClose={() => setShowCreate(false)} />
      )}
      {showJoin && <JoinWorkspaceModal onClose={() => setShowJoin(false)} />}
    </div>
  );
}

// ── EditWorkspaceModal ─────────────────────────────────────────────────────────
function EditWorkspaceModal({
  workspace,
  onSave,
  onClose,
}: {
  workspace: WorkspaceInfo;
  onSave:    (updated: WorkspaceInfo) => void;
  onClose:   () => void;
}) {
  const [name,    setName]    = React.useState(workspace.name);
  const [desc,    setDesc]    = React.useState(workspace.description ?? "");
  const [emoji,   setEmoji]   = React.useState(workspace.emoji ?? "🏢");
  const [color,   setColor]   = React.useState(workspace.color ?? "#050040");
  const [saving,  setSaving]  = React.useState(false);
  const [error,   setError]   = React.useState("");

  const COLORS = ["#050040","#0f766e","#7c3aed","#be123c","#b45309","#1d4ed8","#15803d","#0e7490"];
  const EMOJIS = ["🏢","🚀","💡","🎯","⚡","🔥","🌊","🏆","💎","🌟","🦄","🛠️","📊","🎨","🤝","🔬"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/rooms/${workspace.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: name.trim(), description: desc.trim() || null, emoji, color }),
    });
    setSaving(false);
    if (!res.ok) { setError("Error al guardar. Intenta de nuevo."); return; }
    const d = await res.json();
    onSave({ ...workspace, ...d.room });
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-lg font-bold text-slate-900">Editar workspace</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 pb-6 space-y-5">
          {/* Preview */}
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl border border-slate-200"
              style={{ backgroundColor: color + "20" }}>
              {emoji}
            </div>
            <div>
              <p className="font-bold text-slate-900 text-base leading-tight">{name || "Nombre del workspace"}</p>
              {desc && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{desc}</p>}
            </div>
          </div>

          {/* Emoji picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Icono</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button type="button" key={e} onClick={() => setEmoji(e)}
                  className={cn("w-9 h-9 rounded-xl text-lg transition-all", emoji === e ? "ring-2 ring-[#050040] bg-[#050040]/10 scale-110" : "hover:bg-slate-100")}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button type="button" key={c} onClick={() => setColor(c)}
                  className={cn("w-7 h-7 rounded-full transition-all border-2", color === c ? "border-slate-900 scale-110" : "border-transparent hover:scale-105")}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#050040]/20 focus:border-[#050040]"
              placeholder="Nombre del workspace" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Descripción <span className="text-slate-400 normal-case font-normal">(opcional)</span></label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} maxLength={200}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#050040]/20 focus:border-[#050040] resize-none"
              placeholder="¿Para qué es este workspace?" />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: color }}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── WorkspaceSwitcher (sidebar widget) ────────────────────────────────────────
export function WorkspaceSwitcher({
  active,
  all,
  onUpdate,
  onSwitch,
  onBack,
}: {
  active:    WorkspaceInfo;
  all:       WorkspaceInfo[];
  onUpdate:  (updated: WorkspaceInfo) => void;
  onSwitch:  (ws: WorkspaceInfo) => void;
  onBack:    () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [open,    setOpen]    = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const isOwner = active.myRole === "owner";

  React.useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <>
      <div ref={ref} className="relative px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50/80">
          {/* Emoji */}
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 border border-slate-100"
            style={{ backgroundColor: active.color + "15" }}>
            {active.emoji}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate leading-tight">{active.name}</p>
            <p className="text-[10px] font-semibold leading-tight mt-0.5"
              style={{ color: isOwner ? "#059669" : "#7c3aed" }}>
              {isOwner ? "Propietario" : "Invitado"}
            </p>
          </div>

          {/* Edit (solo propietario) */}
          {isOwner && (
            <button onClick={() => setEditing(true)}
              className="w-7 h-7 rounded-lg hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0"
              title="Editar workspace">
              <Pencil className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}

          {/* Chevron — despliega lista de workspaces */}
          <button onClick={() => setOpen((o) => !o)}
            className="w-7 h-7 rounded-lg hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0"
            title="Cambiar workspace">
            <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", open && "rotate-180")} />
          </button>
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute left-4 right-4 top-full mt-1 z-50 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1.5">
                Mis workspaces
              </p>
              {all.map((ws) => {
                const isCurrent = ws.id === active.id;
                return (
                  <button key={ws.id}
                    onClick={() => { onSwitch(ws); setOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors text-left",
                      isCurrent ? "bg-[#050040]/5" : "hover:bg-slate-50",
                    )}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 border border-slate-100"
                      style={{ backgroundColor: ws.color + "15" }}>
                      {ws.emoji}
                    </div>
                    <span className={cn("text-sm flex-1 truncate font-medium", isCurrent ? "text-[#050040] font-semibold" : "text-slate-700")}>
                      {ws.name}
                    </span>
                    {isCurrent && <Check className="w-3.5 h-3.5 text-[#050040] shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-100 p-2">
              <button onClick={() => { onBack(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                <DoorOpen className="w-3.5 h-3.5" />Ver todas las rooms
              </button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <EditWorkspaceModal
          workspace={active}
          onSave={(updated) => { onUpdate(updated); setEditing(false); }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
