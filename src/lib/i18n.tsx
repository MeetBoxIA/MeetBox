"use client";
// Lightweight i18n system — no external dependency, supports ES and EN.
// Language is persisted in localStorage and applied via React context.
// Components consume useTranslation() to get the t() helper.

import React, { createContext, useContext, useEffect, useState } from "react";

export type Locale = "es" | "en";

// ── Translation strings ────────────────────────────────────────────────────────
const translations = {
  es: {
    // Nav
    nav_home:          "Inicio",
    nav_meetings:      "Reuniones",
    nav_rooms:         "Salas",
    nav_meetcalendar:  "MeetCalendar",
    nav_meetbook:      "MeetBook",
    nav_integrations:  "Integraciones",
    nav_settings:      "Configuración",
    nav_profile:       "Perfil",
    nav_notifications: "Notificaciones",
    nav_security:      "Seguridad",
    nav_account:       "Cuenta",
    meety_chat:        "Chatea con Meety",
    meety_subtitle:    "Tu asistente IA — siempre listo",
    meety_cta:         "Iniciar conversación",
    // Header
    search_placeholder: "Buscar reuniones...",
    // Home
    greeting_morning:  "Buenos días",
    greeting_afternoon:"Buenas tardes",
    greeting_evening:  "Buenas noches",
    home_next_meeting: "Lo que sigue",
    home_clear_day:    "Tu día está despejado",
    home_clear_desc:   "Captura ideas en MeetBook o planifica algo en tu calendario.",
    home_open_meetbook:"Abrir MeetBook",
    home_gateways:     "¿Por dónde empezamos,",
    home_footer:       "Hecho para que tus reuniones fluyan",
    home_context_preparing: "Preparando tu día…",
    home_next_in:      "Tu próxima reunión es",
    home_done_today:   "Ya pasaron tus reuniones de hoy. Buen trabajo. 👏",
    home_no_meetings:  "No tienes reuniones hoy. Un buen momento para ordenar tus ideas.",
    // Sections titles
    section_home:          "Inicio",
    section_meetings:      "Reuniones",
    section_rooms:         "Salas",
    section_rooms_meetings:"Salas · Reuniones",
    section_meetcalendar:  "MeetCalendar",
    section_meety:         "Meety · Asistente IA",
    section_meetbook:      "MeetBook",
    section_integrations:  "Integraciones",
    section_settings_profile:      "Configuración · Perfil",
    section_settings_notifications:"Configuración · Notificaciones",
    section_settings_security:     "Configuración · Seguridad",
    section_settings_account:      "Configuración · Cuenta",
    // Settings — Profile
    settings_profile_title:  "Perfil",
    settings_profile_desc:   "Gestiona tu información personal y la de tu organización",
    personal_info:            "Información personal",
    personal_info_desc:       "Datos de tu cuenta de MeetBox",
    full_name:                "Nombre completo",
    email:                    "Correo electrónico",
    name_managed_by_provider: "El nombre se gestiona desde tu proveedor de inicio de sesión",
    organization:             "Organización",
    organization_desc:        "Configura el espacio de trabajo de tu equipo",
    org_name:                 "Nombre de la organización",
    org_name_placeholder:     "Ej. Acme Corp",
    team_size:                "Tamaño del equipo",
    meeting_types:            "Tipos de reunión",
    meeting_types_desc:       "¿Qué modalidades de reunión usa tu equipo?",
    save_changes:             "Guardar cambios",
    saved:                    "Guardado",
    saving:                   "Guardando…",
    // Settings — Notifications
    settings_notif_title: "Notificaciones",
    settings_notif_desc:  "Controla cómo y cuándo MeetBox te avisa",
    notif_preferences:    "Preferencias de notificación",
    // Settings — Security
    settings_security_title: "Seguridad",
    settings_security_desc:  "Administra la seguridad de tu cuenta",
    change_password:          "Cambiar contraseña",
    change_password_desc:     "Actualiza tu contraseña de acceso",
    current_password:         "Contraseña actual",
    new_password:             "Nueva contraseña",
    confirm_password:         "Confirmar contraseña",
    login_methods:            "Métodos de inicio de sesión",
    login_methods_desc:       "Cuentas vinculadas a tu perfil",
    active_sessions:          "Sesiones activas",
    active_sessions_desc:     "Cierra sesión en todos los dispositivos",
    logout_all:               "Cerrar sesión en todos los dispositivos",
    // Settings — Account
    settings_account_title: "Cuenta",
    settings_account_desc:  "Gestiona tu plan y datos de cuenta",
    current_plan:           "Plan actual",
    current_plan_desc:      "Tu suscripción activa en MeetBox",
    upgrade:                "Mejorar plan",
    your_data:              "Tus datos",
    your_data_desc:         "Descarga o exporta tu información",
    export_data:            "Exportar todos mis datos",
    export_desc:            "Se generará un archivo ZIP con tus reuniones, transcripciones y configuración",
    danger_zone:            "Zona de peligro",
    danger_zone_desc:       "Estas acciones son irreversibles",
    delete_account:         "Eliminar mi cuenta",
    // Settings — Language
    language:               "Idioma",
    language_desc:          "Selecciona el idioma de la interfaz",
    language_es:            "Español",
    language_en:            "English",
    language_saved:         "Idioma guardado",
    // Integrations
    integrations_title: "Integraciones",
    integrations_desc:  "Conecta tus herramientas con MeetBox",
    connected:          "Conectado",
    connect:            "Conectar",
    disconnect:         "Desconectar",
    other_tools:        "Otras herramientas",
    other_tools_desc:   "Añade integraciones personalizadas que usa tu equipo",
    tool_placeholder:   "Nombre de la herramienta…",
    // Meety
    meety_new_chat:     "Nueva conversación",
    meety_no_convs:     "Aún no hay conversaciones",
    meety_delete:       "Eliminar conversación",
    meety_welcome_title:"¿En qué te ayudo hoy?",
    meety_welcome_sub:  "Soy Meety, tu asistente IA. ¿En qué te ayudo hoy?",
    meety_thinking:     "Pensando",
    meety_analyzing:    "Analizando",
    meety_processing:   "Procesando",
    // Calendar
    cal_today:      "Hoy",
    cal_new_event:  "Nueva reunión",
    cal_upcoming:   "Próximas reuniones",
    cal_no_events:  "Sin reuniones próximas",
    // Auth
    sign_out:       "Cerrar sesión",
    // Common
    cancel:         "Cancelar",
    delete:         "Eliminar",
    error_required: "Este campo es requerido",
    error_generic:  "Ha ocurrido un error",
    open:           "Abrir",
    close:          "Cerrar",
    back:           "Volver",
    coming_soon:    "Esta sección estará disponible muy pronto",
  },

  en: {
    // Nav
    nav_home:          "Home",
    nav_meetings:      "Meetings",
    nav_rooms:         "Rooms",
    nav_meetcalendar:  "MeetCalendar",
    nav_meetbook:      "MeetBook",
    nav_integrations:  "Integrations",
    nav_settings:      "Settings",
    nav_profile:       "Profile",
    nav_notifications: "Notifications",
    nav_security:      "Security",
    nav_account:       "Account",
    meety_chat:        "Chat with Meety",
    meety_subtitle:    "Your AI assistant — always ready",
    meety_cta:         "Start conversation",
    // Header
    search_placeholder: "Search meetings...",
    // Home
    greeting_morning:  "Good morning",
    greeting_afternoon:"Good afternoon",
    greeting_evening:  "Good evening",
    home_next_meeting: "Up next",
    home_clear_day:    "Your day is clear",
    home_clear_desc:   "Capture ideas in MeetBook or plan something on your calendar.",
    home_open_meetbook:"Open MeetBook",
    home_gateways:     "Where should we start,",
    home_footer:       "Built to make your meetings flow",
    home_context_preparing: "Preparing your day…",
    home_next_in:      "Your next meeting is",
    home_done_today:   "All your meetings for today are done. Great work. 👏",
    home_no_meetings:  "No meetings today. A good time to organize your thoughts.",
    // Section titles
    section_home:          "Home",
    section_meetings:      "Meetings",
    section_rooms:         "Rooms",
    section_rooms_meetings:"Rooms · Meetings",
    section_meetcalendar:  "MeetCalendar",
    section_meety:         "Meety · AI Assistant",
    section_meetbook:      "MeetBook",
    section_integrations:  "Integrations",
    section_settings_profile:      "Settings · Profile",
    section_settings_notifications:"Settings · Notifications",
    section_settings_security:     "Settings · Security",
    section_settings_account:      "Settings · Account",
    // Settings — Profile
    settings_profile_title:  "Profile",
    settings_profile_desc:   "Manage your personal and organization information",
    personal_info:            "Personal information",
    personal_info_desc:       "Your MeetBox account details",
    full_name:                "Full name",
    email:                    "Email address",
    name_managed_by_provider: "Name is managed by your sign-in provider",
    organization:             "Organization",
    organization_desc:        "Configure your team workspace",
    org_name:                 "Organization name",
    org_name_placeholder:     "e.g. Acme Corp",
    team_size:                "Team size",
    meeting_types:            "Meeting types",
    meeting_types_desc:       "What meeting formats does your team use?",
    save_changes:             "Save changes",
    saved:                    "Saved",
    saving:                   "Saving…",
    // Settings — Notifications
    settings_notif_title: "Notifications",
    settings_notif_desc:  "Control how and when MeetBox notifies you",
    notif_preferences:    "Notification preferences",
    // Settings — Security
    settings_security_title: "Security",
    settings_security_desc:  "Manage your account security",
    change_password:          "Change password",
    change_password_desc:     "Update your access password",
    current_password:         "Current password",
    new_password:             "New password",
    confirm_password:         "Confirm password",
    login_methods:            "Sign-in methods",
    login_methods_desc:       "Accounts linked to your profile",
    active_sessions:          "Active sessions",
    active_sessions_desc:     "Sign out on all devices",
    logout_all:               "Sign out on all devices",
    // Settings — Account
    settings_account_title: "Account",
    settings_account_desc:  "Manage your plan and account data",
    current_plan:           "Current plan",
    current_plan_desc:      "Your active MeetBox subscription",
    upgrade:                "Upgrade plan",
    your_data:              "Your data",
    your_data_desc:         "Download or export your information",
    export_data:            "Export all my data",
    export_desc:            "A ZIP file with your meetings, transcripts and settings will be generated",
    danger_zone:            "Danger zone",
    danger_zone_desc:       "These actions are irreversible",
    delete_account:         "Delete my account",
    // Settings — Language
    language:               "Language",
    language_desc:          "Select your interface language",
    language_es:            "Español",
    language_en:            "English",
    language_saved:         "Language saved",
    // Integrations
    integrations_title: "Integrations",
    integrations_desc:  "Connect your tools with MeetBox",
    connected:          "Connected",
    connect:            "Connect",
    disconnect:         "Disconnect",
    other_tools:        "Other tools",
    other_tools_desc:   "Add custom integrations your team uses",
    tool_placeholder:   "Tool name…",
    // Meety
    meety_new_chat:     "New conversation",
    meety_no_convs:     "No conversations yet",
    meety_delete:       "Delete conversation",
    meety_welcome_title:"How can I help you today?",
    meety_welcome_sub:  "I'm Meety, your AI assistant. How can I help you today?",
    meety_thinking:     "Thinking",
    meety_analyzing:    "Analyzing",
    meety_processing:   "Processing",
    // Calendar
    cal_today:      "Today",
    cal_new_event:  "New meeting",
    cal_upcoming:   "Upcoming meetings",
    cal_no_events:  "No upcoming meetings",
    // Auth
    sign_out:       "Sign out",
    // Common
    cancel:         "Cancel",
    delete:         "Delete",
    error_required: "This field is required",
    error_generic:  "An error occurred",
    open:           "Open",
    close:          "Close",
    back:           "Back",
    coming_soon:    "This section will be available soon",
  },
} as const;

export type TranslationKey = keyof typeof translations.es;

// ── Context ────────────────────────────────────────────────────────────────────
interface I18nContextValue {
  locale:    Locale;
  setLocale: (l: Locale) => void;
  t:         (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale:    "es",
  setLocale: () => {},
  t:         (key) => key,
});

const STORAGE_KEY = "meetbox_locale";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("es");

  // Restore persisted language on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored === "es" || stored === "en") setLocaleState(stored);
    } catch { /* localStorage unavailable in SSR */ }
  }, []);

  function setLocale(l: Locale) {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  }

  function t(key: TranslationKey): string {
    return (translations[locale] as Record<string, string>)[key] ?? (translations.es as Record<string, string>)[key] ?? key;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
