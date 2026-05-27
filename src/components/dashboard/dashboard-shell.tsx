"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Video, DoorOpen, Puzzle, Settings,
  Search, Bell, MoreHorizontal, Plus, Upload, FileText,
  Plug2, TrendingUp, TrendingDown, ChevronRight, ChevronDown, LogOut,
  Calendar, Clock, Users, Mic, Sparkles,
} from "lucide-react";
import { signOut } from "next-auth/react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface User    { name: string; email: string; image: string | null }
interface Profile { orgName: string | null; integrationsCount: number }

interface DashboardShellProps {
  user:    User;
  profile: Profile;
}

// ── Static data ───────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "home",         label: "Inicio",       icon: LayoutDashboard, children: null },
  { id: "meetings",     label: "Reuniones",    icon: Video,           children: null },
  {
    id: "rooms", label: "Salas", icon: DoorOpen, children: [
      { id: "rooms-meetings", label: "Reuniones", icon: Video },
    ],
  },
  { id: "integrations", label: "Integraciones", icon: Puzzle,   children: null },
  { id: "settings",     label: "Configuración", icon: Settings, children: null },
];

const SECTION_TITLES: Record<string, string> = {
  home:            "Inicio",
  meetings:        "Reuniones",
  rooms:           "Salas",
  "rooms-meetings": "Salas · Reuniones",
  integrations:    "Integraciones",
  settings:        "Configuración",
};

const RECENT_MEETINGS = [
  { id: 1, title: "Daily Standup",          date: "Hoy, 10:00",      duration: "30 min",    participants: 5,  status: "completed"  },
  { id: 2, title: "Revisión de sprint Q2",  date: "Ayer, 15:30",     duration: "1h 15min",  participants: 8,  status: "completed"  },
  { id: 3, title: "Llamada con cliente",    date: "Ayer, 11:00",     duration: "45 min",    participants: 3,  status: "processing" },
  { id: 4, title: "Planificación mensual",  date: "23 may, 09:00",   duration: "2h",        participants: 12, status: "completed"  },
  { id: 5, title: "Demo de producto",       date: "22 may, 16:00",   duration: "1h",        participants: 6,  status: "scheduled"  },
];

const STATUS_CONFIG = {
  completed:  { label: "Completada",  className: "bg-green-50  text-green-700  border-green-200"  },
  processing: { label: "Procesando",  className: "bg-blue-50   text-blue-700   border-blue-200"   },
  scheduled:  { label: "Programada",  className: "bg-slate-50  text-slate-600  border-slate-200"  },
} as const;

const QUICK_ACTIONS = [
  { label: "Nueva reunión",        desc: "Inicia o programa una reunión",     icon: Video,    bg: "bg-[#050040]/8",  color: "text-[#050040]" },
  { label: "Importar grabación",   desc: "Sube un archivo de audio o video",  icon: Upload,   bg: "bg-violet-50",    color: "text-violet-600" },
  { label: "Ver transcripciones",  desc: "Accede al historial completo",      icon: FileText, bg: "bg-emerald-50",   color: "text-emerald-600" },
  { label: "Conectar herramienta", desc: "Añade una nueva integración",       icon: Plug2,    bg: "bg-amber-50",     color: "text-amber-600" },
];

// ── Avatar helper ─────────────────────────────────────────────────────────────
function Avatar({ name, image, size = "md" }: { name: string; image: string | null; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  const sizeClass = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-10 h-10 text-sm" }[size];

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt={name} className={cn(sizeClass, "rounded-full object-cover border border-slate-100")} />
    );
  }
  return (
    <div className={cn(sizeClass, "rounded-full bg-[#050040] text-white flex items-center justify-center font-semibold shrink-0")}>
      {initials}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({
  user, profile, activeNav, setActiveNav,
}: { user: User; profile: Profile; activeNav: string; setActiveNav: (id: string) => void }) {
  return (
    <aside className="w-64 shrink-0 flex flex-col bg-white border-r border-slate-100 h-screen">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#050040] rounded-lg flex items-center justify-center shrink-0">
            <svg width="16" height="20" viewBox="0 0 31 40" fill="none">
              <path
                d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585"
                stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#050040] text-sm leading-tight">MeetBox</p>
            {profile.orgName && (
              <p className="text-xs text-slate-400 truncate leading-tight mt-0.5">{profile.orgName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon: Icon, children }) => {
          const active    = activeNav === id || activeNav.startsWith(id + "-");
          const isExpanded = active && !!children;

          return (
            <div key={id}>
              <button
                onClick={() => setActiveNav(children ? (activeNav === id ? "home" : id) : id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  active && !children
                    ? "bg-[#050040] text-white shadow-sm"
                    : active && children
                    ? "bg-[#050040]/8 text-[#050040]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                )}
              >
                <Icon className={cn(
                  "w-4 h-4 shrink-0",
                  active && !children ? "text-white" : active ? "text-[#050040]" : "text-slate-400",
                )} />
                <span className="flex-1 text-left">{label}</span>
                {children ? (
                  <ChevronDown className={cn(
                    "w-3.5 h-3.5 transition-transform",
                    isExpanded ? "rotate-0" : "-rotate-90",
                    active ? "text-[#050040]" : "text-slate-400",
                  )} />
                ) : (
                  active && <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                )}
              </button>

              {/* Sub-items */}
              {children && isExpanded && (
                <div className="ml-4 mt-0.5 pl-3 border-l-2 border-slate-100 space-y-0.5">
                  {children.map(({ id: childId, label: childLabel, icon: ChildIcon }) => {
                    const childActive = activeNav === childId;
                    return (
                      <button
                        key={childId}
                        onClick={() => setActiveNav(childId)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                          childActive
                            ? "bg-[#050040] text-white shadow-sm"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                        )}
                      >
                        <ChildIcon className={cn("w-3.5 h-3.5 shrink-0", childActive ? "text-white" : "text-slate-400")} />
                        {childLabel}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* New meeting CTA */}
      <div className="px-3 pb-3">
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-sm font-medium hover:border-[#050040]/40 hover:text-[#050040] transition-all group">
          <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
          Nueva reunión
        </button>
      </div>

      {/* User profile */}
      <div className="px-3 pb-4 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer">
          <Avatar name={user.name} image={user.image} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate leading-tight">{user.name}</p>
            <p className="text-xs text-slate-400 truncate leading-tight mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/auth" })}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-200"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
function Header({ activeNav, user }: { activeNav: string; user: User }) {
  const [search, setSearch] = React.useState("");

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center gap-4 px-6 shrink-0">

      {/* Section title */}
      <h1 className="text-base font-semibold text-slate-800 min-w-0 shrink-0">
        {SECTION_TITLES[activeNav]}
      </h1>

      {/* Search */}
      <div className="flex-1 max-w-sm relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar reuniones, tareas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/40 focus:ring-2 focus:ring-[#050040]/8 transition"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Notifications */}
        <button className="relative p-2 rounded-xl hover:bg-slate-50 transition-colors group">
          <Bell className="w-5 h-5 text-slate-500 group-hover:text-slate-800 transition-colors" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#050040] rounded-full border-2 border-white" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200" />

        {/* User avatar */}
        <button className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-50 transition-colors">
          <Avatar name={user.name} image={user.image} size="sm" />
          <span className="text-sm font-medium text-slate-700 hidden md:block">{user.name.split(" ")[0]}</span>
        </button>
      </div>
    </header>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({
  label, value, trend, trendUp, icon: Icon, iconBg, iconColor,
}: {
  label:      string;
  value:      string;
  trend:      string;
  trendUp?:   boolean;
  icon:       React.ElementType;
  iconBg:     string;
  iconColor:  string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconBg)}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
          trendUp === undefined ? "bg-slate-50 text-slate-500"
            : trendUp ? "bg-green-50 text-green-700"
            : "bg-red-50 text-red-600",
        )}>
          {trendUp !== undefined && (
            trendUp
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />
          )}
          {trend}
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-800 mb-1">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

// ── Recent meetings ───────────────────────────────────────────────────────────
function RecentMeetings() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Reuniones recientes</h2>
          <p className="text-xs text-slate-400 mt-0.5">Últimas sesiones registradas</p>
        </div>
        <button className="text-xs font-semibold text-[#050040] hover:underline transition flex items-center gap-1">
          Ver todas <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="divide-y divide-slate-50">
        {RECENT_MEETINGS.map((meeting) => {
          const status = STATUS_CONFIG[meeting.status as keyof typeof STATUS_CONFIG];
          return (
            <div
              key={meeting.id}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors group"
            >
              {/* Icon */}
              <div className="w-9 h-9 rounded-xl bg-[#050040]/8 flex items-center justify-center shrink-0">
                <Mic className="w-4 h-4 text-[#050040]" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{meeting.title}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Calendar className="w-3 h-3" />
                    {meeting.date}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    {meeting.duration}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Users className="w-3 h-3" />
                    {meeting.participants}
                  </span>
                </div>
              </div>

              {/* Status */}
              <span className={cn(
                "text-xs font-medium px-2.5 py-1 rounded-full border shrink-0",
                status.className,
              )}>
                {status.label}
              </span>

              {/* Action */}
              <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-200">
                <MoreHorizontal className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Quick actions ─────────────────────────────────────────────────────────────
function QuickActions() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">Acciones rápidas</h2>
        <p className="text-xs text-slate-400 mt-0.5">Próximamente disponible</p>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map(({ label, desc, icon: Icon, bg, color }) => (
          <button
            key={label}
            className="flex flex-col items-start gap-2.5 p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 text-left group"
          >
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", bg)}>
              <Icon className={cn("w-4 h-4", color)} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 leading-tight">{label}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-tight">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Welcome banner ────────────────────────────────────────────────────────────
function WelcomeBanner({ user }: { user: User }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="bg-[#050040] rounded-2xl p-5 flex items-center justify-between overflow-hidden relative mb-6">
      {/* Background decoration */}
      <div className="absolute right-0 top-0 w-48 h-full opacity-10">
        <div className="absolute top-4 right-8 w-24 h-24 rounded-full border-2 border-white" />
        <div className="absolute top-10 right-4 w-14 h-14 rounded-full border-2 border-white" />
      </div>

      <div className="relative">
        <p className="text-white/60 text-xs font-medium mb-1">{greeting},</p>
        <h2 className="text-white font-bold text-lg leading-tight">
          {user.name.split(" ")[0]}
        </h2>
        <p className="text-white/60 text-xs mt-1.5">
          Tienes 3 reuniones programadas para hoy
        </p>
      </div>

      <div className="relative flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-white/60" />
        <span className="text-white/60 text-xs font-medium hidden sm:block">Resumen IA</span>
        <button className="ml-1 bg-white/20 hover:bg-white/30 transition px-3 py-1.5 rounded-lg text-white text-xs font-semibold">
          Ver
        </button>
      </div>
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────
export default function DashboardShell({ user, profile }: DashboardShellProps) {
  const [activeNav, setActiveNav] = React.useState("home");

  const metrics = [
    {
      label:     "Reuniones esta semana",
      value:     "12",
      trend:     "+3 vs semana anterior",
      trendUp:   true,
      icon:      Video,
      iconBg:    "bg-[#050040]/8",
      iconColor: "text-[#050040]",
    },
    {
      label:     "Salas activas",
      value:     "3",
      trend:     "2 en uso ahora",
      trendUp:   true,
      icon:      DoorOpen,
      iconBg:    "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      label:     "Integraciones activas",
      value:     String(profile.integrationsCount || 0),
      trend:     profile.integrationsCount ? "Configuradas" : "Sin configurar",
      trendUp:   profile.integrationsCount > 0 ? true : undefined,
      icon:      Puzzle,
      iconBg:    "bg-violet-50",
      iconColor: "text-violet-600",
    },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar
        user={user}
        profile={profile}
        activeNav={activeNav}
        setActiveNav={setActiveNav}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header activeNav={activeNav} user={user} />

        <main className="flex-1 overflow-y-auto p-6">
          <WelcomeBanner user={user} />

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
          </div>

          {/* Content grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <RecentMeetings />
            </div>
            <div>
              <QuickActions />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
