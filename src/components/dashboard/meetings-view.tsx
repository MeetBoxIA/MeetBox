"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Video, Upload, Clock, MapPin, Calendar, Search,
  Trash2, FileVideo, FileAudio, X, ChevronLeft,
  ChevronRight, Link2, RefreshCw, AlertCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = "today" | "import" | "history";

interface Room { name: string; emoji: string; color: string; }
interface Meeting {
  id: string; title: string; description: string | null; location: string | null;
  start_at: string; end_at: string | null; all_day: boolean; color: string;
  room: Room | null; recording_count: number;
}
interface Recording {
  id: string; title: string; file_name: string; file_size: number | null;
  mime_type: string | null; status: string; created_at: string;
  event_id: string | null; public_url: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}
function fmtSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function isVideo(mime: string | null) {
  return mime?.startsWith("video/") ?? false;
}
const ACCEPT = "video/mp4,video/quicktime,video/x-msvideo,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/webm,.mp4,.mov,.avi,.webm,.mp3,.m4a,.wav";

// ── TodayTab ───────────────────────────────────────────────────────────────────
function TodayTab() {
  const [meetings, setMeetings] = React.useState<Meeting[]>([]);
  const [loading,  setLoading]  = React.useState(true);

  React.useEffect(() => {
    fetch("/api/meetings/today")
      .then((r) => r.ok ? r.json() : { meetings: [] })
      .then((d) => setMeetings(d.meetings ?? []))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date();
  const dateStr = today.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Date header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Hoy</p>
          <p className="text-sm text-slate-600 capitalize">{dateStr}</p>
        </div>
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#050040]/8 text-[#050040]">
          {meetings.length} reunión{meetings.length !== 1 ? "es" : ""}
        </span>
      </div>

      {meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/undraw_conference-call_jgi5.svg" alt="" className="w-64 h-auto mb-5 opacity-90" draggable={false} />
          <h3 className="text-base font-semibold text-slate-700">Sin reuniones hoy</h3>
          <p className="text-sm text-slate-400 mt-1">No tienes reuniones programadas para hoy.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl border border-slate-100 hover:shadow-sm transition-all overflow-hidden">
              {/* Color accent */}
              <div className="h-1 w-full" style={{ backgroundColor: m.color }} />
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Time */}
                  <div className="text-center shrink-0 w-14">
                    <p className="text-base font-bold text-slate-800 leading-none">{m.all_day ? "Todo" : fmtTime(m.start_at)}</p>
                    {m.end_at && !m.all_day && (
                      <p className="text-xs text-slate-400 mt-1 leading-none">{fmtTime(m.end_at)}</p>
                    )}
                    {m.all_day && <p className="text-xs text-slate-400 mt-0.5 leading-none">el día</p>}
                  </div>

                  {/* Divider */}
                  <div className="w-0.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: m.color + "80" }} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-semibold text-slate-800 leading-tight">{m.title}</h3>
                      {m.recording_count > 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-100 px-2 py-1 rounded-full shrink-0">
                          <FileVideo className="w-3 h-3" />{m.recording_count}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                      {m.location && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="w-3 h-3 shrink-0" />{m.location}
                        </span>
                      )}
                      {m.room && (
                        <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: m.room.color + "18", color: m.room.color }}>
                          {m.room.emoji} {m.room.name}
                        </span>
                      )}
                    </div>

                    {m.description && (
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed line-clamp-2">{m.description}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ImportTab ──────────────────────────────────────────────────────────────────
function ImportTab() {
  const [recordings, setRecordings]   = React.useState<Recording[]>([]);
  const [loadingRec, setLoadingRec]   = React.useState(true);
  const [uploading,  setUploading]    = React.useState(false);
  const [uploadPct,  setUploadPct]    = React.useState(0);
  const [dragOver,   setDragOver]     = React.useState(false);
  const [error,      setError]        = React.useState<string | null>(null);
  const [todayMtgs,  setTodayMtgs]    = React.useState<Meeting[]>([]);
  const [linkEvent,  setLinkEvent]    = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    Promise.all([
      fetch("/api/meetings/recordings").then((r) => r.ok ? r.json() : { recordings: [] }),
      fetch("/api/meetings/today").then((r) => r.ok ? r.json() : { meetings: [] }),
    ]).then(([recData, mtgData]) => {
      setRecordings(recData.recordings ?? []);
      setTodayMtgs(mtgData.meetings ?? []);
    }).finally(() => setLoadingRec(false));
  }, []);

  async function handleFiles(files: FileList | File[]) {
    const file = Array.from(files)[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    setUploadPct(10);

    const fd = new FormData();
    fd.append("file", file);
    if (linkEvent) fd.append("event_id", linkEvent);
    fd.append("title", file.name.replace(/\.[^.]+$/, ""));

    try {
      setUploadPct(40);
      const res = await fetch("/api/meetings/recordings", { method: "POST", body: fd });
      setUploadPct(90);
      if (res.ok) {
        const d = await res.json();
        setRecordings((p) => [d.recording, ...p]);
        setLinkEvent("");
      } else {
        const d = await res.json();
        setError(d.error ?? "Error al subir el archivo");
      }
    } catch {
      setError("Error de red al subir el archivo");
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  }

  async function deleteRecording(id: string) {
    const res = await fetch(`/api/meetings/recordings/${id}`, { method: "DELETE" });
    if (res.ok) setRecordings((p) => p.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-5">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all",
          dragOver   ? "border-[#050040] bg-[#050040]/4 scale-[1.01]"
          : uploading ? "border-slate-200 bg-slate-50 cursor-wait"
          :             "border-slate-200 hover:border-[#050040]/40 hover:bg-slate-50/60",
        )}
      >
        <input
          ref={inputRef} type="file" accept={ACCEPT}
          className="hidden"
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
        />

        {uploading ? (
          <>
            <div className="w-12 h-12 rounded-2xl bg-[#050040]/8 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-[#050040] animate-spin" />
            </div>
            <div className="w-full max-w-xs">
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#050040] rounded-full transition-all duration-300"
                  style={{ width: `${uploadPct}%` }} />
              </div>
              <p className="text-xs text-slate-400 text-center mt-2">Subiendo grabación…</p>
            </div>
          </>
        ) : (
          <>
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
              dragOver ? "bg-[#050040] text-white" : "bg-[#050040]/8 text-[#050040]",
            )}>
              <Upload className="w-6 h-6" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-slate-700">
                {dragOver ? "Suelta el archivo aquí" : "Arrastra o haz clic para subir"}
              </p>
              <p className="text-sm text-slate-400 mt-1">MP4, MOV, AVI, WebM, MP3, M4A, WAV</p>
            </div>
          </>
        )}
      </div>

      {/* Link to meeting */}
      {!uploading && todayMtgs.length > 0 && (
        <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3">
          <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={linkEvent}
            onChange={(e) => setLinkEvent(e.target.value)}
            className="flex-1 text-sm text-slate-700 bg-transparent outline-none"
          >
            <option value="">Vincular a una reunión de hoy (opcional)</option>
            {todayMtgs.map((m) => (
              <option key={m.id} value={m.id}>
                {!m.all_day ? `${fmtTime(m.start_at)} – ` : ""}{m.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Error al importar</p>
            <p className="leading-relaxed">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Recordings list */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Grabaciones importadas
          {recordings.length > 0 && (
            <span className="ml-2 text-xs font-medium text-slate-400">({recordings.length})</span>
          )}
        </h3>

        {loadingRec ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="w-5 h-5 text-slate-300 animate-spin" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/undraw_writing-online_x665.svg" alt="" className="w-44 h-auto mb-4 opacity-80" draggable={false} />
            <p className="text-sm font-medium text-slate-500">Aún no hay grabaciones</p>
            <p className="text-xs text-slate-400 mt-0.5">Arrastra un archivo de video o audio para importar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recordings.map((rec) => (
              <div key={rec.id} className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3 group hover:shadow-sm transition-all">
                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  {isVideo(rec.mime_type)
                    ? <FileVideo className="w-4 h-4 text-violet-500" />
                    : <FileAudio className="w-4 h-4 text-violet-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{rec.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400">{fmtSize(rec.file_size)}</span>
                    <span className="text-slate-200">·</span>
                    <span className="text-xs text-slate-400">{fmtDate(rec.created_at)}</span>
                    {rec.public_url && (
                      <>
                        <span className="text-slate-200">·</span>
                        <a href={rec.public_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-[#050040] font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}>
                          Ver archivo
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteRecording(rec.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── HistoryTab ─────────────────────────────────────────────────────────────────
function HistoryTab() {
  const [meetings, setMeetings] = React.useState<Meeting[]>([]);
  const [loading,  setLoading]  = React.useState(true);
  const [search,   setSearch]   = React.useState("");
  const [page,     setPage]     = React.useState(0);
  const [total,    setTotal]    = React.useState(0);
  const LIMIT = 20;

  React.useEffect(() => { load(0, ""); }, []);

  async function load(p: number, q: string) {
    setLoading(true);
    const res = await fetch(`/api/meetings/history?page=${p}&q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const d = await res.json();
      setMeetings(d.meetings ?? []);
      setTotal(d.total ?? 0);
    }
    setLoading(false);
  }

  function handleSearch(q: string) {
    setSearch(q); setPage(0); load(0, q);
  }
  function handlePage(p: number) {
    setPage(p); load(p, search);
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text" value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar reuniones pasadas…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 focus:ring-2 focus:ring-[#050040]/8 transition"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/undraw_morning-news_h9nz.svg" alt="" className="w-52 h-auto mb-5 opacity-90" draggable={false} />
          <h3 className="text-base font-semibold text-slate-600">
            {search ? "Sin resultados" : "Sin historial"}
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            {search ? `No se encontraron reuniones con "${search}"` : "Tus reuniones pasadas aparecerán aquí"}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400">{total} reunión{total !== 1 ? "es" : ""} en el historial</p>

          <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
            {meetings.map((m) => (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors group">
                {/* Date badge */}
                <div className="shrink-0 text-center w-10">
                  <p className="text-xs font-bold text-slate-500 leading-none">
                    {new Date(m.start_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).replace(".", "")}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-none">
                    {new Date(m.start_at).getFullYear()}
                  </p>
                </div>

                {/* Color bar */}
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: m.color }} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{m.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {!m.all_day && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3 shrink-0" />
                        {fmtTime(m.start_at)}{m.end_at ? ` – ${fmtTime(m.end_at)}` : ""}
                      </span>
                    )}
                    {m.location && (
                      <span className="flex items-center gap-1 text-xs text-slate-400 truncate max-w-[140px]">
                        <MapPin className="w-3 h-3 shrink-0" />{m.location}
                      </span>
                    )}
                    {m.room && (
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: m.room.color + "18", color: m.room.color }}>
                        {m.room.emoji} {m.room.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Recording badge */}
                {m.recording_count > 0 && (
                  <span className="flex items-center gap-1 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-100 px-2 py-1 rounded-full shrink-0">
                    <FileVideo className="w-3 h-3" />{m.recording_count}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button onClick={() => handlePage(page - 1)} disabled={page === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" />Anterior
              </button>
              <p className="text-xs text-slate-400">Página {page + 1} de {totalPages}</p>
              <button onClick={() => handlePage(page + 1)} disabled={page >= totalPages - 1}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                Siguiente<ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── MeetingsView ───────────────────────────────────────────────────────────────
export default function MeetingsView() {
  const [tab, setTab] = React.useState<Tab>("today");

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "today",  label: "Reuniones hoy",        icon: Calendar  },
    { id: "import", label: "Importar grabación",    icon: Upload    },
    { id: "history",label: "Historial",             icon: Video     },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#050040]">Reuniones</h2>
        <p className="text-sm text-slate-400 mt-0.5">Gestiona, graba e historial de tus reuniones</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all",
              tab === id
                ? "bg-white text-[#050040] shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "today"   && <TodayTab />}
      {tab === "import"  && <ImportTab />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}
