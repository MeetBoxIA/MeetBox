"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Plus, ChevronRight, ChevronDown, MoreHorizontal, Trash2,
  Pin, PinOff, BookOpen, FileText, ArrowLeft, Bold, Italic,
  Heading1, Heading2, List, Code, Minus, Type, Check,
  BookMarked,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Notebook {
  id: string; title: string; emoji: string;
  created_at: string; updated_at: string;
}
interface Note {
  id: string; notebook_id: string; title: string; content: string;
  emoji: string; is_pinned: boolean; created_at: string; updated_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const NB_EMOJIS   = ["📓","📔","📒","📕","📗","📘","📙","📚","📖","🗒️","📊","🎯","🔬","🛠️","🎨","🚀","⚡","🧩","🌱","🏆"];
const NOTE_EMOJIS = ["📄","📝","💡","⭐","🔥","💎","📌","🔖","✅","❓","💬","🎵","📷","🔑","🎁","🧠","🌟","📐","🔍","🗺️"];

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)    return "ahora";
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000)return `hace ${Math.floor(diff / 3_600_000)} h`;
  return `hace ${Math.floor(diff / 86_400_000)} d`;
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// ── Emoji picker ──────────────────────────────────────────────────────────────
function EmojiPicker({ emojis, onSelect, onClose }: {
  emojis: string[]; onSelect: (e: string) => void; onClose: () => void;
}) {
  return (
    <div className="absolute z-30 top-full left-0 mt-1 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 w-56">
      <div className="grid grid-cols-5 gap-1">
        {emojis.map((e) => (
          <button
            key={e}
            onClick={() => { onSelect(e); onClose(); }}
            className="text-xl p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Editor toolbar ────────────────────────────────────────────────────────────
const TOOLBAR = [
  { id: "h1",   label: "Encabezado 1", Icon: Heading1 },
  { id: "h2",   label: "Encabezado 2", Icon: Heading2 },
  { id: "b",    label: "Negrita",      Icon: Bold     },
  { id: "i",    label: "Cursiva",      Icon: Italic   },
  { id: "ul",   label: "Lista",        Icon: List     },
  { id: "code", label: "Código",       Icon: Code     },
  { id: "hr",   label: "Separador",    Icon: Minus    },
];

function Toolbar({ onAction }: { onAction: (id: string) => void }) {
  return (
    <div className="flex items-center gap-0.5 px-6 py-2 border-b border-slate-100">
      <Type className="w-3.5 h-3.5 text-slate-300 mr-1.5" />
      {TOOLBAR.map(({ id, label, Icon }, i) => (
        <React.Fragment key={id}>
          {(id === "b" || id === "ul" || id === "hr") && (
            <div className="w-px h-4 bg-slate-200 mx-1" />
          )}
          <button
            title={label}
            onClick={() => onAction(id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MeetBookView() {
  const [notebooks,    setNotebooks]    = React.useState<Notebook[]>([]);
  const [expanded,     setExpanded]     = React.useState<Set<string>>(new Set());
  const [notesMap,     setNotesMap]     = React.useState<Record<string, Note[]>>({});
  const [activeNote,   setActiveNote]   = React.useState<Note | null>(null);
  const [draftTitle,   setDraftTitle]   = React.useState("");
  const [draftContent, setDraftContent] = React.useState("");
  const [saveState,    setSaveState]    = React.useState<"idle" | "saving" | "saved">("idle");
  const [savedAt,      setSavedAt]      = React.useState<string | null>(null);
  const [loading,      setLoading]      = React.useState(true);
  const [mobilePanel,  setMobilePanel]  = React.useState<"list" | "editor">("list");

  // Inline rename
  const [renamingNB,   setRenamingNB]   = React.useState<{ id: string; val: string } | null>(null);
  const [renamingNote, setRenamingNote] = React.useState<{ id: string; val: string } | null>(null);

  // Emoji pickers
  const [nbEmojiPicker,   setNbEmojiPicker]   = React.useState<string | null>(null);
  const [noteEmojiPicker, setNoteEmojiPicker] = React.useState<boolean>(false);

  // Context menus
  const [nbMenu,   setNbMenu]   = React.useState<string | null>(null);
  const [noteMenu, setNoteMenu] = React.useState<string | null>(null);

  const saveTimer  = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const contentRef = React.useRef<HTMLTextAreaElement>(null);
  const titleRef   = React.useRef<HTMLTextAreaElement>(null);

  // ── Load ──
  React.useEffect(() => {
    fetchNotebooks();
    const close = () => { setNbMenu(null); setNoteMenu(null); setNbEmojiPicker(null); setNoteEmojiPicker(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // Auto-resize textareas
  React.useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = "auto";
      titleRef.current.style.height = titleRef.current.scrollHeight + "px";
    }
  }, [draftTitle]);
  React.useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.height = "auto";
      contentRef.current.style.height = contentRef.current.scrollHeight + "px";
    }
  }, [draftContent]);

  // ── API helpers ──
  async function fetchNotebooks() {
    setLoading(true);
    const res  = await fetch("/api/meetbook/notebooks");
    const data = await res.json();
    setNotebooks(data.notebooks ?? []);
    setLoading(false);
  }

  async function fetchNotes(notebookId: string) {
    if (notesMap[notebookId]) return; // cached
    const res  = await fetch(`/api/meetbook/notes?notebookId=${notebookId}`);
    const data = await res.json();
    setNotesMap(prev => ({ ...prev, [notebookId]: data.notes ?? [] }));
  }

  async function createNotebook() {
    const res  = await fetch("/api/meetbook/notebooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Sin título", emoji: "📓" }),
    });
    const { notebook } = await res.json();
    setNotebooks(prev => [notebook, ...prev]);
    setNotesMap(prev => ({ ...prev, [notebook.id]: [] }));
    setExpanded(prev => new Set([...prev, notebook.id]));
    setRenamingNB({ id: notebook.id, val: "Sin título" });
  }

  async function renameNotebook(id: string, title: string) {
    await fetch(`/api/meetbook/notebooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setNotebooks(prev => prev.map(nb => nb.id === id ? { ...nb, title } : nb));
  }

  async function changeNbEmoji(id: string, emoji: string) {
    await fetch(`/api/meetbook/notebooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    setNotebooks(prev => prev.map(nb => nb.id === id ? { ...nb, emoji } : nb));
  }

  async function deleteNotebook(id: string) {
    await fetch(`/api/meetbook/notebooks/${id}`, { method: "DELETE" });
    setNotebooks(prev => prev.filter(nb => nb.id !== id));
    setNotesMap(prev => { const n = { ...prev }; delete n[id]; return n; });
    setExpanded(prev => { const s = new Set(prev); s.delete(id); return s; });
    if (activeNote?.notebook_id === id) { setActiveNote(null); setDraftTitle(""); setDraftContent(""); }
  }

  async function createNote(notebookId: string) {
    const res  = await fetch("/api/meetbook/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notebookId, title: "Sin título", emoji: "📄" }),
    });
    const { note } = await res.json();
    setNotesMap(prev => ({ ...prev, [notebookId]: [note, ...(prev[notebookId] ?? [])] }));
    openNote(note);
    setMobilePanel("editor");
    setRenamingNote({ id: note.id, val: "Sin título" });
  }

  async function renameNote(noteId: string, notebookId: string, title: string) {
    await fetch(`/api/meetbook/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setNotesMap(prev => ({
      ...prev,
      [notebookId]: (prev[notebookId] ?? []).map(n => n.id === noteId ? { ...n, title } : n),
    }));
    if (activeNote?.id === noteId) setActiveNote(prev => prev ? { ...prev, title } : prev);
  }

  async function togglePin(note: Note) {
    const next = !note.is_pinned;
    await fetch(`/api/meetbook/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_pinned: next }),
    });
    setNotesMap(prev => ({
      ...prev,
      [note.notebook_id]: (prev[note.notebook_id] ?? []).map(n => n.id === note.id ? { ...n, is_pinned: next } : n),
    }));
    if (activeNote?.id === note.id) setActiveNote(prev => prev ? { ...prev, is_pinned: next } : prev);
  }

  async function deleteNote(note: Note) {
    await fetch(`/api/meetbook/notes/${note.id}`, { method: "DELETE" });
    setNotesMap(prev => ({
      ...prev,
      [note.notebook_id]: (prev[note.notebook_id] ?? []).filter(n => n.id !== note.id),
    }));
    if (activeNote?.id === note.id) { setActiveNote(null); setDraftTitle(""); setDraftContent(""); }
  }

  async function changeNoteEmoji(noteId: string, notebookId: string, emoji: string) {
    await fetch(`/api/meetbook/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    setNotesMap(prev => ({
      ...prev,
      [notebookId]: (prev[notebookId] ?? []).map(n => n.id === noteId ? { ...n, emoji } : n),
    }));
    if (activeNote?.id === noteId) setActiveNote(prev => prev ? { ...prev, emoji } : prev);
  }

  // ── Editor ──
  function openNote(note: Note) {
    clearTimeout(saveTimer.current);
    setActiveNote(note);
    setDraftTitle(note.title);
    setDraftContent(note.content);
    setSaveState("idle");
    setSavedAt(note.updated_at);
  }

  function scheduleAutoSave(noteId: string, title: string, content: string) {
    setSaveState("idle");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(noteId, title, content), 1200);
  }

  async function doSave(noteId: string, title: string, content: string) {
    setSaveState("saving");
    const res = await fetch(`/api/meetbook/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    if (res.ok) {
      const { note } = await res.json();
      setSaveState("saved");
      setSavedAt(note.updated_at);
      setNotesMap(prev => ({
        ...prev,
        [note.notebook_id]: (prev[note.notebook_id] ?? []).map(n =>
          n.id === noteId ? { ...n, title, content, updated_at: note.updated_at } : n,
        ),
      }));
      setActiveNote(prev => prev ? { ...prev, title, content, updated_at: note.updated_at } : prev);
    } else {
      setSaveState("idle");
    }
  }

  function handleTitleChange(val: string) {
    setDraftTitle(val);
    if (activeNote) scheduleAutoSave(activeNote.id, val, draftContent);
  }

  function handleContentChange(val: string) {
    setDraftContent(val);
    if (activeNote) scheduleAutoSave(activeNote.id, draftTitle, val);
  }

  function applyFormat(action: string) {
    const ta = contentRef.current;
    if (!ta) return;
    const s   = ta.selectionStart;
    const e   = ta.selectionEnd;
    const val = ta.value;
    const sel = val.slice(s, e);
    let newVal = val, cur = s;

    switch (action) {
      case "b":
        newVal = `${val.slice(0,s)}**${sel || "texto"}**${val.slice(e)}`;
        cur    = sel ? e + 4 : s + 2;
        break;
      case "i":
        newVal = `${val.slice(0,s)}_${sel || "texto"}_${val.slice(e)}`;
        cur    = sel ? e + 2 : s + 1;
        break;
      case "h1": {
        const ls = val.lastIndexOf("\n", s - 1) + 1;
        newVal = `${val.slice(0,ls)}# ${val.slice(ls)}`;
        cur    = s + 2;
        break;
      }
      case "h2": {
        const ls = val.lastIndexOf("\n", s - 1) + 1;
        newVal = `${val.slice(0,ls)}## ${val.slice(ls)}`;
        cur    = s + 3;
        break;
      }
      case "ul": {
        const ls = val.lastIndexOf("\n", s - 1) + 1;
        newVal = `${val.slice(0,ls)}- ${val.slice(ls)}`;
        cur    = s + 2;
        break;
      }
      case "code":
        newVal = `${val.slice(0,s)}\`${sel || "código"}\`${val.slice(e)}`;
        cur    = sel ? e + 2 : s + 1;
        break;
      case "hr":
        newVal = `${val.slice(0,s)}\n\n---\n\n${val.slice(e)}`;
        cur    = s + 6;
        break;
    }

    setDraftContent(newVal);
    if (activeNote) scheduleAutoSave(activeNote.id, draftTitle, newVal);
    requestAnimationFrame(() => {
      ta.selectionStart = cur;
      ta.selectionEnd   = cur;
      ta.focus();
    });
  }

  // ── Toggle notebook expansion ──
  function toggleNotebook(nb: Notebook) {
    const isOpen = expanded.has(nb.id);
    setExpanded(prev => {
      const s = new Set(prev);
      isOpen ? s.delete(nb.id) : s.add(nb.id);
      return s;
    });
    if (!isOpen && !notesMap[nb.id]) fetchNotes(nb.id);
  }

  // ── Render helpers ──
  const activeNB = notebooks.find(nb => nb.id === activeNote?.notebook_id);

  // ── Skeleton ──
  if (loading) {
    return (
      <div className="flex h-full animate-pulse">
        <div className="w-60 border-r border-slate-100 p-4 space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-8 bg-slate-100 rounded-xl" />)}
        </div>
        <div className="flex-1 p-8 space-y-4">
          <div className="h-8 bg-slate-100 rounded-xl w-1/3" />
          <div className="h-4 bg-slate-100 rounded-lg w-2/3" />
          <div className="h-4 bg-slate-100 rounded-lg w-1/2" />
        </div>
      </div>
    );
  }

  // ── Sidebar ──
  const sidebar = (
    <aside className={cn(
      "flex flex-col bg-white border-r border-slate-100",
      "w-full lg:w-60 lg:shrink-0",
      mobilePanel === "editor" ? "hidden lg:flex" : "flex",
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <BookMarked className="w-4 h-4 text-[#050040]" />
          <span className="text-sm font-semibold text-[#050040]">MeetBook</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); createNotebook(); }}
          title="Nuevo cuaderno"
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-[#050040]"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Notebook list */}
      <div className="flex-1 overflow-y-auto py-2">
        {notebooks.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <BookOpen className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Sin cuadernos aún</p>
            <button
              onClick={createNotebook}
              className="mt-3 text-xs font-semibold text-[#050040] hover:underline"
            >
              Crear el primero
            </button>
          </div>
        ) : (
          notebooks.map((nb) => {
            const isOpen  = expanded.has(nb.id);
            const nbNotes = notesMap[nb.id] ?? [];
            return (
              <div key={nb.id}>
                {/* Notebook row */}
                <div className={cn(
                  "group flex items-center gap-1.5 px-2 py-1.5 mx-1 rounded-xl cursor-pointer transition-colors",
                  "hover:bg-slate-50",
                  activeNote?.notebook_id === nb.id && !activeNote ? "bg-[#050040]/5" : "",
                )}>
                  {/* Expand chevron */}
                  <button
                    onClick={() => toggleNotebook(nb)}
                    className="p-0.5 rounded transition-colors shrink-0"
                  >
                    {isOpen
                      ? <ChevronDown className="w-3 h-3 text-slate-400" />
                      : <ChevronRight className="w-3 h-3 text-slate-400" />
                    }
                  </button>

                  {/* Emoji */}
                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setNbEmojiPicker(nbEmojiPicker === nb.id ? null : nb.id); }}
                      className="text-base leading-none hover:scale-110 transition-transform"
                    >
                      {nb.emoji}
                    </button>
                    {nbEmojiPicker === nb.id && (
                      <EmojiPicker
                        emojis={NB_EMOJIS}
                        onSelect={(e) => changeNbEmoji(nb.id, e)}
                        onClose={() => setNbEmojiPicker(null)}
                      />
                    )}
                  </div>

                  {/* Title or rename input */}
                  {renamingNB?.id === nb.id ? (
                    <input
                      autoFocus
                      value={renamingNB.val}
                      onChange={(e) => setRenamingNB({ id: nb.id, val: e.target.value })}
                      onBlur={() => { renameNotebook(nb.id, renamingNB.val || "Sin título"); setRenamingNB(null); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape") {
                          renameNotebook(nb.id, renamingNB.val || "Sin título");
                          setRenamingNB(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 text-xs font-medium bg-white border border-[#050040]/30 rounded-lg px-1.5 py-0.5 outline-none"
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => { e.stopPropagation(); setRenamingNB({ id: nb.id, val: nb.title }); }}
                      onClick={() => toggleNotebook(nb)}
                      className="flex-1 min-w-0 text-xs font-medium text-slate-700 truncate"
                    >
                      {nb.title}
                    </span>
                  )}

                  {/* Count + options */}
                  {notesMap[nb.id] && (
                    <span className="text-[10px] text-slate-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {nbNotes.length}
                    </span>
                  )}
                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setNbMenu(nbMenu === nb.id ? null : nb.id); }}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-200"
                    >
                      <MoreHorizontal className="w-3 h-3 text-slate-500" />
                    </button>
                    {nbMenu === nb.id && (
                      <div
                        className="absolute right-0 z-20 bg-white rounded-xl shadow-lg border border-slate-100 py-1 min-w-[140px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => { createNote(nb.id); setNbMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          <Plus className="w-3.5 h-3.5" />Nueva nota
                        </button>
                        <button
                          onClick={() => { setRenamingNB({ id: nb.id, val: nb.title }); setNbMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          <Type className="w-3.5 h-3.5" />Renombrar
                        </button>
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          onClick={() => { deleteNotebook(nb.id); setNbMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes list (expanded) */}
                {isOpen && (
                  <div className="ml-6 pl-2 border-l border-slate-100">
                    {/* Add note button */}
                    <button
                      onClick={() => createNote(nb.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-slate-400 hover:text-[#050040] hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <Plus className="w-3 h-3" />Nueva nota
                    </button>

                    {nbNotes.length === 0 ? (
                      <p className="px-2 py-2 text-[11px] text-slate-400 italic">Sin notas</p>
                    ) : (
                      nbNotes.map((note) => {
                        const isActive = activeNote?.id === note.id;
                        return (
                          <div
                            key={note.id}
                            className={cn(
                              "group flex items-center gap-1.5 px-2 py-1.5 rounded-xl cursor-pointer transition-colors",
                              isActive ? "bg-[#050040] text-white" : "hover:bg-slate-50",
                            )}
                          >
                            <span className="text-sm shrink-0 leading-none">{note.emoji}</span>

                            {/* Rename input */}
                            {renamingNote?.id === note.id ? (
                              <input
                                autoFocus
                                value={renamingNote.val}
                                onChange={(e) => setRenamingNote({ id: note.id, val: e.target.value })}
                                onBlur={() => { renameNote(note.id, nb.id, renamingNote.val || "Sin título"); setRenamingNote(null); }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === "Escape") {
                                    renameNote(note.id, nb.id, renamingNote.val || "Sin título");
                                    setRenamingNote(null);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 min-w-0 text-xs bg-white border border-[#050040]/30 rounded-lg px-1.5 py-0.5 outline-none text-slate-800"
                              />
                            ) : (
                              <span
                                onClick={() => { openNote(note); setMobilePanel("editor"); }}
                                onDoubleClick={(e) => { e.stopPropagation(); setRenamingNote({ id: note.id, val: note.title }); }}
                                className={cn("flex-1 min-w-0 text-[11px] font-medium truncate", isActive ? "text-white" : "text-slate-600")}
                              >
                                {note.is_pinned && <Pin className="w-2.5 h-2.5 inline mr-1 opacity-60" />}
                                {note.title}
                              </span>
                            )}

                            {/* Note options */}
                            <div className="relative shrink-0">
                              <button
                                onClick={(e) => { e.stopPropagation(); setNoteMenu(noteMenu === note.id ? null : note.id); }}
                                className={cn(
                                  "p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity",
                                  isActive ? "hover:bg-white/20" : "hover:bg-slate-200",
                                )}
                              >
                                <MoreHorizontal className={cn("w-3 h-3", isActive ? "text-white" : "text-slate-400")} />
                              </button>
                              {noteMenu === note.id && (
                                <div
                                  className="absolute right-0 z-20 bg-white rounded-xl shadow-lg border border-slate-100 py-1 min-w-[140px]"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => { togglePin(note); setNoteMenu(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                                  >
                                    {note.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                                    {note.is_pinned ? "Desanclar" : "Anclar"}
                                  </button>
                                  <button
                                    onClick={() => { setRenamingNote({ id: note.id, val: note.title }); setNoteMenu(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                                  >
                                    <Type className="w-3.5 h-3.5" />Renombrar
                                  </button>
                                  <div className="border-t border-slate-100 my-1" />
                                  <button
                                    onClick={() => { deleteNote(note); setNoteMenu(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />Eliminar
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );

  // ── Editor area ──
  const editor = (
    <div className={cn(
      "flex-1 flex flex-col min-w-0 bg-slate-50",
      mobilePanel === "list" ? "hidden lg:flex" : "flex",
    )}>
      {activeNote ? (
        <>
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {/* Mobile back */}
              <button
                onClick={() => setMobilePanel("list")}
                className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
              >
                <ArrowLeft className="w-4 h-4 text-slate-500" />
              </button>

              {/* Breadcrumb */}
              <span className="text-xs text-slate-400 truncate hidden sm:block">
                {activeNB?.emoji} {activeNB?.title}
              </span>
              <ChevronRight className="w-3 h-3 text-slate-300 shrink-0 hidden sm:block" />
              <span className="text-xs font-medium text-slate-600 truncate">
                {activeNote.emoji} {draftTitle || "Sin título"}
              </span>
            </div>

            {/* Save indicator */}
            <div className="flex items-center gap-3 shrink-0">
              <span className={cn(
                "text-xs transition-all",
                saveState === "saving" ? "text-slate-400" :
                saveState === "saved"  ? "text-green-600 flex items-center gap-1" :
                "text-slate-300",
              )}>
                {saveState === "saving" && "Guardando…"}
                {saveState === "saved"  && <><Check className="w-3 h-3" />Guardado {savedAt ? relTime(savedAt) : ""}</>}
                {saveState === "idle" && savedAt && `Editado ${relTime(savedAt)}`}
              </span>

              {/* Word count */}
              <span className="text-xs text-slate-300 hidden sm:block">
                {wordCount(draftContent)} palabras
              </span>
            </div>
          </div>

          {/* Toolbar */}
          <Toolbar onAction={applyFormat} />

          {/* Editor body */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8">

              {/* Emoji + Title */}
              <div className="flex items-start gap-3 mb-2">
                <div className="relative mt-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setNoteEmojiPicker(!noteEmojiPicker); }}
                    className="text-4xl leading-none hover:scale-110 transition-transform"
                  >
                    {activeNote.emoji}
                  </button>
                  {noteEmojiPicker && (
                    <EmojiPicker
                      emojis={NOTE_EMOJIS}
                      onSelect={(e) => changeNoteEmoji(activeNote.id, activeNote.notebook_id, e)}
                      onClose={() => setNoteEmojiPicker(false)}
                    />
                  )}
                </div>

                <textarea
                  ref={titleRef}
                  value={draftTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Sin título"
                  rows={1}
                  className="flex-1 text-3xl sm:text-4xl font-bold text-slate-800 bg-transparent outline-none resize-none placeholder:text-slate-200 leading-tight overflow-hidden"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); contentRef.current?.focus(); }
                  }}
                />
              </div>

              {/* Metadata */}
              <div className="flex items-center gap-3 mb-6 pl-12">
                <span className="text-xs text-slate-400">
                  {new Date(activeNote.created_at).toLocaleDateString("es", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </span>
                {activeNote.is_pinned && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                    <Pin className="w-3 h-3" />Anclada
                  </span>
                )}
              </div>

              {/* Content */}
              <textarea
                ref={contentRef}
                value={draftContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Empieza a escribir… Usa # para títulos, **negrita**, _cursiva_, - para listas"
                className="w-full bg-transparent outline-none resize-none text-slate-700 text-base leading-relaxed placeholder:text-slate-300 font-mono"
                style={{ minHeight: "60vh" }}
              />
            </div>
          </div>
        </>
      ) : (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-[#050040]/8 flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-[#050040]" />
          </div>
          <h3 className="text-base font-semibold text-slate-700 mb-1">Ninguna nota seleccionada</h3>
          <p className="text-sm text-slate-400 max-w-xs">
            Selecciona una nota del panel izquierdo o crea una nueva
          </p>
          {notebooks.length > 0 && (
            <button
              onClick={() => createNote(notebooks[0].id)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#050040] text-white rounded-xl text-sm font-semibold hover:bg-[#050040]/90 transition"
            >
              <Plus className="w-4 h-4" />Nueva nota
            </button>
          )}
          {/* Mobile back */}
          <button
            onClick={() => setMobilePanel("list")}
            className="lg:hidden mt-3 text-xs text-[#050040] font-semibold hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />Ver cuadernos
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-full">
      {sidebar}
      {editor}
    </div>
  );
}
