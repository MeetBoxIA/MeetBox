"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { Lightbulb, Mic, Globe, Plus, Send, Image as ImageIcon, FileText, Video as VideoIcon, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const DEFAULT_PLACEHOLDERS = [
  "Pregúntame sobre tu día",
  "¿Cuáles son mis reuniones de hoy?",
  "Resume mis notas de la semana",
  "Crea una reunión con el equipo",
  "Busca una grabación reciente",
  "Sugiéreme una agenda para mi 1:1",
];

export interface AIChatInputMode { think: boolean; deep: boolean; }

export interface AIChatInputProps {
  placeholders?: string[];
  disabled?:    boolean;
  onSend?:      (text: string, mode: AIChatInputMode, files?: File[]) => void | Promise<void>;
  alwaysExpanded?: boolean;
}

// ── Attachment menu options ───────────────────────────────────────────────────
type AttachKind = "photo" | "video" | "file";

const ATTACH_OPTIONS: { kind: AttachKind; label: string; hint: string; icon: React.ElementType; accept: string }[] = [
  { kind: "photo", label: "Foto",    hint: "JPG, PNG, GIF",     icon: ImageIcon, accept: "image/*" },
  { kind: "video", label: "Video",   hint: "MP4, MOV, WebM",    icon: VideoIcon, accept: "video/*" },
  { kind: "file",  label: "Archivo", hint: "PDF, DOC, ZIP…",    icon: FileText,  accept: "*/*"     },
];

function previewSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const AIChatInput: React.FC<AIChatInputProps> = ({
  placeholders = DEFAULT_PLACEHOLDERS,
  disabled = false,
  onSend,
  alwaysExpanded = false,
}) => {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [isActive, setIsActive] = useState(alwaysExpanded);
  const [thinkActive, setThinkActive] = useState(false);
  const [deepSearchActive, setDeepSearchActive] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAcceptRef = useRef<string>("*/*");

  // Cycle placeholder text when input is inactive
  useEffect(() => {
    if (isActive || inputValue) return;
    const interval = setInterval(() => {
      setShowPlaceholder(false);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
        setShowPlaceholder(true);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, [isActive, inputValue, placeholders.length]);

  // Close input + menu when clicking outside (unless alwaysExpanded)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setAttachMenuOpen(false);
        if (!alwaysExpanded && !inputValue && attachments.length === 0) setIsActive(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputValue, alwaysExpanded, attachments.length]);

  const handleActivate = () => setIsActive(true);

  async function submit() {
    const text = inputValue.trim();
    if ((!text && attachments.length === 0) || disabled) return;

    let messageText = text;
    if (attachments.length > 0) {
      const names = attachments.map((a) => a.name).join(", ");
      messageText = text
        ? `${text}\n📎 ${names}`
        : `📎 Adjunto: ${names}`;
    }

    const filesSnapshot = attachments;
    setInputValue("");
    setAttachments([]);
    setAttachMenuOpen(false);

    await onSend?.(messageText, { think: thinkActive, deep: deepSearchActive }, filesSnapshot);
    inputRef.current?.focus();
  }

  function openPicker(accept: string) {
    pendingAcceptRef.current = accept;
    setAttachMenuOpen(false);
    // tiny delay so the menu close animation finishes before the OS picker takes over
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.accept = accept;
        fileInputRef.current.click();
      }
    }, 80);
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length) setAttachments((p) => [...p, ...files]);
    e.target.value = "";
  }

  const containerVariants = {
    collapsed: {
      height: 68,
      boxShadow: "0 2px 8px 0 rgba(5,0,64,0.06)",
      transition: { type: "spring" as const, stiffness: 120, damping: 18 },
    },
    expanded: {
      height: attachments.length > 0 ? 188 : 128,
      boxShadow: "0 12px 40px -8px rgba(5,0,64,0.18)",
      transition: { type: "spring" as const, stiffness: 120, damping: 18 },
    },
  };

  const placeholderContainerVariants = {
    initial: {},
    animate: { transition: { staggerChildren: 0.025 } },
    exit: { transition: { staggerChildren: 0.015, staggerDirection: -1 as const } },
  };

  const letterVariants = {
    initial: { opacity: 0, filter: "blur(12px)", y: 10 },
    animate: {
      opacity: 1, filter: "blur(0px)", y: 0,
      transition: {
        opacity: { duration: 0.25 }, filter: { duration: 0.4 },
        y: { type: "spring" as const, stiffness: 80, damping: 20 },
      },
    },
    exit: {
      opacity: 0, filter: "blur(12px)", y: -10,
      transition: {
        opacity: { duration: 0.2 }, filter: { duration: 0.3 },
        y: { type: "spring" as const, stiffness: 80, damping: 20 },
      },
    },
  };

  const expanded = isActive || !!inputValue || alwaysExpanded || attachments.length > 0;

  return (
    <div className="w-full flex justify-center items-center text-slate-900">
      <motion.div
        ref={wrapperRef}
        className="w-full max-w-3xl relative"
        variants={containerVariants}
        animate={expanded ? "expanded" : "collapsed"}
        initial="collapsed"
        style={{ overflow: "visible", borderRadius: 32, background: "#fff" }}
        onClick={handleActivate}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onFileSelected}
        />

        {/* Attachment menu popover */}
        <AnimatePresence>
          {attachMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="absolute left-3 bottom-full mb-3 z-30 w-60 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Adjuntar</p>
              </div>
              <div className="p-1.5">
                {ATTACH_OPTIONS.map(({ kind, label, hint, icon: Icon, accept }) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openPicker(accept); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#050040]/8 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Icon className="w-4 h-4 text-[#050040]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 leading-tight">{label}</p>
                      <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{hint}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-stretch w-full h-full overflow-hidden rounded-[32px]">
          {/* Attached files preview row */}
          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="px-3 pt-3 overflow-hidden"
              >
                <div className="flex gap-2 flex-wrap">
                  {attachments.map((f, i) => {
                    const isImg = f.type.startsWith("image/");
                    const isVid = f.type.startsWith("video/");
                    const Icon = isImg ? ImageIcon : isVid ? VideoIcon : FileText;
                    return (
                      <motion.div
                        key={`${f.name}-${i}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl bg-slate-100 border border-slate-200"
                      >
                        <Icon className="w-3.5 h-3.5 text-[#050040] shrink-0" />
                        <div className="min-w-0 max-w-[160px]">
                          <p className="text-xs font-medium text-slate-700 truncate leading-tight">{f.name}</p>
                          <p className="text-[10px] text-slate-400 leading-tight">{previewSize(f.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setAttachments((p) => p.filter((_, idx) => idx !== i)); }}
                          className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors shrink-0"
                          title="Quitar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input row */}
          <div className="flex items-center gap-2 p-3 bg-white">
            <button
              className={`p-3 rounded-full transition-all ${
                attachMenuOpen
                  ? "bg-[#050040] text-white rotate-45"
                  : "hover:bg-slate-100 text-slate-700"
              }`}
              title="Adjuntar"
              type="button"
              onClick={(e) => { e.stopPropagation(); handleActivate(); setAttachMenuOpen((o) => !o); }}
              disabled={disabled}
            >
              <Plus size={20} />
            </button>

            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                className="flex-1 py-2 text-base w-full font-normal text-slate-800 bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-none focus:shadow-none focus-visible:outline-none focus-visible:ring-0 appearance-none"
                style={{
                  position: "relative", zIndex: 1,
                  outline: "none", border: "none", boxShadow: "none",
                  WebkitAppearance: "none", MozAppearance: "none", appearance: "none",
                  background: "transparent",
                }}
                onFocus={handleActivate}
                disabled={disabled}
              />
              <div className="absolute left-0 top-0 w-full h-full pointer-events-none flex items-center px-3 py-2">
                <AnimatePresence mode="wait">
                  {showPlaceholder && !isActive && !inputValue && (
                    <motion.span
                      key={placeholderIndex}
                      className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 select-none pointer-events-none"
                      style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", zIndex: 0 }}
                      variants={placeholderContainerVariants}
                      initial="initial" animate="animate" exit="exit"
                    >
                      {placeholders[placeholderIndex].split("").map((char, i) => {
                        const isSpace = char === " ";
                        return (
                          <motion.span
                            key={i}
                            variants={letterVariants}
                            style={{
                              display: "inline-block",
                              width: isSpace ? "0.3em" : undefined,
                            }}
                          >
                            {isSpace ? "" : char}
                          </motion.span>
                        );
                      })}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <button
              className="p-3 rounded-full hover:bg-slate-100 transition disabled:opacity-40"
              title="Voz" type="button" tabIndex={-1} disabled={disabled}
            >
              <Mic size={20} />
            </button>
            <button
              className="flex items-center gap-1 bg-[#050040] hover:bg-[#0c0c63] text-white p-3 rounded-full font-medium justify-center disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
              title="Enviar" type="button" tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); submit(); }}
              disabled={disabled || (!inputValue.trim() && attachments.length === 0)}
            >
              <Send size={18} />
            </button>
          </div>

          {/* Expanded controls */}
          <motion.div
            className="w-full flex justify-start px-4 items-center text-sm"
            variants={{
              hidden:  { opacity: 0, y: 20, pointerEvents: "none"  as const, transition: { duration: 0.25 } },
              visible: { opacity: 1, y: 0,  pointerEvents: "auto"  as const, transition: { duration: 0.35, delay: 0.08 } },
            }}
            initial="hidden"
            animate={expanded ? "visible" : "hidden"}
            style={{ marginTop: 8 }}
          >
            <div className="flex gap-3 items-center">
              <button
                className={`flex items-center gap-1 px-4 py-2 rounded-full transition-all font-medium group ${
                  thinkActive
                    ? "bg-[#050040]/10 outline outline-[#050040]/60 text-[#050040]"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
                title="Pensar"
                type="button"
                onClick={(e) => { e.stopPropagation(); setThinkActive((a) => !a); }}
              >
                <Lightbulb className="group-hover:fill-yellow-300 transition-all" size={18} />
                Pensar
              </button>

              <motion.button
                className={`flex items-center px-4 gap-1 py-2 rounded-full transition font-medium whitespace-nowrap overflow-hidden justify-start ${
                  deepSearchActive
                    ? "bg-[#050040]/10 outline outline-[#050040]/60 text-[#050040]"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
                title="Búsqueda profunda"
                type="button"
                onClick={(e) => { e.stopPropagation(); setDeepSearchActive((a) => !a); }}
                initial={false}
                animate={{ width: deepSearchActive ? 165 : 36, paddingLeft: deepSearchActive ? 8 : 9 }}
              >
                <div className="flex-1"><Globe size={18} /></div>
                <motion.span className="pb-[2px]" initial={false} animate={{ opacity: deepSearchActive ? 1 : 0 }}>
                  Búsqueda profunda
                </motion.span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};
