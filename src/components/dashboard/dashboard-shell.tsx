"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Video, DoorOpen, Calendar, Puzzle, Settings, BookOpen,
  Search, Bell, Plus, FileText, Plug2,
  ChevronRight, ChevronDown, ChevronLeft,
  LogOut, Clock, Users, Sparkles, Menu, X, User, Mail,
  Building2, Shield, CreditCard, Trash2, AlertTriangle, Save,
  Eye, EyeOff, Check, Link2, Zap, CheckCircle2, Globe,
  ArrowRight, MapPin, MessageCircle, Sun, Moon,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { SiSlack, SiGooglecalendar, SiJira, SiNotion } from "react-icons/si";
import { TbBrandTeams, TbBrandZoom } from "react-icons/tb";
import { signOut } from "next-auth/react";
import MeetBookView      from "./meetbook-view";
import MeetCalendarView from "./meetcalendar-view";
import RoomsView        from "./rooms-view";
import MeetingsView     from "./meetings-view";
import OnboardingTour  from "./onboarding-tour";
import MeetyView       from "./meety-view";

// ── Types ─────────────────────────────────────────────────────────────────────
interface User    { name: string; email: string; image: string | null }
interface Profile {
  orgName:      string | null;
  teamSize:     string | null;
  meetingTypes: string[];
  integrations: string[];
}
interface DashboardShellProps { user: User; profile: Profile }

// ── Nav ───────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "home",     label: "Inicio",      icon: LayoutDashboard, children: null },
  { id: "meetings", label: "Reuniones",   icon: Video,           children: null },
  { id: "rooms", label: "Salas", icon: DoorOpen, children: null },
  { id: "meetcalendar", label: "MeetCalendar", icon: Calendar,  children: null },
  { id: "meetbook",     label: "MeetBook",     icon: BookOpen,  children: null },
  { id: "integrations", label: "Integraciones", icon: Puzzle,  children: null },
  {
    id: "settings", label: "Configuración", icon: Settings, children: [
      { id: "settings-profile",       label: "Perfil",          icon: User    },
      { id: "settings-notifications", label: "Notificaciones",  icon: Bell    },
      { id: "settings-security",      label: "Seguridad",       icon: Shield  },
      { id: "settings-account",       label: "Cuenta",          icon: CreditCard },
    ],
  },
];

const SECTION_TITLES: Record<string, string> = {
  home:                    "Inicio",
  meetings:                "Reuniones",
  rooms:                   "Salas",
  "rooms-meetings":        "Salas · Reuniones",
  meetcalendar:            "MeetCalendar",
  meety:                   "Meety · Asistente IA",
  meetbook:                "MeetBook",
  integrations:            "Integraciones",
  "settings-profile":      "Configuración · Perfil",
  "settings-notifications":"Configuración · Notificaciones",
  "settings-security":     "Configuración · Seguridad",
  "settings-account":      "Configuración · Cuenta",
};

// ── Integration catalogue ─────────────────────────────────────────────────────
const INTEGRATION_LIST = [
  { id: "slack",  label: "Slack",            color: "#4A154B", Icon: SiSlack,          desc: "Comparte transcripciones y resúmenes en canales" },
  { id: "teams",  label: "Microsoft Teams",  color: "#5059C9", Icon: TbBrandTeams,     desc: "Sincroniza reuniones y recibe alertas en Teams" },
  { id: "gcal",   label: "Google Calendar",  color: "#1A73E8", Icon: SiGooglecalendar, desc: "Importa y programa reuniones desde tu calendario" },
  { id: "jira",   label: "Jira",             color: "#0052CC", Icon: SiJira,           desc: "Crea tickets automáticos desde los action items" },
  { id: "notion", label: "Notion",           color: "#191919", Icon: SiNotion,         desc: "Exporta notas y actas de reunión a páginas Notion" },
  { id: "zoom",   label: "Zoom",             color: "#2D8CFF", Icon: TbBrandZoom,      desc: "Importa grabaciones de Zoom directamente" },
];

// ── Mock calendar data ────────────────────────────────────────────────────────
const CALENDAR_EVENTS: Record<number, { title: string; time: string; color: string }[]> = {
  20: [{ title: "Kickoff Q2",         time: "09:00", color: "#050040" }],
  22: [{ title: "Demo de producto",   time: "16:00", color: "#059669" }],
  27: [{ title: "Daily Standup",      time: "10:00", color: "#050040" },
       { title: "Planning Q3",        time: "14:00", color: "#7c3aed" }],
  28: [{ title: "Revisión de sprint", time: "15:30", color: "#059669" }],
  29: [{ title: "Llamada cliente",    time: "11:00", color: "#d97706" }],
  3:  [{ title: "1:1 con manager",    time: "10:00", color: "#050040" }],
  5:  [{ title: "Demo interno",       time: "12:00", color: "#059669" }],
};

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_SHORT = ["Lu","Ma","Mi","Ju","Vi","Sá","Do"];

const TEAM_SIZES = [
  { id: "solo",  label: "Solo yo"       },
  { id: "2-10",  label: "2–10 personas" },
  { id: "11-50", label: "11–50 personas"},
  { id: "50+",   label: "50+ personas"  },
];
const MEETING_TYPE_OPTS = [
  { id: "presencial", label: "Presenciales" },
  { id: "virtual",    label: "Virtuales"    },
  { id: "hibrida",    label: "Híbridas"     },
];

// ── Small utilities ───────────────────────────────────────────────────────────
function Avatar({ name, image, size = "md" }: { name: string; image: string | null; size?: "sm" | "md" }) {
  const initials = name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  const sz = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  if (image) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt={name} className={cn(sz, "rounded-full object-cover border border-slate-100 shrink-0")} />
  );
  return (
    <div className={cn(sz, "rounded-full bg-[#050040] text-white flex items-center justify-center font-semibold shrink-0")}>
      {initials}
    </div>
  );
}

function SettingsCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative w-10 h-5.5 rounded-full transition-colors shrink-0",
        enabled ? "bg-[#050040]" : "bg-slate-200",
      )}
      style={{ width: 40, height: 22 }}
    >
      <span className={cn(
        "absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform duration-200",
        enabled ? "translate-x-[20px]" : "translate-x-0.5",
      )} />
    </button>
  );
}

function SaveBtn({ loading, saved }: { loading: boolean; saved: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
        saved
          ? "bg-green-50 text-green-700 border border-green-200"
          : "bg-[#050040] text-white hover:bg-[#050040]/90 disabled:opacity-60",
      )}
    >
      {saved ? <><CheckCircle2 className="w-4 h-4" />Guardado</> : loading ? "Guardando…" : <><Save className="w-4 h-4" />Guardar cambios</>}
    </button>
  );
}

// ── Meety chat button (lives in the sidebar) ─────────────────────────────────
function MeetyButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <div className="relative">
      {/* Outer glow aura */}
      <div
        className="absolute inset-0 rounded-2xl blur-md opacity-50 group-hover:opacity-75 transition-opacity duration-300"
        style={{ background: "linear-gradient(135deg, #050040, #1a1a8c)" }}
      />
      <button
        onClick={onClick}
        className={cn(
          "group relative w-full overflow-hidden rounded-2xl px-4 py-5 text-left transition-all duration-300",
          active
            ? "ring-2 ring-white/40 shadow-2xl scale-[1.01]"
            : "hover:-translate-y-1 hover:shadow-2xl",
        )}
        style={{ background: "linear-gradient(135deg, #050040 0%, #0c0c63 45%, #1a1a8c 100%)" }}
      >
        {/* Decorative orbs */}
        <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/8 group-hover:scale-110 transition-transform duration-500" />
        <div className="absolute -bottom-12 -left-10 w-32 h-32 rounded-full bg-indigo-400/10" />
        <div className="absolute top-3 right-3">
          <Sparkles className="w-3.5 h-3.5 text-white/30 group-hover:text-yellow-300/60 transition-colors duration-300" />
        </div>

        {/* Main content — centred column */}
        <div className="relative flex flex-col items-center text-center gap-3">
          {/* Avatar with ping ring */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full bg-indigo-400/30 animate-ping"
              style={{ animationDuration: "2.5s" }}
            />
            <div className="relative w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/undraw_ai-research-assistant_cxx0.svg" alt="" className="w-11 h-11 object-contain" />
            </div>
          </div>

          {/* Text */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1.5">
              <p className="text-base font-bold text-white leading-tight">Chatea con Meety</p>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            </div>
            <p className="text-xs text-white/65 leading-snug">
              Tu asistente IA — siempre listo
            </p>
          </div>

          {/* CTA chip */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 group-hover:bg-white/25 transition-colors duration-300 border border-white/10">
            <MessageCircle className="w-3.5 h-3.5 text-white/80" />
            <span className="text-[11px] font-semibold text-white/90">Iniciar conversación</span>
          </div>
        </div>
      </button>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function SidebarContent({
  user, profile, activeNav, setActiveNav, onClose, onMeetyOpen,
}: {
  user: User; profile: Profile;
  activeNav: string; setActiveNav: (id: string) => void;
  onClose?: () => void; onMeetyOpen: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-[#050040] rounded-xl flex items-center justify-center shrink-0">
            <svg width="15" height="19" viewBox="0 0 31 40" fill="none">
              <path d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585"
                stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#050040] text-base leading-tight">MeetBox</p>
            {profile.orgName && (
              <p className="text-sm text-slate-400 truncate leading-tight mt-0.5">{profile.orgName}</p>
            )}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 transition-colors ml-2 shrink-0">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon: Icon, children }) => {
          const active     = activeNav === id || activeNav.startsWith(id + "-");
          const isExpanded = active && !!children;
          const isRooms    = id === "rooms";

          return (
            <div key={id} className={cn("relative", isRooms && "group/rooms")}>
              <button
                onClick={() => {
                  if (children) {
                    if (!active) { setActiveNav(children[0].id); onClose?.(); }
                  } else {
                    setActiveNav(id); onClose?.();
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all",
                  isRooms && "pr-11",
                  active && !children ? "bg-[#050040] text-white shadow-sm"
                    : active          ? "bg-[#050040]/8 text-[#050040]"
                    :                   "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                )}
              >
                <Icon className={cn(
                  "w-5 h-5 shrink-0",
                  active && !children ? "text-white" : active ? "text-[#050040]" : "text-slate-400",
                )} />
                <span className="flex-1 text-left">{label}</span>
                {children
                  ? <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isExpanded ? "rotate-0" : "-rotate-90", active ? "text-[#050040]" : "text-slate-400")} />
                  : active && !isRooms && <ChevronRight className="w-4 h-4 opacity-70" />
                }
              </button>

              {/* Reuniones hover button — only for Salas */}
              {isRooms && (
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveNav("rooms-meetings"); onClose?.(); }}
                  title="Reuniones"
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all",
                    activeNav === "rooms-meetings"
                      ? "opacity-100 bg-white/25 text-white"
                      : cn(
                          "opacity-0 group-hover/rooms:opacity-100",
                          active ? "text-white hover:bg-white/20" : "text-slate-400 hover:bg-slate-200 hover:text-slate-700",
                        ),
                  )}
                >
                  <Video className="w-4 h-4" />
                </button>
              )}

              {children && isExpanded && (
                <div className="ml-4 mt-0.5 pl-3 border-l-2 border-slate-100 space-y-0.5">
                  {children.map(({ id: cid, label: clabel, icon: CIcon }) => {
                    const ca = activeNav === cid;
                    return (
                      <button
                        key={cid}
                        onClick={() => { setActiveNav(cid); onClose?.(); }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                          ca ? "bg-[#050040] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                        )}
                      >
                        <CIcon className={cn("w-4 h-4 shrink-0", ca ? "text-white" : "text-slate-400")} />
                        {clabel}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Meety chat button */}
      <div className="px-4 pt-2 pb-4 shrink-0">
        <MeetyButton active={activeNav === "meety"} onClick={() => { onMeetyOpen(); onClose?.(); }} />
      </div>

      {/* User */}
      <div className="px-3 pb-4 pt-2 border-t border-slate-100 shrink-0">
        <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer">
          <Avatar name={user.name} image={user.image} />
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
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
const USER_MENU = [
  { id: "settings-profile",       label: "Perfil",         icon: User       },
  { id: "settings-notifications", label: "Notificaciones", icon: Bell       },
  { id: "settings-security",      label: "Seguridad",      icon: Shield     },
  { id: "settings-account",       label: "Cuenta",         icon: CreditCard },
  { id: "integrations",           label: "Integraciones",  icon: Puzzle     },
];

// ── Theme toggle button ────────────────────────────────────────────────────────
function ThemeToggleBtn() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={toggleTheme}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={cn(
        "relative p-2 rounded-xl transition-all duration-300 shrink-0 group overflow-hidden",
        isDark
          ? "bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300"
          : "hover:bg-slate-50 text-slate-500 hover:text-slate-800",
      )}
    >
      <span className="relative block w-5 h-5">
        <Sun
          className={cn(
            "absolute inset-0 w-5 h-5 transition-all duration-300",
            isDark ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100",
          )}
        />
        <Moon
          className={cn(
            "absolute inset-0 w-5 h-5 transition-all duration-300",
            isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50",
          )}
        />
      </span>
    </button>
  );
}

function Header({ activeNav, user, onMenuClick, setActiveNav }: {
  activeNav: string; user: User; onMenuClick: () => void; setActiveNav: (id: string) => void;
}) {
  const [search, setSearch] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  return (
    <header className="h-20 bg-white border-b border-slate-100 flex items-center gap-3 px-5 lg:px-8 shrink-0">
      <button onClick={onMenuClick} className="lg:hidden p-2 rounded-xl hover:bg-slate-50 transition-colors shrink-0">
        <Menu className="w-5 h-5 text-slate-600" />
      </button>
      {/* Title — hidden when search is open on mobile to free space for the avatar */}
      <h1 className={cn(
        "text-base font-semibold text-slate-800 min-w-0 truncate",
        searchOpen ? "hidden md:block" : "block",
      )}>
        {SECTION_TITLES[activeNav] ?? "Dashboard"}
      </h1>
      <div className="hidden md:flex flex-1 max-w-sm relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input type="text" placeholder="Buscar reuniones..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm placeholder:text-slate-400 outline-none focus:border-[#050040]/40 focus:ring-2 focus:ring-[#050040]/8 transition" />
      </div>
      {searchOpen && (
        <div className="md:hidden flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input autoFocus type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
            onBlur={() => { if (!search) setSearchOpen(false); }}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:border-[#050040]/40 transition" />
        </div>
      )}
      {/* Right side — always shrink-0 so the avatar is never pushed off screen */}
      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        {!searchOpen && (
          <button onClick={() => setSearchOpen(true)} className="md:hidden p-2 rounded-xl hover:bg-slate-50 transition-colors shrink-0">
            <Search className="w-5 h-5 text-slate-500" />
          </button>
        )}
        {/* Theme toggle */}
        <ThemeToggleBtn />
        <button className="relative p-2 rounded-xl hover:bg-slate-50 transition-colors group shrink-0">
          <Bell className="w-5 h-5 text-slate-500 group-hover:text-slate-800 transition-colors" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#050040] rounded-full border-2 border-white" />
        </button>
        <div className="hidden sm:block w-px h-6 bg-slate-200 shrink-0" />
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              "flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl transition-colors",
              menuOpen ? "bg-slate-100" : "hover:bg-slate-50",
            )}
          >
            <Avatar name={user.name} image={user.image} size="sm" />
            <span className="text-sm font-medium text-slate-700 hidden sm:block">{user.name.split(" ")[0]}</span>
            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform hidden sm:block", menuOpen && "rotate-180")} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-0 top-full mt-2 z-50 w-60 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden"
                style={{ animation: "userMenu 0.16s cubic-bezier(0.16,1,0.3,1) both" }}
              >
                <style>{`@keyframes userMenu{from{opacity:0;transform:scale(0.96) translateY(-6px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

                {/* User header */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
                  <Avatar name={user.name} image={user.image} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{user.name}</p>
                    <p className="text-xs text-slate-400 truncate leading-tight mt-0.5">{user.email}</p>
                  </div>
                </div>

                {/* Options */}
                <div className="py-1.5">
                  {USER_MENU.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => { setActiveNav(id); setMenuOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors",
                        activeNav === id ? "text-[#050040] bg-[#050040]/5" : "text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      <Icon className={cn("w-4 h-4 shrink-0", activeNav === id ? "text-[#050040]" : "text-slate-400")} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Logout */}
                <div className="border-t border-slate-100 py-1.5">
                  <button
                    onClick={() => signOut({ callbackUrl: "/auth" })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ── Home view ─────────────────────────────────────────────────────────────────
interface HomeMeeting {
  id: string; title: string; start_at: string; end_at: string | null;
  all_day: boolean; color: string; location: string | null;
  room: { name: string; emoji: string; color: string } | null;
}

function homeTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function relativeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  if (mins <= 0) return "ahora mismo";
  if (mins < 60) return `en ${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs < 24) return rem > 0 ? `en ${hrs} h ${rem} min` : `en ${hrs} h`;
  return "más tarde hoy";
}

const HOME_GATEWAYS = [
  { id: "meetcalendar", label: "MeetCalendar", desc: "Tu calendario y eventos",        icon: Calendar, color: "#050040" },
  { id: "rooms",        label: "Salas",        desc: "Tus espacios y equipos",         icon: DoorOpen, color: "#059669" },
  { id: "meetbook",     label: "MeetBook",     desc: "Notas, ideas y documentos",      icon: BookOpen, color: "#7c3aed" },
  { id: "meetings",     label: "Reuniones",    desc: "Hoy, grabaciones e historial",   icon: Video,    color: "#d97706" },
];

function HomeView({ user, onNavigate }: { user: User; onNavigate: (id: string) => void }) {
  const [meetings, setMeetings] = React.useState<HomeMeeting[]>([]);
  const [loading,  setLoading]  = React.useState(true);

  React.useEffect(() => {
    fetch("/api/meetings/today")
      .then((r) => r.ok ? r.json() : { meetings: [] })
      .then((d) => setMeetings(d.meetings ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const firstName = user.name.split(" ")[0];
  const dateStr   = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  const now      = Date.now();
  const upcoming = meetings
    .filter((m) => !m.all_day && new Date(m.start_at).getTime() >= now - 5 * 60000)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const next     = upcoming[0] ?? null;

  const contextual = loading
    ? "Preparando tu día…"
    : next
      ? <>Tu próxima reunión es <span className="text-white font-semibold">{relativeUntil(next.start_at)}</span>.</>
      : meetings.length > 0
        ? "Ya pasaron tus reuniones de hoy. Buen trabajo. 👏"
        : "No tienes reuniones hoy. Un buen momento para ordenar tus ideas.";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl px-8 py-10 sm:px-12 sm:py-14 min-h-[230px] sm:min-h-[260px] flex flex-col justify-center"
        style={{ background: "linear-gradient(135deg, #050040 0%, #0c0c63 55%, #1a1a8c 100%)" }}>
        <div className="absolute -top-20 -right-12 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-24 right-1/4 w-60 h-60 rounded-full bg-white/5" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/undraw_online-meeting_qe61.svg" alt=""
          className="hidden lg:block absolute right-8 -bottom-6 w-56 xl:w-64 opacity-95 pointer-events-none select-none" draggable={false} />

        <div className="relative max-w-lg">
          <div className="flex items-center gap-3 mb-5">
            <Avatar name={user.name} image={user.image} />
            <p className="text-sm font-medium text-white/60 capitalize">{dateStr}</p>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-base sm:text-lg text-white/70 mt-3 leading-relaxed">{contextual}</p>
        </div>
      </div>

      {/* ── Focus: próxima reunión ── */}
      {!loading && next ? (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-6 pt-5 pb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#050040]" />
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Lo que sigue</h2>
          </div>
          <div className="px-6 pb-6 flex items-center gap-5">
            <div className="text-center shrink-0 w-20">
              <p className="text-3xl font-bold leading-none" style={{ color: next.color }}>{homeTime(next.start_at)}</p>
              {next.end_at && <p className="text-sm text-slate-400 mt-1.5">{homeTime(next.end_at)}</p>}
            </div>
            <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: next.color }} />
            <div className="flex-1 min-w-0">
              <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-1.5"
                style={{ backgroundColor: next.color + "18", color: next.color }}>
                {relativeUntil(next.start_at)}
              </span>
              <h3 className="text-lg font-semibold text-slate-800 truncate">{next.title}</h3>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {next.room && (
                  <span className="text-sm font-medium text-slate-500">{next.room.emoji} {next.room.name}</span>
                )}
                {next.location && (
                  <span className="flex items-center gap-1 text-sm text-slate-400 truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />{next.location}
                  </span>
                )}
                {upcoming.length > 1 && (
                  <span className="flex items-center gap-1 text-sm text-slate-400">
                    <Clock className="w-3.5 h-3.5 shrink-0" />+{upcoming.length - 1} más hoy
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => onNavigate("meetcalendar")}
              className="shrink-0 flex items-center gap-1.5 px-5 py-3 rounded-xl bg-[#050040] text-white text-sm font-semibold hover:bg-[#050040]/90 transition-colors">
              <span className="hidden sm:inline">Ver</span><ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : !loading && (
        <div className="bg-white rounded-2xl border border-slate-100 px-7 py-6 flex items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/undraw_writing-online_x665.svg" alt="" className="hidden sm:block w-28 h-auto shrink-0" draggable={false} />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-800">Tu día está despejado</h3>
            <p className="text-sm text-slate-400 mt-1">Captura ideas en MeetBook o planifica algo en tu calendario.</p>
          </div>
          <button onClick={() => onNavigate("meetbook")}
            className="shrink-0 flex items-center gap-1.5 px-5 py-3 rounded-xl bg-[#050040]/8 text-[#050040] text-sm font-semibold hover:bg-[#050040]/12 transition-colors">
            Abrir MeetBook<ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Gateways ── */}
      <div>
        <h2 className="text-base font-bold text-slate-700 mb-4 px-1">¿Por dónde empezamos, {firstName}?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {HOME_GATEWAYS.map(({ id, label, desc, icon: Icon, color }) => (
            <button key={id} onClick={() => onNavigate(id)}
              className="group relative text-left bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1.5 transition-all group-hover:w-2" style={{ backgroundColor: color }} />
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                style={{ backgroundColor: color + "15" }}>
                <Icon className="w-7 h-7" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold text-slate-800 group-hover:text-[#050040] transition-colors">{label}</p>
                <p className="text-sm text-slate-400 mt-0.5">{desc}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* ── Closing line ── */}
      <p className="text-center text-xs text-slate-300 pt-2 pb-1">
        Hecho para que tus reuniones fluyan · <span className="font-semibold text-slate-400">MeetBox</span>
      </p>
    </div>
  );
}

// ── Calendar view ─────────────────────────────────────────────────────────────
function CalendarView() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = React.useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayRaw = new Date(year, month, 1).getDay();
  const startOffset = (firstDayRaw + 6) % 7;

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const cells = Array.from({ length: startOffset + daysInMonth }, (_, i) =>
    i < startOffset ? null : i - startOffset + 1,
  );
  while (cells.length % 7 !== 0) cells.push(null);

  const upcomingEvents = Object.entries(CALENDAR_EVENTS)
    .flatMap(([day, evs]) => evs.map((e) => ({ day: Number(day), ...e })))
    .filter(({ day }) => day >= today.getDate() || month > today.getMonth())
    .sort((a, b) => a.day - b.day)
    .slice(0, 8);

  return (
    <div
      className="flex flex-col lg:flex-row gap-4"
      style={{ minHeight: "calc(100vh - 7rem)" }}
    >
      {/* ── Main calendar card ── */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-5 flex flex-col min-h-0">

        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {MONTHS_ES[month]} <span className="text-slate-400 font-normal">{year}</span>
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200"
            >
              Hoy
            </button>
            <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 shrink-0 mb-1">
          {DAYS_SHORT.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-slate-400 py-2">{d}</div>
          ))}
        </div>

        {/* Cells — flex-1 so the grid fills remaining card height */}
        <div
          className="flex-1 grid grid-cols-7 gap-px bg-slate-100 rounded-2xl overflow-hidden"
          style={{ gridAutoRows: "1fr" }}
        >
          {cells.map((day, idx) => {
            const events = day ? (CALENDAR_EVENTS[day] ?? []) : [];
            const today_ = day ? isToday(day) : false;
            return (
              <div
                key={idx}
                className={cn(
                  "bg-white p-2 cursor-pointer transition-colors flex flex-col",
                  day ? "hover:bg-slate-50" : "pointer-events-none",
                  today_ && "bg-[#050040]/5 hover:bg-[#050040]/8",
                  !day && "opacity-0",
                )}
              >
                {day && (
                  <>
                    <span className={cn(
                      "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full shrink-0",
                      today_ ? "bg-[#050040] text-white" : "text-slate-600",
                    )}>
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5 flex-1 overflow-hidden">
                      {events.slice(0, 3).map((ev, i) => (
                        <div
                          key={i}
                          className="text-[10px] leading-tight rounded-md px-1.5 py-0.5 truncate hidden sm:block font-medium text-white"
                          style={{ backgroundColor: ev.color }}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {events.length > 0 && (
                        <div className="flex gap-0.5 sm:hidden mt-1">
                          {events.map((ev, i) => (
                            <span key={i} className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Upcoming panel ── */}
      <div className="w-full lg:w-72 shrink-0 bg-white rounded-2xl border border-slate-100 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-sm font-semibold text-slate-800">Próximas reuniones</h2>
          <p className="text-xs text-slate-400 mt-0.5">{MONTHS_ES[month]} {year}</p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {upcomingEvents.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Sin reuniones próximas</p>
            </div>
          ) : (
            upcomingEvents.map(({ day, title, time, color }, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-4 hover:bg-slate-50/60 transition-colors">
                <div className="text-center shrink-0 w-10">
                  <p className="text-lg font-bold text-slate-800 leading-none">{day}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{MONTHS_ES[month].slice(0, 3)}</p>
                </div>
                <div className="w-0.5 h-9 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3 shrink-0" />{time}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-100 shrink-0">
          <button className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-[#050040] hover:underline py-1">
            <Plus className="w-3.5 h-3.5" />Nueva reunión
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Integrations view ─────────────────────────────────────────────────────────
function IntegrationsView({ profile, onUpdate }: { profile: Profile; onUpdate: (p: Partial<Profile>) => void }) {
  const [connected, setConnected] = React.useState<string[]>(profile.integrations);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [customInput, setCustomInput] = React.useState("");
  const [customList, setCustomList] = React.useState<string[]>(
    profile.integrations.filter((id) => !INTEGRATION_LIST.find((x) => x.id === id)),
  );

  async function toggle(id: string) {
    const next = connected.includes(id) ? connected.filter((x) => x !== id) : [...connected, id];
    setSaving(id);
    await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integrations: [...next.filter((x) => !INTEGRATION_LIST.find((i) => i.id === x) ? false : true), ...customList] }),
    });
    setConnected(next);
    onUpdate({ integrations: next });
    setSaving(null);
  }

  async function addCustom() {
    const val = customInput.trim();
    if (!val || customList.includes(val)) return;
    const next = [...customList, val];
    setCustomList(next);
    setCustomInput("");
    await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integrations: [...connected, ...next] }),
    });
    onUpdate({ integrations: [...connected, ...next] });
  }

  async function removeCustom(tag: string) {
    const next = customList.filter((x) => x !== tag);
    setCustomList(next);
    await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integrations: [...connected, ...next] }),
    });
    onUpdate({ integrations: [...connected, ...next] });
  }

  const connectedCount = connected.length + customList.length;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Hero banner */}
      <div className="relative bg-white rounded-2xl border border-slate-100 overflow-hidden px-6 py-5 flex items-center gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/undraw_programming_j1zw.svg" alt="" className="hidden sm:block w-28 h-auto shrink-0 object-contain" draggable={false} />
        <div>
          <h2 className="text-2xl font-bold text-[#050040]">Integraciones</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Conecta tus herramientas con MeetBox · <span className="font-medium text-slate-700">{connectedCount} conectada{connectedCount !== 1 ? "s" : ""}</span>
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {INTEGRATION_LIST.map(({ id, label, color, Icon, desc }) => {
          const isConnected = connected.includes(id);
          const isLoading   = saving === id;
          return (
            <div key={id} className={cn(
              "bg-white rounded-2xl border p-4 sm:p-5 flex items-center gap-4 transition-all",
              isConnected ? "border-[#050040]/20 shadow-sm" : "border-slate-100",
            )}>
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0">
                <Icon style={{ color }} className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{label}</p>
                  {isConnected && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" />Conectado
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{desc}</p>
              </div>
              <button
                onClick={() => toggle(id)}
                disabled={isLoading}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50",
                  isConnected
                    ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
                    : "bg-[#050040] text-white hover:bg-[#050040]/90",
                )}
              >
                {isLoading ? "…" : isConnected ? <><Zap className="w-3.5 h-3.5" />Desconectar</> : <><Link2 className="w-3.5 h-3.5" />Conectar</>}
              </button>
            </div>
          );
        })}
      </div>

      {/* Custom integrations */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Otras herramientas</h3>
        <p className="text-xs text-slate-400 mb-4">Añade integraciones personalizadas que usa tu equipo</p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            placeholder="Nombre de la herramienta…"
            className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm placeholder:text-slate-400 outline-none focus:border-[#050040]/40 transition"
          />
          <button onClick={addCustom} className="px-3 py-2 bg-[#050040] text-white rounded-xl text-sm font-semibold hover:bg-[#050040]/90 transition">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {customList.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {customList.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1.5 bg-[#050040]/8 text-[#050040] rounded-xl px-3 py-1.5 text-xs font-medium">
                {tag}
                <button onClick={() => removeCustom(tag)} className="opacity-60 hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Settings: Perfil ──────────────────────────────────────────────────────────
function SettingsProfile({ user, profile, onUpdate }: { user: User; profile: Profile; onUpdate: (p: Partial<Profile>) => void }) {
  const [orgName,      setOrgName]      = React.useState(profile.orgName ?? "");
  const [teamSize,     setTeamSize]     = React.useState(profile.teamSize ?? "");
  const [meetingTypes, setMeetingTypes] = React.useState<string[]>(profile.meetingTypes);
  const [loading, setLoading] = React.useState(false);
  const [saved,   setSaved]   = React.useState(false);
  const [error,   setError]   = React.useState("");

  function toggleMeeting(id: string) {
    setMeetingTypes((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) { setError("El nombre de la organización es requerido"); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgName, teamSize, meetingTypes }),
    });
    setLoading(false);
    if (res.ok) {
      setSaved(true);
      onUpdate({ orgName, teamSize, meetingTypes });
      setTimeout(() => setSaved(false), 3000);
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al guardar");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-[#050040]">Perfil</h2>
        <p className="text-sm text-slate-500 mt-1">Gestiona tu información personal y la de tu organización</p>
      </div>

      {/* Personal info */}
      <SettingsCard title="Información personal" desc="Datos de tu cuenta de MeetBox">
        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-slate-100">
          <Avatar name={user.name} image={user.image} />
          <div>
            <p className="text-sm font-semibold text-slate-800">{user.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              <User className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />Nombre completo
            </label>
            <input
              type="text"
              value={user.name}
              readOnly
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500 cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1">El nombre se gestiona desde tu proveedor de inicio de sesión</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              <Mail className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />Correo electrónico
            </label>
            <input
              type="email"
              value={user.email}
              readOnly
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500 cursor-not-allowed"
            />
          </div>
        </div>
      </SettingsCard>

      {/* Organisation */}
      <SettingsCard title="Organización" desc="Configura el espacio de trabajo de tu equipo">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              <Building2 className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />Nombre de la organización
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Ej. Acme Corp"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 focus:ring-2 focus:ring-[#050040]/8 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              <Users className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />Tamaño del equipo
            </label>
            <div className="flex flex-wrap gap-2">
              {TEAM_SIZES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTeamSize(id)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                    teamSize === id
                      ? "bg-[#050040] text-white border-[#050040]"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Meeting preferences */}
      <SettingsCard title="Tipos de reunión" desc="¿Qué modalidades de reunión usa tu equipo?">
        <div className="flex flex-wrap gap-2">
          {MEETING_TYPE_OPTS.map(({ id, label }) => {
            const active = meetingTypes.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleMeeting(id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all",
                  active ? "bg-[#050040] text-white border-[#050040]" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300",
                )}
              >
                {active && <Check className="w-3.5 h-3.5" />}
                {label}
              </button>
            );
          })}
        </div>
      </SettingsCard>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>}
      <div className="flex justify-end"><SaveBtn loading={loading} saved={saved} /></div>
    </form>
  );
}

// ── Settings: Notificaciones ──────────────────────────────────────────────────
function SettingsNotifications() {
  const PREFS_KEY = "meetbox_notif_prefs";
  const defaults  = { meetings: true, weekly: true, browser: false, integrations: true, transcripts: true };
  const [prefs, setPrefs] = React.useState(defaults);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) setPrefs({ ...defaults, ...JSON.parse(stored) });
    } catch { /* ignore */ }
  }, []);

  function update(key: keyof typeof prefs, val: boolean) {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const rows: { key: keyof typeof prefs; label: string; desc: string; icon: React.ElementType }[] = [
    { key: "meetings",     label: "Recordatorios de reuniones",  desc: "15 minutos antes de cada reunión programada",    icon: Calendar  },
    { key: "weekly",       label: "Resumen semanal por email",   desc: "Todos los lunes con el resumen de la semana",    icon: Mail      },
    { key: "browser",      label: "Notificaciones del navegador",desc: "Alertas en tiempo real dentro del navegador",    icon: Globe     },
    { key: "integrations", label: "Alertas de integración",      desc: "Cuando hay errores de sincronización",           icon: Plug2     },
    { key: "transcripts",  label: "Nuevas transcripciones",      desc: "Cuando se termina de procesar una grabación",    icon: FileText  },
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#050040]">Notificaciones</h2>
          <p className="text-sm text-slate-500 mt-1">Controla cómo y cuándo MeetBox te avisa</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-xl">
            <CheckCircle2 className="w-3.5 h-3.5" />Guardado
          </span>
        )}
      </div>

      <SettingsCard title="Preferencias de notificación">
        <div className="space-y-4">
          {rows.map(({ key, label, desc, icon: Icon }) => (
            <div key={key} className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
              </div>
              <Toggle enabled={prefs[key]} onChange={(v) => update(key, v)} />
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}

// ── Settings: Seguridad ───────────────────────────────────────────────────────
function SettingsSecurity() {
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew,     setShowNew]     = React.useState(false);
  const [current,     setCurrent]     = React.useState("");
  const [newPwd,      setNewPwd]      = React.useState("");
  const [confirm,     setConfirm]     = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [msg,     setMsg]     = React.useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 8) { setMsg({ type: "err", text: "La nueva contraseña debe tener al menos 8 caracteres" }); return; }
    if (newPwd !== confirm)  { setMsg({ type: "err", text: "Las contraseñas no coinciden" }); return; }
    setLoading(true); setMsg(null);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setMsg({ type: "ok", text: "Contraseña actualizada correctamente" });
    setCurrent(""); setNewPwd(""); setConfirm("");
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-[#050040]">Seguridad</h2>
        <p className="text-sm text-slate-500 mt-1">Administra la seguridad de tu cuenta</p>
      </div>

      {/* Password change */}
      <SettingsCard title="Cambiar contraseña" desc="Actualiza tu contraseña de acceso">
        <form onSubmit={handleChange} className="space-y-3">
          {[
            { label: "Contraseña actual",     val: current,  set: setCurrent,  show: showCurrent, toggle: () => setShowCurrent((p) => !p) },
            { label: "Nueva contraseña",      val: newPwd,   set: setNewPwd,   show: showNew,     toggle: () => setShowNew((p) => !p) },
            { label: "Confirmar contraseña",  val: confirm,  set: setConfirm,  show: showNew,     toggle: () => setShowNew((p) => !p) },
          ].map(({ label, val, set, show, toggle }) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 outline-none focus:border-[#050040]/50 focus:ring-2 focus:ring-[#050040]/8 transition"
                />
                <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
          {msg && (
            <p className={cn(
              "text-xs rounded-xl px-3 py-2.5 border",
              msg.type === "ok"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-red-50 text-red-600 border-red-100",
            )}>
              {msg.text}
            </p>
          )}
          <div className="flex justify-end pt-1">
            <SaveBtn loading={loading} saved={msg?.type === "ok"} />
          </div>
        </form>
      </SettingsCard>

      {/* Connected accounts */}
      <SettingsCard title="Métodos de inicio de sesión" desc="Cuentas vinculadas a tu perfil">
        <div className="space-y-3">
          {[
            { label: "Google",              desc: "Inicio de sesión con Google OAuth", connected: true,  icon: "G", color: "#EA4335" },
            { label: "Correo electrónico",  desc: "Inicio de sesión con email y OTP",  connected: true,  icon: "@", color: "#050040" },
          ].map(({ label, desc, connected: c, icon, color }) => (
            <div key={label} className="flex items-center gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: color }}>
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
              </div>
              {c && (
                <span className="flex items-center gap-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-full shrink-0">
                  <Check className="w-3 h-3" />Activo
                </span>
              )}
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* Sessions */}
      <SettingsCard title="Sesiones activas" desc="Cierra sesión en todos los dispositivos">
        <button
          onClick={() => signOut({ callbackUrl: "/auth" })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión en todos los dispositivos
        </button>
      </SettingsCard>
    </div>
  );
}

// ── Settings: Cuenta ──────────────────────────────────────────────────────────
function SettingsAccount({ user }: { user: User }) {
  const [confirmDelete, setConfirmDelete] = React.useState("");
  const [showDialog,    setShowDialog]    = React.useState(false);

  return (
    <div className="max-w-2xl space-y-5">
      <div className="relative bg-white rounded-2xl border border-slate-100 overflow-hidden px-6 py-5 flex items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/undraw_budgeting_klon.svg" alt="" className="hidden sm:block w-24 h-auto shrink-0 object-contain" draggable={false} />
        <div>
          <h2 className="text-2xl font-bold text-[#050040]">Cuenta</h2>
          <p className="text-sm text-slate-500 mt-0.5">Gestiona tu plan y datos de cuenta</p>
        </div>
      </div>

      {/* Plan */}
      <SettingsCard title="Plan actual" desc="Tu suscripción activa en MeetBox">
        <div className="flex items-center gap-4 p-4 rounded-xl bg-[#050040]/4 border border-[#050040]/10">
          <div className="w-10 h-10 rounded-xl bg-[#050040] flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#050040]">Plan Free</p>
            <p className="text-xs text-slate-500 mt-0.5">Hasta 5 reuniones/mes · 1 integración · Transcripción básica</p>
          </div>
          <button className="shrink-0 px-4 py-2 bg-[#050040] text-white rounded-xl text-xs font-semibold hover:bg-[#050040]/90 transition">
            Mejorar plan
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Reuniones",    value: "3 / 5",   pct: 60 },
            { label: "Integraciones",value: "1 / 1",   pct: 100 },
            { label: "Almacenamiento",value: "120 MB", pct: 24 },
          ].map(({ label, value, pct }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-100 p-3">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className="text-sm font-semibold text-slate-800 mb-2">{value}</p>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", pct >= 100 ? "bg-red-400" : "bg-[#050040]")} style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* Export data */}
      <SettingsCard title="Tus datos" desc="Descarga o exporta tu información">
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-[#050040]/30 hover:text-[#050040] transition-all">
          <FileText className="w-4 h-4" />
          Exportar todos mis datos
        </button>
        <p className="text-xs text-slate-400 mt-2">Se generará un archivo ZIP con tus reuniones, transcripciones y configuración</p>
      </SettingsCard>

      {/* Danger zone */}
      <div className="bg-white rounded-2xl border border-red-100 p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-700">Zona de peligro</h3>
            <p className="text-xs text-slate-400 mt-0.5">Estas acciones son irreversibles</p>
          </div>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-100 transition-all"
        >
          <Trash2 className="w-4 h-4" />
          Eliminar mi cuenta
        </button>
      </div>

      {/* Delete dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">¿Eliminar cuenta?</h3>
                <p className="text-xs text-slate-400 mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Escribe <span className="font-semibold text-slate-700">{user.email}</span> para confirmar.
            </p>
            <input
              type="text"
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder={user.email}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:border-red-300 transition mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowDialog(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                disabled={confirmDelete !== user.email}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-red-600 transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Placeholder view ──────────────────────────────────────────────────────────
function PlaceholderView({ title }: { title: string; icon?: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/undraw_my-app_jscv.svg" alt="" className="w-52 h-auto mb-6 opacity-90" draggable={false} />
      <h2 className="text-base font-semibold text-slate-700">{title}</h2>
      <p className="text-sm text-slate-400 mt-1">Esta sección estará disponible muy pronto</p>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
export default function DashboardShell({ user, profile: initialProfile }: DashboardShellProps) {
  const [activeNav,   setActiveNav]   = React.useState("home");
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [profile,     setProfile]     = React.useState<Profile>(initialProfile);

  React.useEffect(() => {
    const handler = () => { if (window.innerWidth >= 1024) setSidebarOpen(false); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  function handleProfileUpdate(updates: Partial<Profile>) {
    setProfile((prev) => ({ ...prev, ...updates }));
  }

  function renderContent() {
    switch (activeNav) {
      case "home":                    return <HomeView user={user} onNavigate={setActiveNav} />;
      case "meetcalendar":            return <MeetCalendarView />;
      case "meetbook":                return <MeetBookView />;
      case "integrations":            return <IntegrationsView profile={profile} onUpdate={handleProfileUpdate} />;
      case "settings-profile":        return <SettingsProfile user={user} profile={profile} onUpdate={handleProfileUpdate} />;
      case "settings-notifications":  return <SettingsNotifications />;
      case "settings-security":       return <SettingsSecurity />;
      case "settings-account":        return <SettingsAccount user={user} />;
      case "meetings":                return <MeetingsView />;
      case "rooms":                   return <RoomsView />;
      case "rooms-meetings":          return <RoomsView />;
      case "meety":                   return <MeetyView userName={user.name.split(" ")[0]} userImage={user.image} />;
      default:                        return <HomeView user={user} onNavigate={setActiveNav} />;
    }
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-72 shrink-0 flex-col border-r border-slate-100">
        <SidebarContent user={user} profile={profile} activeNav={activeNav} setActiveNav={setActiveNav} onMeetyOpen={() => setActiveNav("meety")} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 max-w-[85vw] shadow-2xl">
            <SidebarContent user={user} profile={profile} activeNav={activeNav} setActiveNav={setActiveNav} onClose={() => setSidebarOpen(false)} onMeetyOpen={() => setActiveNav("meety")} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header activeNav={activeNav} user={user} onMenuClick={() => setSidebarOpen(true)} setActiveNav={setActiveNav} />
        <main className={cn(
          "flex-1 min-h-0",
          (activeNav === "meetbook" || activeNav === "meetcalendar" || activeNav === "meety")
            ? "overflow-hidden"
            : "overflow-y-auto p-4 sm:p-6",
        )}>
          {renderContent()}
        </main>
      </div>

      {/* Section-by-section product tours (shown after the wizard finishes) */}
      <OnboardingTour
        userName={user.name.split(" ")[0]}
        userEmail={user.email}
        activeNav={activeNav}
      />

    </div>
  );
}
