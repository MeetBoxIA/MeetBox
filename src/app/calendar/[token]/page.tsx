"use client";
import * as React from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, ExternalLink } from "lucide-react";
import { SiGooglecalendar, SiApple } from "react-icons/si";

type CalEvent = {
  id: string; title: string; description: string | null; location: string | null;
  type: string; start_at: string; end_at: string | null; all_day: boolean; color: string;
};

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_SHORT = ["Lu","Ma","Mi","Ju","Vi","Sá","Do"];

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function initials(name: string) {
  return name.split(" ").slice(0,2).map(n=>n[0]).join("").toUpperCase();
}

export default function PublicCalendarPage() {
  const { token } = useParams<{ token: string }>();
  const today     = React.useMemo(() => new Date(), []);

  const [currentMonth, setCurrentMonth] = React.useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events,       setEvents]       = React.useState<CalEvent[]>([]);
  const [owner,        setOwner]        = React.useState<{ name: string; avatar_url: string | null } | null>(null);
  const [loading,      setLoading]      = React.useState(true);
  const [notFound,     setNotFound]     = React.useState(false);
  const [selectedDay,  setSelectedDay]  = React.useState<Date | null>(null);
  const [origin,       setOrigin]       = React.useState("");

  React.useEffect(() => { setOrigin(window.location.origin); }, []);

  React.useEffect(() => {
    const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
    const start = new Date(y, m - 1, 1).toISOString();
    const end   = new Date(y, m + 2, 0, 23, 59, 59).toISOString();
    setLoading(true);
    fetch(`/api/meetcalendar/public/${token}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { setEvents(data.events ?? []); setOwner(data.owner); })
      .catch(code => { if (code === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [token, currentMonth]);

  // Hooks must run on every render regardless of `notFound`, so this stays
  // above the early return below (React errors if hook order changes between renders).
  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const key = isoDate(new Date(ev.start_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  if (notFound) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/undraw_my-app_jscv.svg" alt="" className="w-48 h-auto mx-auto mb-6 opacity-90" draggable={false} />
        <h1 className="text-xl font-bold text-slate-700">Calendario no encontrado</h1>
        <p className="text-slate-400 mt-2 text-sm">Este enlace no es válido o ha caducado.</p>
      </div>
    </div>
  );

  const icalUrl  = `${origin}/api/meetcalendar/ical/${token}`;
  const gcalUrl  = `https://www.google.com/calendar/render?cid=${encodeURIComponent(icalUrl.replace(/^https?/, "webcal"))}`;

  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1,
  );
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedEvents = selectedDay ? (eventsByDate.get(isoDate(selectedDay)) ?? []) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {owner ? (
              owner.avatar_url
                ? <img src={owner.avatar_url} alt={owner.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                : <div className="w-10 h-10 rounded-full bg-[#050040] text-white flex items-center justify-center font-bold text-sm shrink-0">{initials(owner.name)}</div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
            )}
            <div>
              <p className="text-xs text-slate-400 font-medium">Calendario compartido</p>
              <h1 className="text-base font-bold text-slate-800">{owner?.name ?? "…"}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={gcalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:border-[#1A73E8]/50 hover:text-[#1A73E8] transition-all shadow-sm"
            >
              <SiGooglecalendar className="w-3.5 h-3.5 text-[#1A73E8]" />
              <span className="hidden sm:inline">Agregar a Google Calendar</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={icalUrl}
              download
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:border-slate-400 transition-all shadow-sm"
            >
              <SiApple className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Descargar .ics</span>
            </a>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Calendar */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Month navigation */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">
                {MONTHS_ES[month]} <span className="text-slate-400 font-normal">{year}</span>
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
                  className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
                >Hoy</button>
                <button
                  onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
                  className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-slate-100">
              {DAYS_SHORT.map((d, i) => (
                <div key={d} className={cn("text-center py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide", i >= 5 && "text-slate-300")}>
                  {d}
                </div>
              ))}
            </div>

            {/* Grid */}
            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#050040]/20 border-t-[#050040] rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-px bg-slate-100">
                {cells.map((day, idx) => {
                  if (!day) return <div key={idx} className="bg-white opacity-0 aspect-square" />;
                  const date      = new Date(year, month, day);
                  const dateKey   = isoDate(date);
                  const isToday   = sameDay(date, today);
                  const isWeekend = idx % 7 >= 5;
                  const isSelected= selectedDay ? sameDay(date, selectedDay) : false;
                  const dayEvs    = eventsByDate.get(dateKey) ?? [];

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDay(isSelected ? null : date)}
                      className={cn(
                        "bg-white p-1.5 cursor-pointer flex flex-col transition-colors min-h-[80px]",
                        isToday && "bg-[#050040]/4",
                        isWeekend && !isToday && "bg-slate-50/50",
                        isSelected && "ring-2 ring-[#050040]/40 ring-inset bg-[#050040]/4",
                        "hover:bg-slate-50",
                      )}
                    >
                      <span className={cn(
                        "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full shrink-0",
                        isToday ? "bg-[#050040] text-white" : isWeekend ? "text-slate-400" : "text-slate-600",
                      )}>{day}</span>
                      <div className="mt-1 space-y-0.5 flex-1 overflow-hidden">
                        {dayEvs.slice(0, 3).map((ev) => (
                          <div key={ev.id} className="text-[10px] leading-tight rounded px-1.5 py-0.5 truncate font-medium text-white"
                            style={{ backgroundColor: ev.color }}>
                            {!ev.all_day && <span className="opacity-80 mr-1">{fmtTime(ev.start_at)}</span>}
                            {ev.title}
                          </div>
                        ))}
                        {dayEvs.length > 3 && (
                          <p className="text-[10px] text-slate-400 pl-1.5">+{dayEvs.length - 3} más</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Day detail panel */}
          <div className="w-full lg:w-72 shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
            {selectedDay ? (
              <>
                <div className="px-5 py-4 border-b border-slate-100 shrink-0">
                  <p className="text-xs text-slate-400">{MONTHS_ES[selectedDay.getMonth()]} {selectedDay.getFullYear()}</p>
                  <h3 className="text-base font-bold text-slate-800">
                    {DAYS_SHORT[(selectedDay.getDay() + 6) % 7]}, {selectedDay.getDate()}
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                  {selectedEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                      <Calendar className="w-8 h-8 text-slate-200 mb-2" />
                      <p className="text-sm text-slate-400">Sin eventos este día</p>
                    </div>
                  ) : (
                    selectedEvents.map((ev) => (
                      <div key={ev.id} className="flex items-start gap-3 px-5 py-4">
                        <div className="w-1 self-stretch rounded-full shrink-0 mt-0.5" style={{ backgroundColor: ev.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{ev.title}</p>
                          {!ev.all_day && (
                            <p className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {fmtTime(ev.start_at)}{ev.end_at ? ` – ${fmtTime(ev.end_at)}` : ""}
                            </p>
                          )}
                          {ev.all_day && <p className="text-xs text-slate-400 mt-0.5">Todo el día</p>}
                          {ev.location && (
                            <p className="flex items-center gap-1 text-xs text-slate-400 mt-0.5 truncate">
                              <MapPin className="w-3 h-3 shrink-0" />{ev.location}
                            </p>
                          )}
                          {ev.description && (
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-3">{ev.description}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-center px-6 py-12">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/undraw_booking_8vl5.svg" alt="" className="w-36 h-auto mb-4 opacity-90" draggable={false} />
                <p className="text-sm font-medium text-slate-500">Selecciona un día</p>
                <p className="text-xs text-slate-400 mt-1">para ver sus eventos</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-300 mt-6">
          Calendario compartido con <span className="font-semibold">MeetBox</span>
        </p>
      </main>
    </div>
  );
}
