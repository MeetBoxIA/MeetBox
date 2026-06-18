"use client";
/**
 * RoomsView — salas de equipo con vista detalle rediseñada.
 * Detalle: panel izquierdo Personas (tarjetas grandes + email) |
 *          panel derecho Reuniones de la sala (timeline).
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Plus, X, ChevronLeft, Trash2, Check, Clock,
  MapPin, DoorOpen, Video, Calendar,
  AlignLeft, Pencil, Mail, Users, ChevronDown, ChevronRight,
  UserPlus, Building2,
} from "lucide-react";
import { useNotifications } from "@/lib/notifications";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Room {
  id: string; name: string; description: string | null;
  color: string; emoji: string; created_at: string;
}
interface RoomMember { id: string; name: string; email: string; }
interface RoomMeeting {
  id: string; title: string; start_at: string; end_at: string | null;
  all_day: boolean; color: string; location: string | null; description: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const ROOM_COLORS = ["#050040","#059669","#d97706","#7c3aed","#dc2626","#2563eb","#db2777","#0891b2"];
const ROOM_EMOJIS = ["🏢","🏛️","💼","🎯","🚀","💡","🔬","📊","🎤","🖥️","📝","☕"];

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function todayRange() {
  const d = new Date(); const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
  return { start: new Date(y,m,day,0,0,0).toISOString(), end: new Date(y,m,day,23,59,59).toISOString() };
}
function initials(name: string) {
  return name.split(" ").slice(0,2).map(n => n[0]).join("").toUpperCase();
}
function localOffsetStr() {
  const off = -new Date().getTimezoneOffset(), sign = off >= 0 ? "+" : "-", abs = Math.abs(off);
  return `${sign}${String(Math.floor(abs/60)).padStart(2,"0")}:${String(abs%60).padStart(2,"0")}`;
}
function avatarColor(name: string, baseColor: string): string {
  // Derive a variation of the room color for each member
  const idx = name.charCodeAt(0) % 4;
  const opacities = ["FF", "EE", "DD", "CC"];
  return baseColor + opacities[idx];
}

const ANIM = `@keyframes rmFade{from{opacity:0;transform:scale(0.97) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}`;

// ── RoomFormModal ──────────────────────────────────────────────────────────────
function RoomFormModal({ initial, onSave, onClose }: {
  initial?: Room;
  onSave: (data: { name: string; description: string; color: string; emoji: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [name,        setName]        = React.useState(initial?.name        ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [color,       setColor]       = React.useState(initial?.color       ?? "#050040");
  const [emoji,       setEmoji]       = React.useState(initial?.emoji       ?? "🏢");
  const [saving,      setSaving]      = React.useState(false);

  async function submit() {
    if (!name.trim()) return; setSaving(true);
    await onSave({ name: name.trim(), description, color, emoji }); setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <style>{ANIM}</style>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ animation: "rmFade 0.2s cubic-bezier(0.16,1,0.3,1) both" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: color + "22" }}>{emoji}</div>
            <h2 className="text-base font-semibold text-slate-800">{initial ? "Editar sala" : "Nueva sala"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Icono</label>
            <div className="flex flex-wrap gap-1.5">
              {ROOM_EMOJIS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)}
                  className={cn("w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all", emoji === e ? "ring-2 ring-[#050040]/40" : "hover:bg-slate-100")}
                  style={emoji === e ? { backgroundColor: color + "22" } : {}}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nombre</label>
            <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="Ej. Sala de juntas A"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 focus:ring-2 focus:ring-[#050040]/8 transition" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5"><AlignLeft className="w-3.5 h-3.5 inline mr-1 text-slate-400" />Descripción (opcional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Capacidad, equipamiento, etc." rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 transition resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {ROOM_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className="w-7 h-7 rounded-full transition-transform hover:scale-110 border-2"
                  style={{ backgroundColor: c, borderColor: color === c ? "#000" : "transparent" }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
          <button onClick={submit} disabled={saving || !name.trim()}
            className="px-4 py-2 rounded-xl bg-[#050040] text-white text-sm font-semibold hover:bg-[#050040]/90 disabled:opacity-50 transition">
            {saving ? "Guardando…" : initial ? "Guardar" : "Crear sala"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MeetingFormModal ──────────────────────────────────────────────────────────
function MeetingFormModal({ roomId, roomColor, initial, onSave, onClose }: {
  roomId: string; roomColor: string;
  initial?: RoomMeeting;
  onSave: (ev: RoomMeeting) => void; onClose: () => void;
}) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  function parseDate(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function parseTime(iso: string) {
    const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const todayStr  = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const roundMin  = Math.ceil(now.getMinutes() / 30) * 30;
  const sh = roundMin === 60 ? now.getHours() + 1 : now.getHours();
  const sm = roundMin === 60 ? 0 : roundMin;
  const defStart  = `${pad(sh % 24)}:${pad(sm)}`;
  const defEnd    = `${pad((sh + 1) % 24)}:${pad(sm)}`;

  const [title,   setTitle]   = React.useState(initial?.title ?? "");
  const [date,    setDate]    = React.useState(initial ? parseDate(initial.start_at) : todayStr);
  const [startT,  setStartT]  = React.useState(initial ? parseTime(initial.start_at) : defStart);
  const [endT,    setEndT]    = React.useState(initial?.end_at ? parseTime(initial.end_at) : defEnd);
  const [loc,     setLoc]     = React.useState(initial?.location ?? "");
  const [desc,    setDesc]    = React.useState(initial?.description ?? "");
  const [saving,  setSaving]  = React.useState(false);

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    const tz       = localOffsetStr();
    const start_at = `${date}T${startT}:00${tz}`;
    const end_at   = endT ? `${date}T${endT}:00${tz}` : null;

    if (initial) {
      const res = await fetch(`/api/meetcalendar/events/${initial.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), start_at, end_at,
          location: loc.trim() || null, description: desc.trim() || null,
        }),
      });
      if (res.ok) { const d = await res.json(); onSave(d.event); }
    } else {
      const res = await fetch("/api/meetcalendar/events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), type: "meeting",
          start_at, end_at, all_day: false, color: roomColor,
          location: loc.trim() || null, description: desc.trim() || null,
          notify_email: true, notify_minutes: 15, room_id: roomId,
        }),
      });
      if (res.ok) { const d = await res.json(); onSave(d.event); }
    }
    setSaving(false);
  }

  const isEdit = !!initial;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <style>{ANIM}</style>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ animation: "rmFade 0.2s cubic-bezier(0.16,1,0.3,1) both" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: roomColor + "20" }}>
              <Video className="w-4 h-4" style={{ color: roomColor }} />
            </div>
            <h2 className="text-base font-semibold text-slate-800">
              {isEdit ? "Editar reunión" : "Nueva reunión"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Título *</label>
            <input autoFocus type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="Nombre de la reunión"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 focus:ring-2 focus:ring-[#050040]/8 transition" />
          </div>

          {/* Date + times */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fecha</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 outline-none focus:border-[#050040]/50 transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Inicio</label>
              <input type="time" value={startT} onChange={(e) => setStartT(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 outline-none focus:border-[#050040]/50 transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fin</label>
              <input type="time" value={endT} onChange={(e) => setEndT(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 outline-none focus:border-[#050040]/50 transition" />
            </div>
            <div />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ubicación <span className="font-normal text-slate-400">(opcional)</span></label>
            <input type="text" value={loc} onChange={(e) => setLoc(e.target.value)}
              placeholder="Sala, enlace o dirección"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 transition" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Descripción <span className="font-normal text-slate-400">(opcional)</span></label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}
              placeholder="Agenda, participantes, notas previas…"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 transition resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            Cancelar
          </button>
          <button onClick={submit} disabled={saving || !title.trim()}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition"
            style={{ backgroundColor: roomColor }}>
            {saving ? "Guardando…" : isEdit ? <><Check className="w-4 h-4" />Guardar cambios</> : <><Plus className="w-4 h-4" />Crear reunión</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MemberCard ─────────────────────────────────────────────────────────────────
function MemberCard({ member, roomId, roomColor, onUpdate, onRemove }: {
  member: RoomMember; roomId: string; roomColor: string;
  onUpdate: (m: RoomMember) => void; onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [name,    setName]    = React.useState(member.name);
  const [email,   setEmail]   = React.useState(member.email);
  const [saving,  setSaving]  = React.useState(false);

  async function save() {
    if (!name.trim() || !email.trim()) return; setSaving(true);
    const res = await fetch(`/api/rooms/${roomId}/members/${member.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim() }),
    });
    if (res.ok) { const d = await res.json(); onUpdate(d.member); setEditing(false); }
    setSaving(false);
  }

  async function remove() {
    await fetch(`/api/rooms/${roomId}/members/${member.id}`, { method: "DELETE" });
    onRemove(member.id);
  }

  if (editing) {
    return (
      <div className="rounded-2xl border-2 border-[#050040]/20 bg-white p-4 space-y-3">
        <p className="text-xs font-bold text-[#050040] uppercase tracking-wide">Editar persona</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo"
          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 transition" />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setName(member.name); setEmail(member.email); } }}
          placeholder="correo@ejemplo.com"
          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 transition" />
        <div className="flex gap-2">
          <button onClick={save} disabled={saving || !name.trim() || !email.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#050040] text-white text-sm font-semibold hover:bg-[#050040]/90 disabled:opacity-50 transition">
            <Check className="w-4 h-4" />Guardar
          </button>
          <button onClick={() => { setEditing(false); setName(member.name); setEmail(member.email); }}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all p-4">
      <div className="flex items-start gap-4">
        {/* Big avatar */}
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shrink-0 shadow-sm"
          style={{ backgroundColor: roomColor }}>
          {initials(member.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-slate-800 leading-tight">{member.name}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <Mail className="w-2.5 h-2.5 text-slate-500" />
            </div>
            <p className="text-sm text-slate-500 truncate">{member.email}</p>
          </div>
        </div>
        {/* Actions on hover */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => setEditing(true)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-[#050040] transition-colors" title="Editar">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={remove}
            className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Eliminar">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AddMemberForm ──────────────────────────────────────────────────────────────
function AddMemberForm({ roomId, onAdd, onCancel }: {
  roomId: string; onAdd: (m: RoomMember) => void; onCancel: () => void;
}) {
  const [name,  setName]  = React.useState("");
  const [email, setEmail] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  async function submit() {
    if (!name.trim() || !email.trim()) return; setAdding(true);
    const res = await fetch(`/api/rooms/${roomId}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim() }),
    });
    if (res.ok) { const d = await res.json(); onAdd(d.member); }
    setAdding(false);
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-[#050040]/30 bg-[#050040]/3 p-5 space-y-3">
      <p className="text-sm font-bold text-[#050040]">Nueva persona</p>
      <div className="space-y-2.5">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nombre completo</label>
          <input id="add-name-input" autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Ej. María García"
            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 focus:ring-2 focus:ring-[#050040]/8 transition" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Correo electrónico</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
            placeholder="correo@empresa.com"
            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 focus:ring-2 focus:ring-[#050040]/8 transition" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={adding || !name.trim() || !email.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#050040] text-white text-sm font-semibold hover:bg-[#050040]/90 disabled:opacity-50 transition">
          <UserPlus className="w-4 h-4" />{adding ? "Añadiendo…" : "Añadir persona"}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── RoomDetail (rediseñado) ────────────────────────────────────────────────────
function RoomDetail({ room, onBack, onEdit, onDelete }: {
  room: Room; onBack: () => void; onEdit: (r: Room) => void; onDelete: (id: string) => void;
}) {
  const { addNotification } = useNotifications();
  const [confirmDel,     setConfirmDel]     = React.useState(false);
  const [members,        setMembers]        = React.useState<RoomMember[]>([]);
  const [membersLoad,    setMembersLoad]    = React.useState(true);
  const [showAddForm,    setShowAddForm]    = React.useState(false);
  const [meetings,       setMeetings]       = React.useState<RoomMeeting[]>([]);
  const [meetLoad,       setMeetLoad]       = React.useState(true);
  const [showNewMeet,    setShowNewMeet]    = React.useState(false);
  const [editingMeeting, setEditingMeeting] = React.useState<RoomMeeting | null>(null);
  const [deletingMeetId, setDeletingMeetId] = React.useState<string | null>(null);
  const [expandedMeet,   setExpandedMeet]   = React.useState<string | null>(null);

  // Load members
  React.useEffect(() => {
    setMembersLoad(true);
    fetch(`/api/rooms/${room.id}/members`)
      .then((r) => r.ok ? r.json() : { members: [] })
      .then((d) => setMembers(d.members ?? []))
      .finally(() => setMembersLoad(false));
  }, [room.id]);

  // Load meetings — past 7 days through next 60 days
  React.useEffect(() => { loadMeetings(); }, [room.id]);
  async function loadMeetings() {
    setMeetLoad(true);
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 60, 23, 59, 59).toISOString();
    const res = await fetch(
      `/api/meetcalendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&room_id=${room.id}`,
    );
    if (res.ok) {
      const d = await res.json();
      setMeetings(
        ((d.events ?? []) as RoomMeeting[])
          .filter((e) => (e as unknown as { type: string }).type === "meeting")
          .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
      );
    }
    setMeetLoad(false);
  }

  async function deleteMeeting(id: string) {
    const meeting = meetings.find((m) => m.id === id);
    const res = await fetch(`/api/meetcalendar/events/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMeetings((p) => p.filter((m) => m.id !== id));
      setDeletingMeetId(null);
      addNotification({
        title: "Reunión eliminada",
        description: meeting?.title ?? "Reunión eliminada del workspace",
        type: "event",
      });
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ animation: "rmFade 0.2s ease both" }}>
      <style>{ANIM}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-6 py-5 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Room badge */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
              style={{ backgroundColor: room.color + "18" }}>{room.emoji}</div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-slate-900 leading-tight">{room.name}</h2>
              {room.description && <p className="text-sm text-slate-400 mt-0.5 truncate">{room.description}</p>}
            </div>
          </div>

          {/* Stats pills */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">{members.length} personas</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <Video className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">{meetings.length} reunión{meetings.length !== 1 ? "es" : ""}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => onEdit(room)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 text-sm font-medium">
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Editar</span>
            </button>
            <button onClick={() => setConfirmDel(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors text-slate-400 text-sm font-medium">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Two-panel body ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex">

        {/* ── Left: Personas en la sala ──────────────────────────────── */}
        <div className="w-[48%] shrink-0 border-r border-slate-100 flex flex-col overflow-hidden">
          {/* Section header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: room.color + "18" }}>
                <Users className="w-4 h-4" style={{ color: room.color }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Personas en la sala</h3>
                <p className="text-xs text-slate-400">{members.length} miembro{members.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <button
              onClick={() => { setShowAddForm(true); setTimeout(() => document.getElementById("add-name-input")?.focus(), 80); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: room.color + "15", color: room.color }}>
              <UserPlus className="w-4 h-4" />Añadir
            </button>
          </div>

          {/* Scrollable member list */}
          <div className="flex-1 overflow-y-auto px-5 py-4 bg-slate-50 space-y-3">
            {membersLoad && (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-[#050040] rounded-full animate-spin" />
              </div>
            )}

            {!membersLoad && showAddForm && (
              <AddMemberForm roomId={room.id}
                onAdd={(m) => { setMembers((p) => [...p, m]); setShowAddForm(false); }}
                onCancel={() => setShowAddForm(false)} />
            )}

            {!membersLoad && members.length === 0 && !showAddForm && (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/undraw_meet-the-team_fau8.svg" alt="" className="w-44 h-auto mb-5 opacity-80" draggable={false} />
                <p className="text-base font-semibold text-slate-600">Sin personas asignadas</p>
                <p className="text-sm text-slate-400 mt-1">Añade los miembros de este equipo</p>
                <button onClick={() => setShowAddForm(true)}
                  className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  style={{ backgroundColor: room.color + "15", color: room.color }}>
                  <UserPlus className="w-4 h-4" />Añadir primera persona
                </button>
              </div>
            )}

            {!membersLoad && members.map((m) => (
              <MemberCard key={m.id} member={m} roomId={room.id} roomColor={room.color}
                onUpdate={(updated) => setMembers((p) => p.map((x) => x.id === updated.id ? updated : x))}
                onRemove={(id) => setMembers((p) => p.filter((x) => x.id !== id))} />
            ))}
          </div>
        </div>

        {/* ── Right: Reuniones de la sala ────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Section header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: room.color + "18" }}>
                <Video className="w-4 h-4" style={{ color: room.color }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Reuniones</h3>
                <p className="text-xs text-slate-400">{meetings.length} programada{meetings.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <button onClick={() => setShowNewMeet(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:brightness-110 transition-all"
              style={{ backgroundColor: room.color }}>
              <Plus className="w-4 h-4" />Nueva reunión
            </button>
          </div>

          {/* Meetings list — grouped by date */}
          <div className="flex-1 overflow-y-auto px-5 py-4 bg-slate-50">
            {meetLoad && (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-[#050040] rounded-full animate-spin" />
              </div>
            )}

            {!meetLoad && meetings.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/undraw_booking_8vl5.svg" alt="" className="w-44 h-auto mb-5 opacity-80" draggable={false} />
                <p className="text-base font-semibold text-slate-600">Sin reuniones</p>
                <p className="text-sm text-slate-400 mt-1">Crea una reunión para este workspace</p>
                <button onClick={() => setShowNewMeet(true)}
                  className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:brightness-110 transition-all"
                  style={{ backgroundColor: room.color }}>
                  <Plus className="w-4 h-4" />Crear reunión
                </button>
              </div>
            )}

            {!meetLoad && (() => {
              // Group by YYYY-MM-DD
              const groups = new Map<string, RoomMeeting[]>();
              for (const m of meetings) {
                const key = m.start_at.slice(0, 10);
                (groups.get(key) ?? groups.set(key, []).get(key)!).push(m);
              }
              const todayKey = new Date().toISOString().slice(0, 10);

              return Array.from(groups.entries()).map(([dayKey, dayMeetings]) => {
                const diff = Math.round(
                  (new Date(dayKey).getTime() - new Date(todayKey).getTime()) / 86400000,
                );
                const dayLabel =
                  diff === 0  ? "Hoy" :
                  diff === 1  ? "Mañana" :
                  diff === -1 ? "Ayer" :
                  new Date(dayKey + "T12:00:00").toLocaleDateString("es-ES", {
                    weekday: "long", day: "numeric", month: "long",
                  });
                const isPastDay = diff < 0;

                return (
                  <div key={dayKey} className="mb-5">
                    {/* Date group header */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn(
                        "text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full",
                        diff === 0
                          ? "text-white"
                          : isPastDay
                          ? "text-slate-400 bg-slate-200"
                          : "text-slate-500 bg-slate-200",
                      )} style={diff === 0 ? { backgroundColor: room.color } : {}}>
                        {dayLabel}
                      </span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    {/* Meetings for this day */}
                    <div className="space-y-2.5">
                      {dayMeetings.map((m) => {
                        const open  = expandedMeet === m.id;
                        const deleting = deletingMeetId === m.id;
                        const nowTs = Date.now();
                        const start = new Date(m.start_at);
                        const end   = m.end_at ? new Date(m.end_at) : null;
                        const isNow  = start.getTime() <= nowTs && (!end || end.getTime() >= nowTs);
                        const isPast = end ? end.getTime() < nowTs : start.getTime() < nowTs;
                        const color  = m.color || room.color;

                        return (
                          <div key={`${m.id}-${m.start_at}`} className={cn(
                            "rounded-2xl border overflow-hidden transition-all",
                            isNow  ? "border-[#050040]/20 bg-white shadow-sm" : "border-slate-200 bg-white hover:shadow-sm",
                          )}>
                            {isNow && <div className="h-1 w-full" style={{ backgroundColor: color }} />}

                            <div className="p-4">
                              <div className="flex items-start gap-3">
                                {/* Time chip */}
                                <div className={cn(
                                  "w-14 shrink-0 rounded-xl p-2 text-center",
                                  isNow ? "text-white" : isPast ? "bg-slate-100" : "bg-slate-50 border border-slate-200",
                                )} style={isNow ? { backgroundColor: color } : {}}>
                                  <p className={cn("text-xs font-bold leading-none", isNow ? "text-white" : "text-slate-700")}>
                                    {fmtTime(m.start_at)}
                                  </p>
                                  {m.end_at && (
                                    <p className={cn("text-[10px] mt-1 leading-none", isNow ? "text-white/70" : "text-slate-400")}>
                                      {fmtTime(m.end_at)}
                                    </p>
                                  )}
                                </div>

                                {/* Title + status */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className={cn("text-sm font-bold leading-snug", isPast ? "text-slate-500" : "text-slate-800")}>
                                      {m.title}
                                    </p>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {isNow && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                                          style={{ backgroundColor: color + "20", color }}>
                                          EN CURSO
                                        </span>
                                      )}
                                      {/* Edit button */}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setEditingMeeting(m); }}
                                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      {/* Delete button / confirm */}
                                      {deleting ? (
                                        <div className="flex items-center gap-1">
                                          <button onClick={() => deleteMeeting(m.id)}
                                            className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors">
                                            <Check className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => setDeletingMeetId(null)}
                                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setDeletingMeetId(m.id); }}
                                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {/* Expand */}
                                      <button onClick={() => setExpandedMeet(open ? null : m.id)}
                                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                                        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
                                      </button>
                                    </div>
                                  </div>
                                  {m.location && (
                                    <div className="flex items-center gap-1 mt-1.5">
                                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                      <p className="text-xs text-slate-400 truncate">{m.location}</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Expanded: description */}
                              {open && (m.description || deleting) && (
                                <div className="mt-3 pt-3 border-t border-slate-100">
                                  {m.description && (
                                    <p className="text-sm text-slate-600 leading-relaxed">{m.description}</p>
                                  )}
                                </div>
                              )}

                              {/* Inline delete confirm */}
                              {deleting && (
                                <div className="mt-3 pt-3 border-t border-red-100 flex items-center justify-between">
                                  <p className="text-xs text-red-500 font-medium">¿Eliminar esta reunión?</p>
                                  <div className="flex items-center gap-1.5">
                                    <button onClick={() => setDeletingMeetId(null)}
                                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition">
                                      Cancelar
                                    </button>
                                    <button onClick={() => deleteMeeting(m.id)}
                                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition">
                                      Eliminar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {showNewMeet && (
        <MeetingFormModal
          roomId={room.id} roomColor={room.color}
          onSave={(ev) => {
            setMeetings((p) => [...p, ev].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()));
            setShowNewMeet(false);
            addNotification({ title: "Reunión creada", description: ev.title, type: "event" });
          }}
          onClose={() => setShowNewMeet(false)} />
      )}
      {editingMeeting && (
        <MeetingFormModal
          roomId={room.id} roomColor={room.color}
          initial={editingMeeting}
          onSave={(updated) => {
            setMeetings((p) =>
              p.map((m) => m.id === updated.id ? updated : m)
               .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
            );
            setEditingMeeting(null);
            addNotification({ title: "Reunión actualizada", description: updated.title, type: "event" });
          }}
          onClose={() => setEditingMeeting(null)} />
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDel(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0"><Trash2 className="w-5 h-5 text-red-500" /></div>
              <div><p className="text-base font-bold text-slate-800">¿Eliminar sala?</p><p className="text-sm text-slate-400">Esta acción no se puede deshacer</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(false)} className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
              <button onClick={() => { onDelete(room.id); setConfirmDel(false); }} className="flex-1 px-3 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RoomCard (lista) ───────────────────────────────────────────────────────────
function RoomCard({ room, meetingsToday, onClick }: {
  room: Room; meetingsToday: number; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="group text-left bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: room.color }} />
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: room.color + "18" }}>{room.emoji}</div>
          {meetingsToday > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full shrink-0"
              style={{ backgroundColor: room.color + "18", color: room.color }}>
              <Video className="w-3 h-3" />{meetingsToday}
            </span>
          )}
        </div>
        <p className="text-base font-bold text-slate-800 group-hover:text-[#050040] transition-colors leading-tight">{room.name}</p>
        {room.description
          ? <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{room.description}</p>
          : <p className="text-xs text-slate-300 mt-1">Sin descripción</p>}
        <div className="mt-auto pt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <Calendar className="w-3.5 h-3.5" />
          {meetingsToday > 0
            ? <span className="font-medium" style={{ color: room.color }}>{meetingsToday} reunión{meetingsToday > 1 ? "es" : ""} hoy</span>
            : "Sin reuniones hoy"}
        </div>
      </div>
    </button>
  );
}

// ── RoomsView ──────────────────────────────────────────────────────────────────
export default function RoomsView() {
  const { addNotification } = useNotifications();
  const [rooms,        setRooms]        = React.useState<Room[]>([]);
  const [loading,      setLoading]      = React.useState(true);
  const [selectedRoom, setSelectedRoom] = React.useState<Room | null>(null);
  const [showCreate,   setShowCreate]   = React.useState(false);
  const [editingRoom,  setEditingRoom]  = React.useState<Room | null>(null);
  const [todayCounts,  setTodayCounts]  = React.useState<Record<string, number>>({});

  React.useEffect(() => { loadRooms(); }, []);

  async function loadRooms() {
    setLoading(true);
    const res = await fetch("/api/rooms");
    if (res.ok) { const data = await res.json(); const list: Room[] = data.rooms ?? []; setRooms(list); loadTodayCounts(list); }
    setLoading(false);
  }

  async function loadTodayCounts(roomList: Room[]) {
    const { start, end } = todayRange(); const counts: Record<string, number> = {};
    await Promise.all(roomList.map(async (r) => {
      const res = await fetch(`/api/meetcalendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&room_id=${r.id}`);
      if (res.ok) { const d = await res.json(); counts[r.id] = (d.events ?? []).filter((e: { type: string }) => e.type === "meeting").length; }
    }));
    setTodayCounts(counts);
  }

  async function createRoom(data: { name: string; description: string; color: string; emoji: string }) {
    const res = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (res.ok) {
      const d = await res.json(); setRooms((p) => [...p, d.room]); setTodayCounts((p) => ({ ...p, [d.room.id]: 0 }));
      addNotification({ title: "Sala creada", description: `La sala "${d.room.name}" se creó correctamente`, type: "room" });
    }
    setShowCreate(false);
  }

  async function updateRoom(data: { name: string; description: string; color: string; emoji: string }) {
    if (!editingRoom) return;
    const res = await fetch(`/api/rooms/${editingRoom.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (res.ok) {
      const d = await res.json(); setRooms((p) => p.map((r) => r.id === editingRoom.id ? d.room : r));
      if (selectedRoom?.id === editingRoom.id) setSelectedRoom(d.room);
    }
    setEditingRoom(null);
  }

  async function deleteRoom(id: string) {
    await fetch(`/api/rooms/${id}`, { method: "DELETE" });
    setRooms((p) => p.filter((r) => r.id !== id));
    if (selectedRoom?.id === id) setSelectedRoom(null);
  }

  // Room detail — full height
  if (selectedRoom) {
    return (
      <>
        <RoomDetail room={selectedRoom} onBack={() => setSelectedRoom(null)}
          onEdit={(r) => setEditingRoom(r)} onDelete={(id) => { deleteRoom(id); setSelectedRoom(null); }} />
        {editingRoom && <RoomFormModal initial={editingRoom} onSave={updateRoom} onClose={() => setEditingRoom(null)} />}
      </>
    );
  }

  // Room list
  return (
    <div className="space-y-6">
      <style>{ANIM}</style>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#050040]">Workspaces</h2>
          <p className="text-sm text-slate-400 mt-0.5">{rooms.length} workspace{rooms.length !== 1 ? "s" : ""} · reuniones de hoy visibles en cada uno</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#050040] text-white text-sm font-semibold hover:bg-[#050040]/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />Nueva sala
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-2xl border border-slate-100 h-44 animate-pulse" />)}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/undraw_collaboration_hkrb.svg" alt="" className="w-60 h-auto mb-6 opacity-90" draggable={false} />
          <h3 className="text-lg font-bold text-slate-700">Aún no hay workspaces</h3>
          <p className="text-sm text-slate-400 mt-1 mb-5">Crea tu primer workspace para organizar reuniones y personas</p>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#050040] text-white text-sm font-semibold hover:bg-[#050040]/90 transition-colors">
            <Plus className="w-4 h-4" />Crear primera sala
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} meetingsToday={todayCounts[room.id] ?? 0} onClick={() => setSelectedRoom(room)} />
          ))}
        </div>
      )}

      {showCreate   && <RoomFormModal onSave={createRoom} onClose={() => setShowCreate(false)} />}
      {editingRoom  && <RoomFormModal initial={editingRoom} onSave={updateRoom} onClose={() => setEditingRoom(null)} />}
    </div>
  );
}
