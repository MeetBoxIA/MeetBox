"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, MessageCircle, Sparkles, Lightbulb, Globe,
  Pencil, RefreshCw, ChevronLeft, Menu,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AIChatInput, type AIChatInputMode } from "@/components/ui/ai-chat-input";
import { ChatMarkdown } from "@/components/ui/chat-markdown";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Conversation { id: string; title: string; created_at: string; updated_at: string; }
type Role = "user" | "assistant";
interface ChatMessage { id: string; role: Role; content: string; mode?: string | null; created_at: string; }

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1)   return "Ahora";
  if (min < 60)  return `Hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr  < 24)  return `Hace ${hr} h`;
  const days = Math.floor(hr / 24);
  if (days < 7)  return `Hace ${days} d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ── ConversationItem ──────────────────────────────────────────────────────────
function ConversationItem({
  conv, active, onSelect, onDelete,
}: {
  conv: Conversation; active: boolean;
  onSelect: () => void; onDelete: () => void;
}) {
  const [confirming, setConfirming] = React.useState(false);

  return (
    <div className={cn(
      "group relative rounded-xl transition-all",
      active ? "bg-[#050040]/10" : "hover:bg-slate-100",
    )}>
      <button onClick={onSelect}
        className="w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl">
        <MessageCircle className={cn(
          "w-4 h-4 shrink-0 mt-0.5",
          active ? "text-[#050040]" : "text-slate-400",
        )} />
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-medium leading-tight truncate",
            active ? "text-[#050040]" : "text-slate-700",
          )}>{conv.title}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{fmtRelative(conv.updated_at)}</p>
        </div>
      </button>

      {/* Delete button */}
      {confirming ? (
        <div className="absolute right-1.5 top-1.5 flex gap-1">
          <button onClick={onDelete}
            className="px-2 py-1 rounded-lg bg-red-500 text-white text-[10px] font-semibold hover:bg-red-600 transition">
            Eliminar
          </button>
          <button onClick={() => setConfirming(false)}
            className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-medium text-slate-500 hover:bg-slate-50 transition">
            ×
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
          title="Eliminar"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Meety avatar (reused by assistant message + thinking indicator) ──────────
function MeetyAvatar() {
  return (
    <div className="w-9 h-9 rounded-2xl shrink-0 flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #050040 0%, #1a1a8c 100%)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/undraw_ai-research-assistant_cxx0.svg" alt="" className="w-7 h-7 object-contain" />
    </div>
  );
}

// ── UserMessage (bubble on the right) ────────────────────────────────────────
function UserMessage({ msg, userName, userImage }: { msg: ChatMessage; userName: string; userImage: string | null }) {
  const [broken, setBroken] = React.useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-start gap-3 flex-row-reverse"
    >
      {userImage && !broken
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={userImage} alt={userName} onError={() => setBroken(true)} className="w-9 h-9 rounded-full object-cover border border-slate-100 shrink-0" />
        : <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">{initials(userName)}</div>}

      <div className="max-w-[78%] flex flex-col items-end">
        <div className="px-4 py-2.5 rounded-2xl bg-[#050040] text-white rounded-br-md text-sm leading-relaxed whitespace-pre-wrap shadow-sm">
          {msg.content}
        </div>
        {msg.mode && msg.mode !== "normal" && (
          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-medium text-slate-400">
            {msg.mode === "think" && <><Lightbulb className="w-3 h-3" />Pensar</>}
            {msg.mode === "deep"  && <><Globe className="w-3 h-3" />Búsqueda profunda</>}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── AssistantMessage (free text, no bubble, with optional live typing) ──────
function AssistantMessage({
  msg, streaming = false, onStreamEnd,
}: {
  msg: ChatMessage; streaming?: boolean; onStreamEnd?: () => void;
}) {
  const [visible, setVisible] = React.useState<string>(streaming ? "" : msg.content);
  const [done,    setDone]    = React.useState<boolean>(!streaming);

  // When streaming, reveal the text in chunks. Total ~2.5s regardless of length.
  React.useEffect(() => {
    if (!streaming) { setVisible(msg.content); setDone(true); return; }

    const text = msg.content;
    const STEP = Math.max(1, Math.ceil(text.length / 120));
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      i = Math.min(text.length, i + STEP);
      setVisible(text.slice(0, i));
      if (i < text.length) {
        timer = setTimeout(tick, 22);
      } else {
        setDone(true);
        onStreamEnd?.();
      }
    };
    timer = setTimeout(tick, 22);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming, msg.content]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-start gap-3"
    >
      <MeetyAvatar />
      <div className="flex-1 min-w-0 pt-1.5">
        <ChatMarkdown text={visible} />
        {!done && (
          <motion.span
            aria-hidden
            className="inline-block align-middle ml-0.5 rounded-sm"
            style={{ width: 3, height: 18, backgroundColor: "#050040" }}
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 0.85, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
    </motion.div>
  );
}

// ── ThinkingIndicator (rotating status with shimmer) ─────────────────────────
const THINKING_STATES: Record<"normal" | "think" | "deep", string[]> = {
  normal: ["Pensando", "Analizando", "Procesando"],
  think:  ["Pensando profundamente", "Razonando", "Conectando ideas"],
  deep:   ["Buscando", "Analizando fuentes", "Sintetizando"],
};

function ThinkingIndicator({ mode = "normal" }: { mode?: "normal" | "think" | "deep" }) {
  const states = THINKING_STATES[mode];
  const [idx, setIdx] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % states.length), 1100);
    return () => clearInterval(t);
  }, [states.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3"
    >
      <style>{`
        @keyframes meetyShimmer {
          from { background-position: 200% center; }
          to   { background-position: -200% center; }
        }
      `}</style>
      <MeetyAvatar />
      <div className="flex items-center gap-2 pt-2 min-h-9">
        <AnimatePresence mode="wait">
          <motion.span
            key={idx}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="text-[15px] font-medium"
            style={{
              background: "linear-gradient(90deg, #cbd5e1 0%, #050040 50%, #cbd5e1 100%)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              animation: "meetyShimmer 2s linear infinite",
            }}
          >
            {states[idx]}…
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── MeetyView ─────────────────────────────────────────────────────────────────
export default function MeetyView({ userName, userImage }: { userName: string; userImage: string | null }) {
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeId,      setActiveId]      = React.useState<string | null>(null);
  const [messages,      setMessages]      = React.useState<ChatMessage[]>([]);
  const [loadingConvs,  setLoadingConvs]  = React.useState(true);
  const [loadingMsgs,   setLoadingMsgs]   = React.useState(false);
  const [sending,       setSending]       = React.useState(false);
  const [thinkingMode,  setThinkingMode]  = React.useState<"normal" | "think" | "deep">("normal");
  const [streamingId,   setStreamingId]   = React.useState<string | null>(null);
  const [sidebarOpen,   setSidebarOpen]   = React.useState(false); // mobile

  const scrollRef = React.useRef<HTMLDivElement>(null);

  // ── Load conversations on mount ────────────────────────────────────────────
  React.useEffect(() => {
    fetch("/api/meety/conversations")
      .then((r) => r.ok ? r.json() : { conversations: [] })
      .then((d) => setConversations(d.conversations ?? []))
      .finally(() => setLoadingConvs(false));
  }, []);

  // ── Load messages when active conversation changes ─────────────────────────
  React.useEffect(() => {
    setStreamingId(null);
    if (!activeId) { setMessages([]); return; }
    setLoadingMsgs(true);
    let cancelled = false;
    fetch(`/api/meety/conversations/${activeId}/messages`)
      .then((r) => r.ok ? r.json() : { messages: [] })
      .then((d) => {
        if (cancelled) return;
        // Dedupe by id (protects against race with an in-flight send)
        const seen = new Set<string>();
        const unique: ChatMessage[] = ((d.messages ?? []) as ChatMessage[]).filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        setMessages(unique);
      })
      .finally(() => { if (!cancelled) setLoadingMsgs(false); });
    return () => { cancelled = true; };
  }, [activeId]);

  // ── Auto-scroll on new messages ────────────────────────────────────────────
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // ── Conversation actions ───────────────────────────────────────────────────
  async function createConversation(): Promise<Conversation | null> {
    const res = await fetch("/api/meety/conversations", { method: "POST" });
    if (!res.ok) return null;
    const d = await res.json();
    const conv: Conversation = d.conversation;
    setConversations((p) => [conv, ...p]);
    return conv;
  }

  async function handleNewChat() {
    const conv = await createConversation();
    if (conv) { setActiveId(conv.id); setSidebarOpen(false); }
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/meety/conversations/${id}`, { method: "DELETE" });
    setConversations((p) => p.filter((c) => c.id !== id));
    if (activeId === id) { setActiveId(null); setMessages([]); }
  }

  // ── Send message ───────────────────────────────────────────────────────────
  async function handleSend(text: string, mode: AIChatInputMode) {
    if (sending) return;

    // If no conversation selected, create one on the fly
    let convId = activeId;
    if (!convId) {
      const conv = await createConversation();
      if (!conv) return;
      convId = conv.id;
      setActiveId(conv.id);
    }

    const modeStr: "normal" | "think" | "deep" = mode.deep ? "deep" : mode.think ? "think" : "normal";

    // Optimistic user bubble
    const tempUserId = `tmp-${Date.now()}`;
    const tempUser: ChatMessage = {
      id: tempUserId, role: "user", content: text, mode: modeStr,
      created_at: new Date().toISOString(),
    };
    setMessages((p) => [...p, tempUser]);
    setThinkingMode(modeStr);
    setSending(true);

    try {
      // Show the thinking states for at least ~1.5s so users see the rotation
      const minDelay = new Promise((r) => setTimeout(r, 1500));
      const fetchPromise = fetch(`/api/meety/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content:    text,
          mode:       modeStr,
          // Send the user's local timezone so Meety creates events in the
          // right zone even when the server clock runs in UTC.
          timezone:   Intl.DateTimeFormat().resolvedOptions().timeZone,
          local_time: new Date().toISOString(),
        }),
      });
      const [res] = await Promise.all([fetchPromise, minDelay]);

      if (res.ok) {
        const d = await res.json();
        const userMsg = d.user      as ChatMessage;
        const asstMsg = d.assistant as ChatMessage;

        // Replace optimistic with server messages, deduping in case a
        // background fetch (e.g. on conversation switch) already merged them.
        setMessages((prev) => {
          const seen = new Set<string>([tempUserId, userMsg.id, asstMsg.id]);
          const kept = prev.filter((m) => !seen.has(m.id));
          return [...kept, userMsg, asstMsg];
        });

        // Start live typing of the assistant message
        setStreamingId(asstMsg.id);

        // Bump conversation in sidebar + maybe update title
        setConversations((p) => {
          const updated = p.map((c) => c.id === convId
            ? { ...c, updated_at: new Date().toISOString(), title: d.titleUpdated ?? c.title }
            : c,
          );
          return [...updated].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        });
      }
    } finally {
      setSending(false);
    }
  }

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="flex h-full bg-slate-50/40">
      {/* ── Conversations sidebar ── */}
      <AnimatePresence>
        {(sidebarOpen || typeof window === "undefined" || window.innerWidth >= 768) && (
          <motion.aside
            initial={{ x: -260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -260, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
            className={cn(
              "w-64 shrink-0 bg-white border-r border-slate-100 flex flex-col",
              "fixed md:relative inset-y-0 left-0 z-30 md:z-auto",
            )}
          >
            <div className="px-4 py-4 border-b border-slate-100 shrink-0 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #050040 0%, #1a1a8c 100%)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/undraw_ai-research-assistant_cxx0.svg" alt="" className="w-6 h-6 object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 leading-tight">Meety</p>
                  <p className="text-[10px] text-slate-400 leading-tight">Tu asistente IA</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)}
                className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="px-3 py-3 border-b border-slate-100 shrink-0">
              <button onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#050040] text-white text-sm font-semibold hover:bg-[#0c0c63] transition-all hover:shadow-md">
                <Plus className="w-4 h-4" />Nueva conversación
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
              {loadingConvs ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-4 h-4 text-slate-300 animate-spin" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <MessageCircle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Aún no hay conversaciones</p>
                </div>
              ) : (
                conversations.map((c) => (
                  <ConversationItem
                    key={c.id} conv={c}
                    active={activeId === c.id}
                    onSelect={() => { setActiveId(c.id); setSidebarOpen(false); }}
                    onDelete={() => deleteConversation(c.id)}
                  />
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden px-4 py-3 border-b border-slate-100 bg-white flex items-center gap-3 shrink-0">
          <button onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="text-sm font-semibold text-slate-800 truncate">
            {activeConv?.title ?? "Meety"}
          </h2>
        </div>

        {/* Active conversation header */}
        {activeConv && (
          <div className="hidden md:flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-white shrink-0">
            <h2 className="text-base font-semibold text-slate-800 flex-1 truncate">{activeConv.title}</h2>
            <button onClick={() => deleteConversation(activeConv.id)}
              className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              title="Eliminar conversación">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Messages or welcome */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          {!activeId ? (
            <WelcomeState userName={userName} onSampleClick={(t) => handleSend(t, { think: false, deep: false })} />
          ) : loadingMsgs ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="w-5 h-5 text-slate-300 animate-spin" />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              <AnimatePresence>
                {messages.map((m) =>
                  m.role === "user"
                    ? <UserMessage      key={m.id} msg={m} userName={userName} userImage={userImage} />
                    : <AssistantMessage
                        key={m.id}
                        msg={m}
                        streaming={m.id === streamingId}
                        onStreamEnd={() => setStreamingId((cur) => cur === m.id ? null : cur)}
                      />,
                )}
                {sending && <ThinkingIndicator mode={thinkingMode} />}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Chat input */}
        <div className="px-4 sm:px-6 pt-2 pb-5 bg-gradient-to-t from-slate-50/60 to-transparent">
          <AIChatInput onSend={handleSend} disabled={sending} />
        </div>
      </div>
    </div>
  );
}

// ── WelcomeState ──────────────────────────────────────────────────────────────
function WelcomeState({ userName, onSampleClick }: { userName: string; onSampleClick: (t: string) => void }) {
  const samples = [
    { icon: Sparkles,  text: "¿Qué tengo hoy?",                  hint: "Reuniones del día" },
    { icon: Pencil,    text: "Crea una reunión para mañana 10am", hint: "Crear evento" },
    { icon: Lightbulb, text: "Resúmeme las notas de la semana",  hint: "MeetBook" },
    { icon: Globe,     text: "Busca una grabación reciente",     hint: "Reuniones" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-2xl mx-auto py-8 text-center"
    >
      <div className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center shadow-lg"
        style={{ background: "linear-gradient(135deg, #050040 0%, #1a1a8c 100%)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/undraw_ai-research-assistant_cxx0.svg" alt="" className="w-14 h-14 object-contain" />
      </div>
      <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 leading-tight">
        ¡Hola, {userName}!
      </h1>
      <p className="text-base text-slate-500 mt-2">Soy <span className="font-semibold text-[#050040]">Meety</span>, tu asistente IA. ¿En qué te ayudo hoy?</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-8 text-left">
        {samples.map(({ icon: Icon, text, hint }) => (
          <button key={text} onClick={() => onSampleClick(text)}
            className="group bg-white border border-slate-100 rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#050040]/8 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Icon className="w-4 h-4 text-[#050040]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700 group-hover:text-[#050040] transition-colors truncate">{text}</p>
              <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
