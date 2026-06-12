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
  Monitor, Copy, RefreshCw, Download, Cpu,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useTranslation, type Locale, type TranslationKey } from "@/lib/i18n";
import { SiSlack, SiGooglecalendar, SiJira, SiNotion } from "react-icons/si";
import { TbBrandTeams, TbBrandZoom } from "react-icons/tb";
import { signOut } from "next-auth/react";
import MeetBookView      from "./meetbook-view";
import MeetCalendarView from "./meetcalendar-view";
import RoomsView        from "./rooms-view";
import MeetingsView     from "./meetings-view";
import OnboardingTour  from "./onboarding-tour";
import MeetyView       from "./meety-view";
import MeetActionView  from "./meetaction-view";
import PlansView       from "./plans-view";
import { NotificationProvider, useNotifications } from "@/lib/notifications";

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
function getNavItems(t: (k: TranslationKey) => string) {
  return [
    { id: "home",     label: t("nav_home"),         icon: LayoutDashboard, children: null },
    { id: "meetings", label: t("nav_meetings"),      icon: Video,           children: null },
    { id: "rooms",    label: t("nav_rooms"),         icon: DoorOpen,        children: null },
    { id: "meetcalendar", label: t("nav_meetcalendar"), icon: Calendar,     children: null },
    { id: "meetbook",     label: t("nav_meetbook"),     icon: BookOpen,     children: null },
    { id: "meetaction",   label: "MeetAction",          icon: Cpu,          children: null },
    { id: "integrations", label: t("nav_integrations"), icon: Puzzle,       children: null },
    {
      id: "settings", label: t("nav_settings"), icon: Settings, children: [
        { id: "settings-profile",       label: t("nav_profile"),       icon: User    },
        { id: "settings-notifications", label: t("nav_notifications"), icon: Bell    },
        { id: "settings-security",      label: t("nav_security"),      icon: Shield  },
        { id: "settings-account",       label: t("nav_account"),       icon: CreditCard },
      ],
    },
  ];
}

function getSectionTitles(t: (k: TranslationKey) => string): Record<string, string> {
  return {
    home:                     t("section_home"),
    meetings:                 t("section_meetings"),
    rooms:                    t("section_rooms"),
    "rooms-meetings":         t("section_rooms_meetings"),
    meetcalendar:             t("section_meetcalendar"),
    meety:                    t("section_meety"),
    meetbook:                 t("section_meetbook"),
    meetaction:               "MeetAction · Acciones IA",
    plans:                    t("section_plans"),
    integrations:             t("section_integrations"),
    "settings-profile":       t("section_settings_profile"),
    "settings-notifications": t("section_settings_notifications"),
    "settings-security":      t("section_settings_security"),
    "settings-account":       t("section_settings_account"),
  };
}

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
  const [broken, setBroken] = React.useState(false);
  const initials = name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  const sz = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  if (image && !broken) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt={name}
      onError={() => setBroken(true)}
      className={cn(sz, "rounded-full object-cover border border-slate-100 shrink-0")}
    />
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
  const { t } = useTranslation();
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
      {saved ? <><CheckCircle2 className="w-4 h-4" />{t("saved")}</> : loading ? t("saving") : <><Save className="w-4 h-4" />{t("save_changes")}</>}
    </button>
  );
}

// ── Meety chat button (lives in the sidebar) ─────────────────────────────────
function MeetyButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const { t } = useTranslation();
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
              <p className="text-base font-bold text-white leading-tight">{t("meety_chat")}</p>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            </div>
            <p className="text-xs text-white/65 leading-snug">
              {t("meety_subtitle")}
            </p>
          </div>

          {/* CTA chip */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 group-hover:bg-white/25 transition-colors duration-300 border border-white/10">
            <MessageCircle className="w-3.5 h-3.5 text-white/80" />
            <span className="text-[11px] font-semibold text-white/90">{t("meety_cta")}</span>
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
  const { t } = useTranslation();
  const navItems = getNavItems(t);
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
        {navItems.map(({ id, label, icon: Icon, children }) => {
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

function Header({ activeNav, user, onMenuClick, setActiveNav, isFreePlan }: {
  activeNav: string; user: User; onMenuClick: () => void; setActiveNav: (id: string) => void; isFreePlan: boolean;
}) {
  const { t, locale } = useTranslation();
  const [search, setSearch] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
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
        {getSectionTitles(t)[activeNav] ?? "Dashboard"}
      </h1>
      <div className="hidden md:flex flex-1 max-w-sm relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input type="text" placeholder={t("search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm placeholder:text-slate-400 outline-none focus:border-[#050040]/40 focus:ring-2 focus:ring-[#050040]/8 transition" />
      </div>
      {searchOpen && (
        <div className="md:hidden flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input autoFocus type="text" placeholder={t("search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)}
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
        {/* Upgrade CTA — always visible while the account is on the free plan */}
        {isFreePlan && activeNav !== "plans" && (
          <button
            onClick={() => setActiveNav("plans")}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white shrink-0 transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #050040 0%, #1a1a8c 100%)" }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t("upgrade")}
          </button>
        )}
        {/* Theme toggle */}
        <ThemeToggleBtn />
        <div className="relative shrink-0">
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="relative p-2 rounded-xl hover:bg-slate-50 transition-colors group shrink-0"
          >
            <Bell className="w-5 h-5 text-slate-500 group-hover:text-slate-800 transition-colors" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white px-1">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div
                className="absolute right-0 top-full mt-2 z-50 w-80 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden"
                style={{ animation: "notifPanel 0.16s cubic-bezier(0.16,1,0.3,1) both" }}
              >
                <style>{`@keyframes notifPanel{from{opacity:0;transform:scale(0.96) translateY(-6px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-800">
                    {t("nav_notifications")}
                  </p>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead}
                      className="text-xs font-medium text-[#050040] hover:underline">
                      {locale === "en" ? "Mark all read" : "Marcar leídas"}
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center">
                      <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">
                        {locale === "en" ? "No notifications yet" : "Sin notificaciones"}
                      </p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={cn(
                          "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-slate-50 border-b border-slate-50 last:border-0",
                          !n.read && "bg-[#050040]/5",
                        )}
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-1.5 shrink-0",
                          n.type === "room" ? "bg-emerald-500" : n.type === "event" ? "bg-violet-500" : n.type === "note" ? "bg-amber-500" : "bg-blue-500",
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm", n.read ? "text-slate-600" : "text-slate-800 font-medium")}>{n.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.description}</p>
                          <p className="text-[10px] text-slate-300 mt-1">
                            {n.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
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
  const { t, locale } = useTranslation();
  const [meetings, setMeetings] = React.useState<HomeMeeting[]>([]);
  const [loading,  setLoading]  = React.useState(true);

  React.useEffect(() => {
    fetch("/api/meetings/today")
      .then((r) => r.ok ? r.json() : { meetings: [] })
      .then((d) => setMeetings(d.meetings ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function relativeUntilLocal(iso: string): string {
    const diff = new Date(iso).getTime() - Date.now();
    const mins = Math.round(diff / 60000);
    if (mins <= 0) return t("home_relative_now");
    if (mins < 60) return `en ${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hrs < 24) return rem > 0 ? `en ${hrs} h ${rem} min` : `en ${hrs} h`;
    return locale === "en" ? "later today" : "más tarde hoy";
  }

  const homeGateways = [
    { id: "meetcalendar", label: t("nav_meetcalendar"), desc: t("home_cal_desc"),   icon: Calendar, color: "#050040" },
    { id: "rooms",        label: t("nav_rooms"),        desc: t("home_rooms_desc"), icon: DoorOpen, color: "#059669" },
    { id: "meetbook",     label: t("nav_meetbook"),     desc: t("home_book_desc"),  icon: BookOpen, color: "#7c3aed" },
    { id: "meetings",     label: t("nav_meetings"),     desc: t("home_meet_desc"),  icon: Video,    color: "#d97706" },
  ];

  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? t("greeting_morning") : hour < 19 ? t("greeting_afternoon") : t("greeting_evening");
  const firstName = user.name.split(" ")[0];
  const dateStr   = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  const now      = Date.now();
  const upcoming = meetings
    .filter((m) => !m.all_day && new Date(m.start_at).getTime() >= now - 5 * 60000)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const next     = upcoming[0] ?? null;

  const contextual = loading
    ? t("home_context_preparing")
    : next
      ? <>{t("home_next_in")} <span className="text-white font-semibold">{relativeUntilLocal(next.start_at)}</span>.</>
      : meetings.length > 0
        ? t("home_done_today")
        : t("home_no_meetings");

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
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t("home_next_meeting")}</h2>
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
                {relativeUntilLocal(next.start_at)}
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
              <span className="hidden sm:inline">{t("home_view")}</span><ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : !loading && (
        <div className="bg-white rounded-2xl border border-slate-100 px-7 py-6 flex items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/undraw_writing-online_x665.svg" alt="" className="hidden sm:block w-28 h-auto shrink-0" draggable={false} />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-800">{t("home_clear_day")}</h3>
            <p className="text-sm text-slate-400 mt-1">{t("home_clear_desc")}</p>
          </div>
          <button onClick={() => onNavigate("meetbook")}
            className="shrink-0 flex items-center gap-1.5 px-5 py-3 rounded-xl bg-[#050040]/8 text-[#050040] text-sm font-semibold hover:bg-[#050040]/12 transition-colors">
            {t("home_open_meetbook")}<ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Gateways ── */}
      <div>
        <h2 className="text-base font-bold text-slate-700 mb-4 px-1">{t("home_gateways")} {firstName}?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {homeGateways.map(({ id, label, desc, icon: Icon, color }) => (
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
        {t("home_footer")} · <span className="font-semibold text-slate-400">MeetBox</span>
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

// ── Desktop connection card ────────────────────────────────────────────────────
function DesktopTokenCard() {
  const { t } = useTranslation();
  const [token,        setToken]        = React.useState<string | null>(null);
  const [loading,      setLoading]      = React.useState(true);
  const [regenerating, setRegenerating] = React.useState(false);
  const [copied,       setCopied]       = React.useState(false);

  React.useEffect(() => {
    fetch("/api/auth/desktop/token")
      .then((r) => r.ok ? r.json() : { token: null })
      .then((d) => setToken(d.token ?? null))
      .finally(() => setLoading(false));
  }, []);

  async function regenerate() {
    setRegenerating(true);
    const res = await fetch("/api/auth/desktop/token", { method: "DELETE" });
    const d   = await res.json();
    setToken(d.token ?? null);
    setRegenerating(false);
  }

  async function copyCode() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white rounded-2xl border border-[#050040]/15 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-[#050040] flex items-center justify-center shrink-0">
          <Monitor className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">{t("desktop_integration")}</h3>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#050040]/8 text-[#050040]">
              {t("desktop_native_app")}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{t("desktop_desc")}</p>
        </div>
        <a
          href="https://meetbox.io/desktop"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          {t("desktop_download")}
        </a>
      </div>

      {/* Cuerpo */}
      <div className="px-6 py-5 space-y-5">
        {/* Instrucciones */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { n: "1", text: t("desktop_step1") },
            { n: "2", text: t("desktop_step2") },
            { n: "3", text: t("desktop_step3") },
          ].map(({ n, text }) => (
            <div key={n} className="flex items-start gap-3 bg-slate-50 rounded-xl px-4 py-3">
              <span className="w-6 h-6 rounded-full bg-[#050040]/10 text-[#050040] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {n}
              </span>
              <p className="text-xs text-slate-500 leading-snug">{text}</p>
            </div>
          ))}
        </div>

        {/* Token */}
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">{t("desktop_token_label")}</p>
          {loading ? (
            <div className="h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-slate-300 animate-spin" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Código */}
              <div className="flex-1 flex items-center gap-3 px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <Monitor className="w-4 h-4 text-slate-300 shrink-0" />
                <span className="font-mono text-lg font-bold tracking-widest text-[#050040] select-all flex-1">
                  {token ?? "—"}
                </span>
              </div>

              {/* Copiar */}
              <button
                onClick={copyCode}
                disabled={!token}
                title="Copiar código"
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3.5 rounded-xl text-xs font-semibold border transition-all shrink-0",
                  copied
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-[#050040] text-white border-[#050040] hover:bg-[#050040]/90 disabled:opacity-40",
                )}
              >
                {copied
                  ? <><Check className="w-4 h-4" />{t("desktop_copied")}</>
                  : <><Copy className="w-4 h-4" />{t("desktop_copy")}</>
                }
              </button>

              {/* Regenerar */}
              <button
                onClick={regenerate}
                disabled={regenerating}
                title="Generar nuevo código (invalida el anterior)"
                className="p-3.5 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 shrink-0"
              >
                <RefreshCw className={cn("w-4 h-4", regenerating && "animate-spin")} />
              </button>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-2">
            {t("desktop_regen_desc")}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Integrations view ─────────────────────────────────────────────────────────
// IDs that have real OAuth flows (not just profile toggles)
const OAUTH_INTEGRATIONS = new Set(["jira", "gcal"]);

function IntegrationsView({ profile, onUpdate }: { profile: Profile; onUpdate: (p: Partial<Profile>) => void }) {
  const { t } = useTranslation();
  const [connected, setConnected] = React.useState<string[]>(profile.integrations);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [customInput, setCustomInput] = React.useState("");
  const [customList, setCustomList] = React.useState<string[]>(
    profile.integrations.filter((id) => !INTEGRATION_LIST.find((x) => x.id === id)),
  );

  // ── OAuth status tracking ─────────────────────────────────────────────────
  const [jiraConnected,  setJiraConnected]  = React.useState(false);
  const [jiraSiteUrl,    setJiraSiteUrl]    = React.useState<string | null>(null);
  const [gcalConnected,  setGcalConnected]  = React.useState(false);
  const [toast, setToast] = React.useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  // Check OAuth statuses on mount + handle URL query params for toasts
  React.useEffect(() => {
    fetch("/api/auth/jira/status")
      .then((r) => r.ok ? r.json() : { connected: false })
      .then((d: { connected: boolean; site_url?: string }) => {
        setJiraConnected(d.connected);
        setJiraSiteUrl(d.site_url ?? null);
      })
      .catch(() => {});

    // Handle query params from OAuth callbacks
    const params = new URLSearchParams(window.location.search);
    const jiraStatus = params.get("jira");
    const gcalStatus = params.get("gcal");
    if (jiraStatus === "connected") {
      setToast({ msg: "¡Jira conectado exitosamente!", type: "success" });
      setJiraConnected(true);
    } else if (jiraStatus === "denied") {
      setToast({ msg: "Autorización de Jira denegada", type: "error" });
    } else if (jiraStatus === "error") {
      setToast({ msg: "Error al conectar Jira", type: "error" });
    }
    if (gcalStatus === "connected") {
      setToast({ msg: "¡Google Calendar conectado!", type: "success" });
      setGcalConnected(true);
    }
    // Clean URL params
    if (jiraStatus || gcalStatus) {
      const url = new URL(window.location.href);
      url.searchParams.delete("jira");
      url.searchParams.delete("gcal");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Auto-dismiss toast
  React.useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  function isOAuthConnected(id: string): boolean {
    if (id === "jira") return jiraConnected;
    if (id === "gcal") return gcalConnected;
    return connected.includes(id);
  }

  async function handleConnect(id: string) {
    if (id === "jira")  { window.location.href = "/api/auth/jira"; return; }
    if (id === "gcal")  { window.location.href = "/api/auth/google-calendar"; return; }
    await toggle(id);
  }

  async function handleDisconnect(id: string) {
    if (id === "jira") {
      setSaving(id);
      await fetch("/api/auth/jira/status", { method: "DELETE" });
      setJiraConnected(false); setJiraSiteUrl(null);
      setSaving(null);
      setToast({ msg: "Jira desconectado", type: "info" });
      return;
    }
    await toggle(id);
  }

  async function toggle(id: string) {
    // Slack uses a REAL OAuth flow: connecting redirects to Slack's authorize
    // screen; disconnecting revokes the token server-side. The callback updates
    // user_profiles.integrations, so on return the card shows as connected.
    if (id === "slack") {
      if (!connected.includes("slack")) {
        window.location.href = "/api/integrations/slack/connect";
        return;
      }
      setSaving(id);
      await fetch("/api/integrations/slack", { method: "DELETE" });
      const next = connected.filter((x) => x !== "slack");
      setConnected(next);
      onUpdate({ integrations: next });
      setSaving(null);
      return;
    }

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

  const connectedCount = INTEGRATION_LIST.filter((i) => isOAuthConnected(i.id)).length + customList.length;

  return (
    <div className="space-y-8">

      {/* ── Toast notification ── */}
      {toast && (
        <div
          className={cn(
            "fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-sm font-semibold",
            toast.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
            toast.type === "error"   ? "bg-red-50 text-red-600 border-red-200" :
                                       "bg-slate-50 text-slate-600 border-slate-200",
          )}
          style={{ animation: "slideIn 0.3s ease-out" }}
        >
          {toast.type === "success" && <CheckCircle2 className="w-4 h-4" />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-2 opacity-50 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`}</style>

      {/* ── Page header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#050040]">{t("integrations_title")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("integrations_desc")}</p>
        </div>
        {connectedCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-semibold bg-[#050040]/8 text-[#050040] px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {connectedCount} {t("connected").toLowerCase()}
          </span>
        )}
      </div>

      {/* ── MeetBox Desktop (featured) ── */}
      <DesktopTokenCard />

      {/* ── Integration grid ── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          {t("integrations_title")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {INTEGRATION_LIST.map(({ id, label, color, Icon, desc }) => {
            const isConn    = isOAuthConnected(id);
            const isLoading = saving === id;
            const isOAuth   = OAUTH_INTEGRATIONS.has(id);
            return (
              <div key={id} className={cn(
                "group bg-white rounded-2xl border p-5 flex flex-col gap-4 transition-all hover:shadow-md",
                isConn ? "border-[#050040]/20 shadow-sm" : "border-slate-100",
              )}>
                {/* Card header */}
                <div className="flex items-start justify-between">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{ backgroundColor: color + "15", border: `1px solid ${color}25` }}
                  >
                    <Icon style={{ color }} className="w-6 h-6" />
                  </div>
                  {isConn && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-full shrink-0">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      {t("connected")}
                    </span>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{label}</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{desc}</p>
                  {/* Show Jira site URL when connected */}
                  {id === "jira" && isConn && jiraSiteUrl && (
                    <p className="text-[10px] text-[#0052CC] mt-1.5 font-medium truncate flex items-center gap-1">
                      <Globe className="w-3 h-3 shrink-0" />
                      {jiraSiteUrl.replace(/^https?:\/\//, "")}
                    </p>
                  )}
                </div>
                {/* Action */}
                <button
                  onClick={() => isConn ? handleDisconnect(id) : handleConnect(id)}
                  disabled={isLoading}
                  className={cn(
                    "w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50",
                    isConn
                      ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
                      : "bg-[#050040] text-white hover:bg-[#050040]/90",
                  )}
                >
                  {isLoading ? "…" : isConn
                    ? <><Zap className="w-3.5 h-3.5" />{t("disconnect")}</>
                    : <><Link2 className="w-3.5 h-3.5" />{isOAuth ? `${t("connect")} ${label}` : t("connect")}</>
                  }
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Custom integrations ── */}
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Plug2 className="w-4 h-4 text-slate-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{t("other_tools")}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{t("other_tools_desc")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            placeholder={t("tool_placeholder")}
            className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm placeholder:text-slate-400 outline-none focus:border-[#050040]/40 transition"
          />
          <button onClick={addCustom} className="flex items-center gap-1.5 px-4 py-2 bg-[#050040] text-white rounded-xl text-sm font-semibold hover:bg-[#050040]/90 transition">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {customList.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
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
  const { t } = useTranslation();
  const [orgName,      setOrgName]      = React.useState(profile.orgName ?? "");
  const [teamSize,     setTeamSize]     = React.useState(profile.teamSize ?? "");
  const [meetingTypes, setMeetingTypes] = React.useState<string[]>(profile.meetingTypes);
  const [loading, setLoading] = React.useState(false);
  const [saved,   setSaved]   = React.useState(false);
  const [error,   setError]   = React.useState("");

  const teamSizes = [
    { id: "solo",  label: t("team_solo") },
    { id: "2-10",  label: t("team_2_10") },
    { id: "11-50", label: t("team_11_50") },
    { id: "50+",   label: t("team_50p") },
  ];
  const meetingTypeOpts = [
    { id: "presencial", label: t("meeting_presencial") },
    { id: "virtual",    label: t("meeting_virtual") },
    { id: "hibrida",    label: t("meeting_hibrida") },
  ];

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
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Page header with avatar ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#050040] via-[#0c0c63] to-[#1a1a8c] rounded-2xl px-6 py-8 flex items-center gap-6">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 right-1/4 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-5">
          <Avatar name={user.name} image={user.image} size="md" />
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">{user.name}</h2>
            <p className="text-sm text-white/60 mt-0.5">{user.email}</p>
          </div>
        </div>
        <div className="relative ml-auto hidden sm:block">
          <div className="text-right">
            <p className="text-xs text-white/40 uppercase tracking-wide">{t("settings_profile_title")}</p>
            <p className="text-xs text-white/60 mt-0.5">{t("settings_profile_desc")}</p>
          </div>
        </div>
      </div>

      {/* ── 2-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left — Personal info */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-[#050040]/8 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-[#050040]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{t("personal_info")}</p>
              <p className="text-xs text-slate-400">{t("personal_info_desc")}</p>
            </div>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t("full_name")}</label>
              <input
                type="text" value={user.name} readOnly
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500 cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <Globe className="w-3 h-3 shrink-0" />{t("name_managed_by_provider")}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t("email")}</label>
              <input
                type="email" value={user.email} readOnly
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Right — Organisation */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-[#050040]/8 flex items-center justify-center shrink-0">
              <Building2 className="w-3.5 h-3.5 text-[#050040]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{t("organization")}</p>
              <p className="text-xs text-slate-400">{t("organization_desc")}</p>
            </div>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t("org_name")}</label>
              <input
                type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
                placeholder={t("org_name_placeholder")}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#050040]/50 focus:ring-2 focus:ring-[#050040]/8 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />{t("team_size")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {teamSizes.map(({ id, label }) => (
                  <button key={id} type="button" onClick={() => setTeamSize(id)}
                    className={cn(
                      "py-2 rounded-xl text-xs font-semibold border transition-all text-center",
                      teamSize === id ? "bg-[#050040] text-white border-[#050040]" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-[#050040]/30",
                    )}
                  >{label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Meeting types — full width ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-[#050040]/8 flex items-center justify-center shrink-0">
            <Video className="w-3.5 h-3.5 text-[#050040]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{t("meeting_types")}</p>
            <p className="text-xs text-slate-400">{t("meeting_types_desc")}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {meetingTypeOpts.map(({ id, label }) => {
            const active = meetingTypes.includes(id);
            const icons: Record<string, string> = { presencial: "🏢", virtual: "💻", hibrida: "🔀" };
            return (
              <button key={id} type="button" onClick={() => toggleMeeting(id)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border text-left transition-all",
                  active ? "bg-[#050040] text-white border-[#050040] shadow-sm" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-[#050040]/30",
                )}
              >
                <span className="text-lg leading-none">{icons[id]}</span>
                <span className="text-sm font-semibold">{label}</span>
                {active && <Check className="w-4 h-4 ml-auto shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

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

  const { t } = useTranslation();
  const rows: { key: keyof typeof prefs; label: string; desc: string; icon: React.ElementType; color: string }[] = [
    { key: "meetings",     label: t("notif_meetings_label"),     desc: t("notif_meetings_desc"),     icon: Calendar,  color: "#050040" },
    { key: "weekly",       label: t("notif_weekly_label"),       desc: t("notif_weekly_desc"),       icon: Mail,      color: "#7c3aed" },
    { key: "browser",      label: t("notif_browser_label"),      desc: t("notif_browser_desc"),      icon: Globe,     color: "#0891b2" },
    { key: "integrations", label: t("notif_integrations_label"), desc: t("notif_integrations_desc"), icon: Plug2,     color: "#d97706" },
    { key: "transcripts",  label: t("notif_transcripts_label"),  desc: t("notif_transcripts_desc"),  icon: FileText,  color: "#059669" },
  ];

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#050040]">{t("settings_notif_title")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("settings_notif_desc")}</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />{t("saved")}
          </span>
        )}
      </div>

      {/* ── Cards grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map(({ key, label, desc, icon: Icon, color }) => (
          <div
            key={key}
            onClick={() => update(key, !prefs[key])}
            className={cn(
              "group cursor-pointer bg-white rounded-2xl border p-5 flex flex-col gap-4 transition-all hover:shadow-md select-none",
              prefs[key] ? "border-slate-200 shadow-sm" : "border-slate-100",
            )}
          >
            {/* Icon + Toggle */}
            <div className="flex items-start justify-between">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                style={{ backgroundColor: color + "15" }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <div
                className={cn(
                  "relative w-10 h-5 rounded-full transition-colors shrink-0 mt-0.5",
                  prefs[key] ? "bg-[#050040]" : "bg-slate-200",
                )}
                style={{ width: 40, height: 22 }}
                onClick={(e) => { e.stopPropagation(); update(key, !prefs[key]); }}
              >
                <span className={cn(
                  "absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform duration-200",
                  prefs[key] ? "translate-x-[20px]" : "translate-x-0.5",
                )} />
              </div>
            </div>
            {/* Text */}
            <div>
              <p className="text-sm font-semibold text-slate-800 leading-tight">{label}</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{desc}</p>
            </div>
            {/* Status pill */}
            <div className={cn(
              "self-start text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors",
              prefs[key] ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400",
            )}>
              {prefs[key] ? "Activo" : "Inactivo"}
            </div>
          </div>
        ))}
      </div>
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

  const { t } = useTranslation();

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold text-[#050040]">{t("settings_security_title")}</h2>
        <p className="text-sm text-slate-500 mt-1">{t("settings_security_desc")}</p>
      </div>

      {/* ── 2-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Left — Change password */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-[#050040]/8 flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5 text-[#050040]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{t("change_password")}</p>
              <p className="text-xs text-slate-400">{t("change_password_desc")}</p>
            </div>
          </div>
          <form onSubmit={handleChange} className="space-y-3">
            {([
              { label: t("current_password"), val: current, set: setCurrent, show: showCurrent, toggle: () => setShowCurrent((p) => !p) },
              { label: t("new_password"),      val: newPwd,  set: setNewPwd,  show: showNew,    toggle: () => setShowNew((p) => !p) },
              { label: t("confirm_password"),  val: confirm, set: setConfirm, show: showNew,    toggle: () => setShowNew((p) => !p) },
            ] as const).map(({ label, val, set, show, toggle }) => (
              <div key={String(label)}>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    value={val}
                    onChange={(e) => (set as React.Dispatch<React.SetStateAction<string>>)(e.target.value)}
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
                msg.type === "ok" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-600 border-red-100",
              )}>{msg.text}</p>
            )}
            <div className="flex justify-end pt-1">
              <SaveBtn loading={loading} saved={msg?.type === "ok"} />
            </div>
          </form>
        </div>

        {/* Right — Login methods + Sessions */}
        <div className="space-y-4">

          {/* Sign-in methods */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#050040]/8 flex items-center justify-center shrink-0">
                <Link2 className="w-3.5 h-3.5 text-[#050040]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{t("login_methods")}</p>
                <p className="text-xs text-slate-400">{t("login_methods_desc")}</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: t("google_signin"), desc: t("google_desc"), icon: "G", color: "#EA4335" },
                { label: t("email_signin"),  desc: t("email_desc"),  icon: "@", color: "#050040" },
              ].map(({ label, desc, icon, color }) => (
                <div key={String(label)} className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm" style={{ backgroundColor: color }}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />{t("active_label")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Active sessions */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                <LogOut className="w-3.5 h-3.5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{t("active_sessions")}</p>
                <p className="text-xs text-slate-400">{t("active_sessions_desc")}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/auth" })}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <LogOut className="w-4 h-4" />{t("logout_all")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Settings: Cuenta ──────────────────────────────────────────────────────────
function SettingsAccount({ user, onNavigate }: { user: User; onNavigate: (id: string) => void }) {
  const { t, locale, setLocale } = useTranslation();
  const [confirmDelete, setConfirmDelete] = React.useState("");
  const [showDialog,    setShowDialog]    = React.useState(false);
  const [langSaved,     setLangSaved]     = React.useState(false);

  const [currentPlan, setCurrentPlan] = React.useState<{ id: string; name: string } | null>(null);

  React.useEffect(() => {
    try {
      const data = localStorage.getItem('meetbox_plan');
      if (data) setCurrentPlan(JSON.parse(data));
    } catch {}
  }, []);

  function handleLocale(l: Locale) {
    setLocale(l);
    setLangSaved(true);
    setTimeout(() => setLangSaved(false), 2000);
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold text-[#050040]">{t("settings_account_title")}</h2>
        <p className="text-sm text-slate-500 mt-1">{t("settings_account_desc")}</p>
      </div>

      {/* ── Row 1: Plan + Language ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Plan — 2/3 width */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#050040] flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{t("current_plan")}</p>
                <p className="text-xs text-slate-400">{t("current_plan_desc")}</p>
              </div>
            </div>
            <button onClick={() => onNavigate("plans")}
              className="px-4 py-2 bg-[#050040] text-white rounded-xl text-xs font-semibold hover:bg-[#050040]/90 transition shadow-sm">
              {t("upgrade")}
            </button>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#050040]/5 border border-[#050040]/10 mb-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#050040]">{currentPlan ? currentPlan.name : "Plan Free"}</p>
              <p className="text-xs text-slate-500 mt-0.5">{currentPlan ? "" : t("plan_free_desc")}</p>
            </div>
            <span className="text-[10px] font-bold bg-[#050040] text-white px-2.5 py-1 rounded-full uppercase tracking-wide">{currentPlan ? currentPlan.name : "Free"}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t("plan_meetings"),     value: "3 / 5",   pct: 60  },
              { label: t("plan_integrations"), value: "1 / 1",   pct: 100 },
              { label: t("plan_storage"),      value: "120 MB",  pct: 24  },
            ].map(({ label, value, pct }) => (
              <div key={label} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                <p className="text-base font-bold text-slate-800 mt-1 mb-2">{value}</p>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-red-400" : "bg-[#050040]")} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Language — 1/3 width */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#050040]/8 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-[#050040]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{t("language")}</p>
              <p className="text-xs text-slate-400">{t("language_desc")}</p>
            </div>
          </div>
          <div className="space-y-2">
            {(["es", "en"] as Locale[]).map((l) => (
              <button key={l} onClick={() => handleLocale(l)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-all",
                  locale === l ? "bg-[#050040] text-white border-[#050040] shadow-sm" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-[#050040]/30",
                )}
              >
                <span className="text-lg leading-none">{l === "es" ? "🇪🇸" : "🇺🇸"}</span>
                <span className="flex-1 text-left">{t(l === "es" ? "language_es" : "language_en")}</span>
                {locale === l && <Check className="w-4 h-4 shrink-0" />}
              </button>
            ))}
          </div>
          {langSaved && (
            <span className="flex items-center gap-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-xl justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />{t("language_saved")}
            </span>
          )}
        </div>
      </div>

      {/* ── Row 2: Data + Danger zone ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Export data */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{t("your_data")}</p>
              <p className="text-xs text-slate-400">{t("your_data_desc")}</p>
            </div>
          </div>
          <button className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-[#050040]/30 hover:text-[#050040] transition-all">
            <FileText className="w-4 h-4" />{t("export_data")}
          </button>
          <p className="text-xs text-slate-400 mt-2 text-center">{t("export_desc")}</p>
        </div>

        {/* Danger zone */}
        <div className="bg-white rounded-2xl border border-red-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-700">{t("danger_zone")}</p>
              <p className="text-xs text-slate-400">{t("danger_zone_desc")}</p>
            </div>
          </div>
          <button
            onClick={() => setShowDialog(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-100 transition-all"
          >
            <Trash2 className="w-4 h-4" />{t("delete_account")}
          </button>
        </div>
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
                <h3 className="text-sm font-semibold text-slate-800">
                  {locale === "en" ? "Delete account?" : "¿Eliminar cuenta?"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {locale === "en" ? "This action cannot be undone" : "Esta acción no se puede deshacer"}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {locale === "en" ? "Type" : "Escribe"}{" "}
              <span className="font-semibold text-slate-700">{user.email}</span>{" "}
              {locale === "en" ? "to confirm." : "para confirmar."}
            </p>
            <input
              type="text" value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder={user.email}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:border-red-300 transition mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowDialog(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                {t("cancel")}
              </button>
              <button disabled={confirmDelete !== user.email}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-red-600 transition">
                {t("delete")}
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

  // No paid-subscription field exists in the DB yet, so every account is treated
  // as free. When billing lands, derive this from the user's subscription row.
  const isFreePlan = true;

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
      case "meetaction":              return <MeetActionView />;
      case "plans":                   return <PlansView onBack={() => setActiveNav("settings-account")} />;
      case "integrations":            return <IntegrationsView profile={profile} onUpdate={handleProfileUpdate} />;
      case "settings-profile":        return <SettingsProfile user={user} profile={profile} onUpdate={handleProfileUpdate} />;
      case "settings-notifications":  return <SettingsNotifications />;
      case "settings-security":       return <SettingsSecurity />;
      case "settings-account":        return <SettingsAccount user={user} onNavigate={setActiveNav} />;
      case "meetings":                return <MeetingsView />;
      case "rooms":                   return <RoomsView />;
      case "rooms-meetings":          return <RoomsView />;
      case "meety":                   return <MeetyView userName={user.name.split(" ")[0]} userImage={user.image} />;
      default:                        return <HomeView user={user} onNavigate={setActiveNav} />;
    }
  }

  return (
    <NotificationProvider>
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
        <Header activeNav={activeNav} user={user} onMenuClick={() => setSidebarOpen(true)} setActiveNav={setActiveNav} isFreePlan={isFreePlan} />
        <main className={cn(
          "flex-1 min-h-0",
          (activeNav === "meetbook" || activeNav === "meetcalendar" || activeNav === "meety" || activeNav === "meetaction")
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
    </NotificationProvider>
  );
}
