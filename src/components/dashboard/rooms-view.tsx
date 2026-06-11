"use client";
/**
 * RoomsView — manage team spaces (rooms) and their members/meetings.
 *
 * Renders two levels:
 *   1. Room list — grid of room cards with member count and today's meetings
 *   2. Room detail — members list + today's meeting schedule for a selected room
 *
 * Members are stored in the room_members table; meetings are calendar_events
 * with a room_id. Both are fetched fresh when a room is selected.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Plus, X, ChevronLeft, Trash2, Check, Clock,
  MapPin, DoorOpen, Video, Calendar,
  AlignLeft, Pencil, Mail, Users, ChevronDown, ChevronRight,
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
  const d = new Date();
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
  return {
    start: new Date(y, m, day, 0, 0, 0).toISOString(),
    end:   new Date(y, m, day, 23, 59, 59).toISOString(),
  };
}
function initials(name: string) {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}
/**
 * Return the local UTC offset as "+HH:MM" or "-HH:MM".
 * Passed to the calendar API so new events created from the room detail view
 * are stored with the correct local timezone offset.
 */
function localOffsetStr() {
  const off  = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs  = Math.abs(off);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2,"0")}:${String(abs % 60).padStart(2,"0")}`;
}

const ANIM = `@keyframes rmFade{from{opacity:0;transform:scale(0.97) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}`;

// ── RoomFormModal ──────────────────────────────────────────────────────────────
function RoomFormModal({
  initial, onSave, onClose,
}: {
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
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), description, color, emoji });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <style>{ANIM}</style>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ animation: "rmFade 0.2s cubic-bezier(0.16,1,0.3,1) both" }}>

        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: color + "22" }}>{emoji}</div>
            <h2 className="text-base font-semibold text-slate-800">{initial ? "Editar sala" : "Nueva sala"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Icono</label>
            <div className="flex flex-wrap gap-1.5">
              {ROOM_EMOJIS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)}
                  className={cn("w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all",
                    emoji === e ? "ring-2 ring-[#050040]/40" : "hover:bg-slate-100")}
                  style={emoji === e ? { backgroundColor: color + "22" } : {}}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nombre</label>
            <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="Ej. Sala de juntas A"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 focus:ring-2 focus:ring-[#050040]/8 transition" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              <AlignLeft className="w-3.5 h-3.5 inline mr-1 text-slate-400" />Descripción (opcional)
            </label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Capacidad, equipamiento, etc." rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 transition resize-none" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {ROOM_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110 border-2"
                  style={{ backgroundColor: c, borderColor: color === c ? "#000" : "transparent" }} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            Cancelar
          </button>
          <button onClick={submit} disabled={saving || !name.trim()}
            className="px-4 py-2 rounded-xl bg-[#050040] text-white text-sm font-semibold hover:bg-[#050040]/90 disabled:opacity-50 transition">
            {saving ? "Guardando…" : initial ? "Guardar" : "Crear sala"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NewMeetingModal ────────────────────────────────────────────────────────────
function NewMeetingModal({ roomId, onSave, onClose }: {
  roomId: string; onSave: (ev: RoomMeeting) => void; onClose: () => void;
}) {
  const now  = new Date();
  const pad  = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const [title,       setTitle]       = React.useState("");
  const [startTime,   setStartTime]   = React.useState(`${pad(now.getHours() + 1)}:00`);
  const [endTime,     setEndTime]     = React.useState(`${pad(now.getHours() + 2)}:00`);
  const [location,    setLocation]    = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving,      setSaving]      = React.useState(false);

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    const tz = localOffsetStr();
    const res = await fetch("/api/meetcalendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(), type: "meeting",
        start_at: `${today}T${startTime}:00${tz}`,
        end_at:   endTime ? `${today}T${endTime}:00${tz}` : null,
        all_day: false, color: "#050040",
        location: location || null, description: description || null,
        notify_email: false, notify_minutes: 15, room_id: roomId,
      }),
    });
    if (res.ok) { const d = await res.json(); onSave(d.event); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <style>{ANIM}</style>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ animation: "rmFade 0.2s cubic-bezier(0.16,1,0.3,1) both" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-[#050040]" />
            <h2 className="text-base font-semibold text-slate-800">Nueva reunión</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Título</label>
            <input autoFocus type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="Nombre de la reunión"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 focus:ring-2 focus:ring-[#050040]/8 transition" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[["Inicio", startTime, setStartTime] as const, ["Fin", endTime, setEndTime] as const].map(([lbl, val, set]) => (
              <div key={lbl}>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">{lbl}</label>
                <input type="time" value={val} onChange={(e) => set(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 outline-none focus:border-[#050040]/50 transition" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              <MapPin className="w-3.5 h-3.5 inline mr-1 text-slate-400" />Ubicación (opcional)
            </label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="URL o lugar"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 transition" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              <AlignLeft className="w-3.5 h-3.5 inline mr-1 text-slate-400" />Descripción (opcional)
            </label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Agenda, notas…" rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 transition resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            Cancelar
          </button>
          <button onClick={submit} disabled={saving || !title.trim()}
            className="px-4 py-2 rounded-xl bg-[#050040] text-white text-sm font-semibold hover:bg-[#050040]/90 disabled:opacity-50 transition">
            {saving ? "Creando…" : "Crear reunión"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MemberRow ─────────────────────────────────────────────────────────────────
function MemberRow({
  member, roomId, onUpdate, onRemove,
}: {
  member: RoomMember; roomId: string;
  onUpdate: (m: RoomMember) => void; onRemove: (id: string) => void;
}) {
  const [editing, setEditing]   = React.useState(false);
  const [name,    setName]      = React.useState(member.name);
  const [email,   setEmail]     = React.useState(member.email);
  const [saving,  setSaving]    = React.useState(false);

  async function save() {
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/rooms/${roomId}/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim() }),
    });
    if (res.ok) {
      const d = await res.json();
      onUpdate(d.member);
      setEditing(false);
    }
    setSaving(false);
  }

  async function remove() {
    await fetch(`/api/rooms/${roomId}/members/${member.id}`, { method: "DELETE" });
    onRemove(member.id);
  }

  if (editing) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex-1 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Nombre completo"
            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 transition" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            placeholder="correo@gmail.com"
            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 transition" />
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={save} disabled={saving || !name.trim() || !email.trim()}
            className="p-2 rounded-lg bg-[#050040] text-white hover:bg-[#050040]/90 disabled:opacity-50 transition">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setEditing(false); setName(member.name); setEmail(member.email); }}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
      <div className="w-9 h-9 rounded-full bg-[#050040] text-white text-xs font-bold flex items-center justify-center shrink-0">
        {initials(member.name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 leading-tight">{member.name}</p>
        <p className="text-xs text-slate-400 leading-tight mt-0.5 flex items-center gap-1 truncate">
          <Mail className="w-3 h-3 shrink-0" />{member.email}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => setEditing(true)}
          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-[#050040] transition-colors" title="Editar">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={remove}
          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Eliminar">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── MembersPanel ───────────────────────────────────────────────────────────────
function MembersPanel({ room }: { room: Room }) {
  const [members,  setMembers]  = React.useState<RoomMember[]>([]);
  const [loading,  setLoading]  = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [name,     setName]     = React.useState("");
  const [email,    setEmail]    = React.useState("");
  const [adding,   setAdding]   = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/rooms/${room.id}/members`)
      .then((r) => r.ok ? r.json() : { members: [] })
      .then((d) => setMembers(d.members ?? []))
      .finally(() => setLoading(false));
  }, [room.id]);

  async function addMember() {
    if (!name.trim() || !email.trim()) return;
    setAdding(true);
    const res = await fetch(`/api/rooms/${room.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim() }),
    });
    if (res.ok) {
      const d = await res.json();
      setMembers((p) => [...p, d.member]);
      setName(""); setEmail(""); setShowForm(false);
    }
    setAdding(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800">Personas de la sala</h3>
          {members.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {members.length}
            </span>
          )}
        </div>
        <button onClick={() => { setShowForm(true); setTimeout(() => document.getElementById("add-name-input")?.focus(), 50); }}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#050040] hover:underline">
          <Plus className="w-3.5 h-3.5" />Añadir persona
        </button>
      </div>

      <div className="p-3">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-4 h-4 border-2 border-slate-200 border-t-[#050040] rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {members.length === 0 && !showForm && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/undraw_meet-the-team_fau8.svg" alt="" className="w-40 h-auto mb-4 opacity-90" draggable={false} />
                <p className="text-sm font-medium text-slate-500">Sin personas asignadas</p>
                <button onClick={() => setShowForm(true)}
                  className="mt-2 text-xs font-semibold text-[#050040] hover:underline">
                  Añadir la primera persona
                </button>
              </div>
            )}

            {members.length > 0 && (
              <div className="space-y-0.5">
                {members.map((m) => (
                  <MemberRow
                    key={m.id} member={m} roomId={room.id}
                    onUpdate={(updated) => setMembers((p) => p.map((x) => x.id === updated.id ? updated : x))}
                    onRemove={(id) => setMembers((p) => p.filter((x) => x.id !== id))}
                  />
                ))}
              </div>
            )}

            {/* Add form */}
            {showForm && (
              <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <p className="text-xs font-semibold text-slate-600 mb-1">Nueva persona</p>
                <input id="add-name-input" type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 transition" />
                <div className="flex gap-2">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addMember(); if (e.key === "Escape") setShowForm(false); }}
                    placeholder="correo@gmail.com"
                    className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 transition" />
                  <button onClick={addMember} disabled={adding || !name.trim() || !email.trim()}
                    className="px-3 py-2 rounded-lg bg-[#050040] text-white text-xs font-semibold hover:bg-[#050040]/90 disabled:opacity-50 transition shrink-0">
                    {adding ? "…" : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => { setShowForm(false); setName(""); setEmail(""); }}
                    className="px-2 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── MeetingsPanel ─────────────────────────────────────────────────────────────
function MeetingsPanel({ room }: { room: Room }) {
  const [meetings,   setMeetings]   = React.useState<RoomMeeting[]>([]);
  const [loading,    setLoading]    = React.useState(true);
  const [showNew,    setShowNew]    = React.useState(false);
  const [expanded,   setExpanded]   = React.useState<string | null>(null);

  React.useEffect(() => { load(); }, [room.id]);

  async function load() {
    setLoading(true);
    const { start, end } = todayRange();
    const res = await fetch(`/api/meetcalendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&room_id=${room.id}`);
    if (res.ok) {
      const d = await res.json();
      setMeetings((d.events ?? []).filter((e: { type: string }) => e.type === "meeting")
        .sort((a: RoomMeeting, b: RoomMeeting) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()));
    }
    setLoading(false);
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Reuniones de hoy</h3>
          <p className="text-xs text-slate-400 mt-0.5 capitalize">{dateStr}</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#050040] text-white text-xs font-semibold hover:bg-[#050040]/90 transition-colors">
          <Plus className="w-3.5 h-3.5" />Nueva reunión
        </button>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-[#050040] rounded-full animate-spin" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/undraw_booking_8vl5.svg" alt="" className="w-40 h-auto mb-4 opacity-90" draggable={false} />
            <p className="text-sm font-medium text-slate-500">Sin reuniones hoy</p>
            <p className="text-xs text-slate-400 mt-1">Crea una reunión para esta sala</p>
          </div>
        ) : (
          <div className="space-y-2">
            {meetings.map((m) => {
              const open = expanded === m.id;
              return (
                <div key={m.id} className="rounded-xl border border-slate-100 overflow-hidden hover:shadow-sm transition-all">
                  <button
                    onClick={() => setExpanded(open ? null : m.id)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{m.title}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {!m.all_day && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="w-3 h-3 shrink-0" />
                            {fmtTime(m.start_at)}{m.end_at ? ` – ${fmtTime(m.end_at)}` : ""}
                          </span>
                        )}
                        {m.location && (
                          <span className="flex items-center gap-1 text-xs text-slate-400 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />{m.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {open
                      ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                  </button>

                  {open && m.description && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="ml-4 pl-3 border-l-2 border-slate-100">
                        <p className="text-xs text-slate-500 leading-relaxed">{m.description}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNew && (
        <NewMeetingModal
          roomId={room.id}
          onSave={(ev) => { setMeetings((p) => [...p, ev].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())); setShowNew(false); }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

// ── RoomDetail ─────────────────────────────────────────────────────────────────
function RoomDetail({ room, onBack, onEdit, onDelete }: {
  room: Room; onBack: () => void; onEdit: (r: Room) => void; onDelete: (id: string) => void;
}) {
  const [confirmDel, setConfirmDel] = React.useState(false);

  return (
    <div className="space-y-5" style={{ animation: "rmFade 0.2s ease both" }}>
      <style>{ANIM}</style>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: room.color + "18" }}>{room.emoji}</div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{room.name}</h2>
            {room.description && <p className="text-sm text-slate-400 mt-0.5">{room.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onEdit(room)}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500" title="Editar sala">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => setConfirmDel(true)}
            className="p-2 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors text-slate-500" title="Eliminar sala">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dos columnas: personas | reuniones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        <MembersPanel room={room} />
        <MeetingsPanel room={room} />
      </div>

      {/* Delete confirm */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDel(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">¿Eliminar sala?</p>
                <p className="text-xs text-slate-400">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setConfirmDel(false)}
                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                Cancelar
              </button>
              <button onClick={() => { onDelete(room.id); setConfirmDel(false); }}
                className="flex-1 px-3 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RoomCard ───────────────────────────────────────────────────────────────────
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
        <p className="text-base font-bold text-slate-800 group-hover:text-[#050040] transition-colors leading-tight">
          {room.name}
        </p>
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
    if (res.ok) {
      const data = await res.json();
      const list: Room[] = data.rooms ?? [];
      setRooms(list);
      loadTodayCounts(list);
    }
    setLoading(false);
  }

  async function loadTodayCounts(roomList: Room[]) {
    const { start, end } = todayRange();
    const counts: Record<string, number> = {};
    await Promise.all(roomList.map(async (r) => {
      const res = await fetch(`/api/meetcalendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&room_id=${r.id}`);
      if (res.ok) {
        const d = await res.json();
        counts[r.id] = (d.events ?? []).filter((e: { type: string }) => e.type === "meeting").length;
      }
    }));
    setTodayCounts(counts);
  }

  async function createRoom(data: { name: string; description: string; color: string; emoji: string }) {
    const res = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (res.ok) {
      const d = await res.json();
      setRooms((p) => [...p, d.room]);
      setTodayCounts((p) => ({ ...p, [d.room.id]: 0 }));
      addNotification({ title: "Sala creada", description: `La sala "${d.room.name}" se creó correctamente`, type: "room" });
    }
    setShowCreate(false);
  }

  async function updateRoom(data: { name: string; description: string; color: string; emoji: string }) {
    if (!editingRoom) return;
    const res = await fetch(`/api/rooms/${editingRoom.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (res.ok) {
      const d = await res.json();
      setRooms((p) => p.map((r) => r.id === editingRoom.id ? d.room : r));
      if (selectedRoom?.id === editingRoom.id) setSelectedRoom(d.room);
    }
    setEditingRoom(null);
  }

  async function deleteRoom(id: string) {
    await fetch(`/api/rooms/${id}`, { method: "DELETE" });
    setRooms((p) => p.filter((r) => r.id !== id));
    if (selectedRoom?.id === id) setSelectedRoom(null);
  }

  if (selectedRoom) {
    return (
      <>
        <RoomDetail
          room={selectedRoom}
          onBack={() => setSelectedRoom(null)}
          onEdit={(r) => setEditingRoom(r)}
          onDelete={(id) => { deleteRoom(id); setSelectedRoom(null); }}
        />
        {editingRoom && (
          <RoomFormModal initial={editingRoom} onSave={updateRoom} onClose={() => setEditingRoom(null)} />
        )}
      </>
    );
  }

  return (
    <div className="space-y-5">
      <style>{ANIM}</style>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#050040]">Salas</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {rooms.length} sala{rooms.length !== 1 ? "s" : ""} · reuniones de hoy visibles en cada sala
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#050040] text-white text-sm font-semibold hover:bg-[#050040]/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />Nueva sala
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 h-44 animate-pulse" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/undraw_collaboration_hkrb.svg" alt="" className="w-60 h-auto mb-6 opacity-90" draggable={false} />
          <h3 className="text-base font-semibold text-slate-700">Aún no hay salas</h3>
          <p className="text-sm text-slate-400 mt-1 mb-4">Crea tu primera sala para organizar reuniones</p>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#050040] text-white text-sm font-semibold hover:bg-[#050040]/90 transition-colors">
            <Plus className="w-4 h-4" />Crear primera sala
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} meetingsToday={todayCounts[room.id] ?? 0}
              onClick={() => setSelectedRoom(room)} />
          ))}
        </div>
      )}

      {showCreate && <RoomFormModal onSave={createRoom} onClose={() => setShowCreate(false)} />}
      {editingRoom && <RoomFormModal initial={editingRoom} onSave={updateRoom} onClose={() => setEditingRoom(null)} />}
    </div>
  );
}
