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
    // Home gateway cards
    home_cal_desc:   "Tu calendario y eventos",
    home_rooms_desc: "Tus espacios y equipos",
    home_book_desc:  "Notas, ideas y documentos",
    home_meet_desc:  "Hoy, grabaciones e historial",
    home_relative_now: "ahora mismo",
    home_view:       "Ver",
    // Notifications toggles
    notif_meetings_label:     "Recordatorios de reuniones",
    notif_meetings_desc:      "15 minutos antes de cada reunión programada",
    notif_weekly_label:       "Resumen semanal por email",
    notif_weekly_desc:        "Todos los lunes con el resumen de la semana",
    notif_browser_label:      "Notificaciones del navegador",
    notif_browser_desc:       "Alertas en tiempo real dentro del navegador",
    notif_integrations_label: "Alertas de integración",
    notif_integrations_desc:  "Cuando hay errores de sincronización",
    notif_transcripts_label:  "Nuevas transcripciones",
    notif_transcripts_desc:   "Cuando se termina de procesar una grabación",
    // Security
    password_min_length: "La nueva contraseña debe tener al menos 8 caracteres",
    password_mismatch:   "Las contraseñas no coinciden",
    password_updated:    "Contraseña actualizada correctamente",
    google_signin:       "Google",
    email_signin:        "Correo electrónico",
    google_desc:         "Inicio de sesión con Google OAuth",
    email_desc:          "Inicio de sesión con email y OTP",
    active_label:        "Activo",
    // Team sizes
    team_solo:  "Solo yo",
    team_2_10:  "2–10 personas",
    team_11_50: "11–50 personas",
    team_50p:   "50+ personas",
    // Meeting type options
    meeting_presencial: "Presenciales",
    meeting_virtual:    "Virtuales",
    meeting_hibrida:    "Híbridas",
    // Integrations
    integrations_connected_count_one:  "conectada",
    integrations_connected_count_many: "conectadas",
    desktop_integration: "MeetBox Desktop",
    desktop_native_app:  "App nativa",
    desktop_desc:        "Graba el audio de tus videollamadas sin bots · Funciona con Zoom, Meet y Teams",
    desktop_download:    "Descargar",
    desktop_step1:       "Descarga e instala MeetBox Desktop en tu equipo",
    desktop_step2:       'Abre la app y pulsa "Conectar cuenta"',
    desktop_step3:       "Copia el código de abajo y pégalo en la app",
    desktop_token_label: "Tu código de conexión",
    desktop_copy:        "Copiar",
    desktop_copied:      "Copiado",
    desktop_regen_desc:  "El código es único para tu cuenta. Regenerarlo desconectará cualquier dispositivo vinculado anteriormente.",
    other_tools_add:     "Añadir",
    // Meety welcome samples
    meety_sample1_text:  "¿Qué tengo hoy?",
    meety_sample1_hint:  "Reuniones del día",
    meety_sample2_text:  "Crea una reunión para mañana 10am",
    meety_sample2_hint:  "Crear evento",
    meety_sample3_text:  "Resúmeme las notas de la semana",
    meety_sample3_hint:  "MeetBook",
    meety_sample4_text:  "Busca una grabación reciente",
    meety_sample4_hint:  "Reuniones",
    meety_welcome_hello: "¡Hola,",
    meety_thinking_deep1: "Pensando profundamente",
    meety_thinking_deep2: "Razonando",
    meety_thinking_deep3: "Conectando ideas",
    meety_search1:        "Buscando",
    meety_search2:        "Analizando fuentes",
    meety_search3:        "Sintetizando",
    meety_mode_think:     "Pensar",
    meety_mode_deep:      "Búsqueda profunda",
    meety_no_active:      "Meety",
    // Settings Notifications section title
    notif_pref_title: "Preferencias de notificación",
    // Plan section
    plan_free_desc:    "Hasta 5 reuniones/mes · 1 integración · Transcripción básica",
    plan_meetings:     "Reuniones",
    plan_integrations: "Integraciones",
    plan_storage:      "Almacenamiento",
    // Common
    new_meeting:       "Nueva reunión",
    coming_soon_title: "Próximamente",
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
    // Home gateway cards
    home_cal_desc:   "Your calendar and events",
    home_rooms_desc: "Your spaces and teams",
    home_book_desc:  "Notes, ideas and documents",
    home_meet_desc:  "Today, recordings and history",
    home_relative_now: "right now",
    home_view:       "View",
    // Notifications toggles
    notif_meetings_label:     "Meeting reminders",
    notif_meetings_desc:      "15 minutes before each scheduled meeting",
    notif_weekly_label:       "Weekly email summary",
    notif_weekly_desc:        "Every Monday with the week's summary",
    notif_browser_label:      "Browser notifications",
    notif_browser_desc:       "Real-time alerts in the browser",
    notif_integrations_label: "Integration alerts",
    notif_integrations_desc:  "When there are sync errors",
    notif_transcripts_label:  "New transcriptions",
    notif_transcripts_desc:   "When a recording finishes processing",
    // Security
    password_min_length: "New password must be at least 8 characters",
    password_mismatch:   "Passwords don't match",
    password_updated:    "Password updated successfully",
    google_signin:       "Google",
    email_signin:        "Email",
    google_desc:         "Sign in with Google OAuth",
    email_desc:          "Sign in with email and OTP",
    active_label:        "Active",
    // Team sizes
    team_solo:  "Just me",
    team_2_10:  "2–10 people",
    team_11_50: "11–50 people",
    team_50p:   "50+ people",
    // Meeting type options
    meeting_presencial: "In-person",
    meeting_virtual:    "Virtual",
    meeting_hibrida:    "Hybrid",
    // Integrations
    integrations_connected_count_one:  "connected",
    integrations_connected_count_many: "connected",
    desktop_integration: "MeetBox Desktop",
    desktop_native_app:  "Native app",
    desktop_desc:        "Record meeting audio without bots · Works with Zoom, Meet and Teams",
    desktop_download:    "Download",
    desktop_step1:       "Download and install MeetBox Desktop on your computer",
    desktop_step2:       'Open the app and tap "Connect account"',
    desktop_step3:       "Copy the code below and paste it in the app",
    desktop_token_label: "Your connection code",
    desktop_copy:        "Copy",
    desktop_copied:      "Copied",
    desktop_regen_desc:  "The code is unique to your account. Regenerating it will disconnect any previously linked device.",
    other_tools_add:     "Add",
    // Meety welcome samples
    meety_sample1_text:  "What do I have today?",
    meety_sample1_hint:  "Today's meetings",
    meety_sample2_text:  "Create a meeting for tomorrow at 10am",
    meety_sample2_hint:  "Create event",
    meety_sample3_text:  "Summarize this week's notes",
    meety_sample3_hint:  "MeetBook",
    meety_sample4_text:  "Search a recent recording",
    meety_sample4_hint:  "Meetings",
    meety_welcome_hello: "Hello,",
    meety_thinking_deep1: "Thinking deeply",
    meety_thinking_deep2: "Reasoning",
    meety_thinking_deep3: "Connecting ideas",
    meety_search1:        "Searching",
    meety_search2:        "Analyzing sources",
    meety_search3:        "Synthesizing",
    meety_mode_think:     "Think",
    meety_mode_deep:      "Deep search",
    meety_no_active:      "Meety",
    // Settings Notifications section title
    notif_pref_title: "Notification preferences",
    // Plan section
    plan_free_desc:    "Up to 5 meetings/month · 1 integration · Basic transcription",
    plan_meetings:     "Meetings",
    plan_integrations: "Integrations",
    plan_storage:      "Storage",
    // Common
    new_meeting:       "New meeting",
    coming_soon_title: "Coming soon",
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
