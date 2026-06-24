"use client";
/**
 * MeetBookView — Notion-style block editor for notes and notebooks.
 *
 * Notes are stored as a JSON array of Block objects (paragraph, h1-h3,
 * bullet, numbered, toggle, quote, code, divider). Legacy plain-text
 * content is transparently migrated to a single paragraph block on load.
 *
 * Key design choices:
 *   - Blocks use contentEditable divs for rich editing without a heavy
 *     editor library. execCommand is used for bold/italic/underline.
 *   - The "/" command palette (BlockTypeMenu) appears when the cursor is
 *     on an empty block and the user types "/".
 *   - Auto-save is debounced (1 second of inactivity) to avoid hammering
 *     the API on every keystroke.
 *   - Trash uses soft-delete (deleted_at) so items can be restored.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Plus, ChevronRight, ChevronDown, MoreHorizontal, Trash2,
  Pin, PinOff, BookOpen, FileText, ArrowLeft, BookMarked,
  Check, GripVertical, Heading1, Heading2, Heading3, List,
  ListOrdered, Code2, Minus, Type, Bold, Italic, Underline,
  Strikethrough, MessageSquare, Copy, Download, RotateCcw,
} from "lucide-react";
import { useNotifications } from "@/lib/notifications";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Notebook { id: string; title: string; emoji: string; created_at: string; updated_at: string; }
interface Note { id: string; notebook_id: string; title: string; content: string; emoji: string; is_pinned: boolean; created_at: string; updated_at: string; }
interface TrashItem { kind: "notebook" | "note"; id: string; title: string; emoji: string; deleted_at: string; notebook_id?: string; notebook_title?: string; }

type BlockType = "paragraph" | "h1" | "h2" | "h3" | "bullet" | "numbered" | "toggle" | "quote" | "divider" | "code";

interface Block { id: string; type: BlockType; content: string; collapsed?: boolean; }

// ── Block utils ────────────────────────────────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2, 10); }
function emptyBlock(type: BlockType = "paragraph"): Block { return { id: genId(), type, content: "" }; }

/**
 * Parse raw note content into a Block array.
 * Handles three cases:
 *   1. Valid JSON array of blocks → use as-is
 *   2. Empty string → single empty paragraph
 *   3. Legacy plain text → wrap in a paragraph block (one-time migration)
 */
function parseBlocks(raw: string): Block[] {
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p) && p.length) return p as Block[];
  } catch {}
  if (!raw.trim()) return [emptyBlock()];
  return [{ id: genId(), type: "paragraph", content: raw }];
}

function serializeBlocks(blocks: Block[]): string {
  return JSON.stringify(blocks);
}

function blockWordCount(blocks: Block[]): number {
  return blocks.reduce((acc, b) => {
    const text = b.content.replace(/<[^>]*>/g, " ").trim();
    return acc + (text ? text.split(/\s+/).length : 0);
  }, 0);
}

// ── Constants ──────────────────────────────────────────────────────────────────
const NB_EMOJIS   = ["📓","📔","📒","📕","📗","📘","📙","📚","📖","🗒️","📊","🎯","🔬","🛠️","🎨","🚀","⚡","🧩","🌱","🏆"];
const NOTE_EMOJIS = ["📄","📝","💡","⭐","🔥","💎","📌","🔖","✅","❓","💬","🎵","📷","🔑","🎁","🧠","🌟","📐","🔍","🗺️"];

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)     return "ahora";
  if (diff < 3_600_000)  return `hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)} h`;
  return `hace ${Math.floor(diff / 86_400_000)} d`;
}

// ── Block type definitions ─────────────────────────────────────────────────────
const BLOCK_DEFS: { type: BlockType; label: string; desc: string; Icon: React.FC<{ className?: string }> }[] = [
  { type: "paragraph", label: "Texto",       desc: "Párrafo normal",        Icon: Type        },
  { type: "h1",        label: "Título 1",    desc: "Encabezado grande",     Icon: Heading1    },
  { type: "h2",        label: "Título 2",    desc: "Encabezado mediano",    Icon: Heading2    },
  { type: "h3",        label: "Título 3",    desc: "Encabezado pequeño",    Icon: Heading3    },
  { type: "bullet",    label: "Lista",       desc: "Lista con viñetas",     Icon: List        },
  { type: "numbered",  label: "Numerada",    desc: "Lista numerada",        Icon: ListOrdered },
  { type: "toggle",    label: "Desplegable", desc: "Bloque contraíble",     Icon: ChevronRight},
  { type: "quote",     label: "Cita",        desc: "Bloque de cita",        Icon: MessageSquare},
  { type: "code",      label: "Código",      desc: "Bloque de código",      Icon: Code2       },
  { type: "divider",   label: "Separador",   desc: "Línea divisoria",       Icon: Minus       },
];

function blockContentStyle(type: BlockType): string {
  switch (type) {
    case "h1":       return "text-4xl font-bold text-slate-800 leading-tight";
    case "h2":       return "text-3xl font-semibold text-slate-800 leading-snug";
    case "h3":       return "text-2xl font-semibold text-slate-700 leading-snug";
    case "quote":    return "text-lg text-slate-600 italic leading-relaxed";
    case "code":     return "text-base font-mono text-[#050040] leading-relaxed";
    default:         return "text-lg text-slate-700 leading-relaxed";
  }
}

function blockPlaceholder(type: BlockType): string {
  switch (type) {
    case "h1": return "Título 1";
    case "h2": return "Título 2";
    case "h3": return "Título 3";
    case "quote": return "Escribe una cita…";
    case "code": return "Código…";
    default: return "Escribe algo, o '/' para comandos…";
  }
}

// ── Caret helpers ──────────────────────────────────────────────────────────────
// contentEditable doesn't expose a simple cursor API; we must use the
// Range/Selection API to programmatically position the cursor after block
// type changes or Enter/Backspace merges.
function placeCaretAtEnd(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function placeCaretAtStart(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

// ── EmojiPicker ────────────────────────────────────────────────────────────────
function EmojiPicker({ emojis, onSelect, onClose }: { emojis: string[]; onSelect: (e: string) => void; onClose: () => void }) {
  return (
    <div className="absolute z-30 top-full left-0 mt-1 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 w-56">
      <div className="grid grid-cols-5 gap-1">
        {emojis.map((e) => (
          <button key={e} onClick={() => { onSelect(e); onClose(); }}
            className="text-xl p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── BlockTypeMenu ──────────────────────────────────────────────────────────────
// Slash-command palette: appears when the user types "/" in an empty block.
// Uses onMouseDown (not onClick) so the block doesn't lose focus before selection.
function BlockTypeMenu({ query, onSelect, onClose }: {
  query: string;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}) {
  const filtered = query
    ? BLOCK_DEFS.filter(d => d.label.toLowerCase().includes(query.toLowerCase()) || d.desc.toLowerCase().includes(query.toLowerCase()))
    : BLOCK_DEFS;

  React.useEffect(() => {
    function handle(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 py-1.5 w-80">
      <p className="px-4 pb-1 pt-0.5 text-xs uppercase tracking-wide font-semibold text-slate-400">
        Tipo de bloque
      </p>
      <div className="max-h-80 overflow-y-auto">
        {filtered.map(({ type, label, desc, Icon }) => (
          <button
            key={type}
            onMouseDown={(e) => { e.preventDefault(); onSelect(type); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">{label}</p>
              <p className="text-xs text-slate-400">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── FloatingFormatBar ──────────────────────────────────────────────────────────
function FloatingFormatBar({ x, y }: { x: number; y: number }) {
  const formats = [
    { cmd: "bold",          Icon: Bold,          title: "Negrita (Ctrl+B)" },
    { cmd: "italic",        Icon: Italic,        title: "Cursiva (Ctrl+I)" },
    { cmd: "underline",     Icon: Underline,     title: "Subrayar (Ctrl+U)" },
    { cmd: "strikeThrough", Icon: Strikethrough, title: "Tachado" },
  ];

  return (
    <div
      style={{ position: "fixed", left: x, top: y - 48, transform: "translateX(-50%)", pointerEvents: "auto" }}
      onMouseDown={(e) => e.preventDefault()}
      className="flex items-center gap-0.5 bg-[#050040] rounded-xl px-2 py-1.5 shadow-2xl"
    >
      {formats.map(({ cmd, Icon, title }) => (
        <button
          key={cmd}
          title={title}
          onClick={() => { document.execCommand(cmd, false); }}
          className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors"
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
      <div className="w-px h-4 bg-white/20 mx-1" />
      <select
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => document.execCommand("foreColor", false, e.target.value)}
        className="bg-transparent text-white/70 text-xs outline-none cursor-pointer"
        title="Color"
      >
        <option value="#1e1e1e">A</option>
        <option value="#dc2626">🔴</option>
        <option value="#2563eb">🔵</option>
        <option value="#16a34a">🟢</option>
      </select>
    </div>
  );
}

// ── BlockRow ──────────────────────────────────────────────────────────────────
interface BlockRowProps {
  block: Block;
  numIndex: number;
  slashActive: boolean;
  slashQuery: string;
  editableRef: (el: HTMLDivElement | null) => void;
  onInput: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
  onInsertAfter: () => void;
  onTypeSelect: (type: BlockType) => void;
  onSlashClose: () => void;
  onDelete: () => void;
  onToggleCollapse: () => void;
}

function BlockRow({
  block, numIndex, slashActive, slashQuery, editableRef,
  onInput, onKeyDown, onFocus, onBlur,
  onInsertAfter, onTypeSelect, onSlashClose, onDelete, onToggleCollapse,
}: BlockRowProps) {
  const [hover, setHover]         = React.useState(false);
  const [typeMenu, setTypeMenu]   = React.useState(false);
  const innerRef = React.useRef<HTMLDivElement | null>(null);

  // Initialize innerHTML only on mount (DOM is source of truth after that)
  React.useLayoutEffect(() => {
    if (innerRef.current && block.type !== "divider") {
      innerRef.current.innerHTML = block.content;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount

  const combinedRef = (el: HTMLDivElement | null) => {
    innerRef.current = el;
    editableRef(el);
  };

  if (block.type === "divider") {
    return (
      <div className="group relative py-4 flex items-center gap-2"
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <div className={cn("flex items-center gap-0.5 shrink-0 transition-opacity w-16 justify-end pr-1", hover ? "opacity-100" : "opacity-0")}>
          <button onMouseDown={(e) => { e.preventDefault(); onInsertAfter(); }}
            className="p-0.5 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); onDelete(); }}
            className="p-0.5 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <hr className="flex-1 border-slate-200" />
      </div>
    );
  }

  return (
    <div
      className="group/row relative flex items-start"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setTypeMenu(false); }}
    >
      {/* Left gutter: handle + type menu */}
      <div className={cn(
        "shrink-0 flex items-center gap-0.5 transition-opacity w-16 justify-end pr-2",
        block.type === "h1" ? "pt-1" : block.type === "h2" ? "pt-0.5" : "pt-[3px]",
        hover ? "opacity-100" : "opacity-0",
      )}>
        <button
          title="Añadir bloque"
          onMouseDown={(e) => { e.preventDefault(); onInsertAfter(); }}
          className="p-0.5 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="relative">
          <button
            title="Tipo de bloque"
            onMouseDown={(e) => { e.preventDefault(); setTypeMenu(v => !v); }}
            className="p-0.5 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          {typeMenu && (
            <BlockTypeMenu
              query=""
              onSelect={(t) => { onTypeSelect(t); setTypeMenu(false); }}
              onClose={() => setTypeMenu(false)}
            />
          )}
        </div>
      </div>

      {/* Block prefix */}
      <div className={cn(
        "shrink-0 select-none",
        block.type === "h1" ? "pt-1.5" : block.type === "h2" ? "pt-1" : "pt-[5px]",
      )}>
        {block.type === "bullet" && (
          <span className="text-slate-400 text-base mr-2 leading-none">•</span>
        )}
        {block.type === "numbered" && (
          <span className="text-slate-400 text-sm font-medium mr-2 tabular-nums">{numIndex}.</span>
        )}
        {block.type === "toggle" && (
          <button
            onMouseDown={(e) => { e.preventDefault(); onToggleCollapse(); }}
            className="text-slate-400 hover:text-slate-600 transition-colors mr-1 mt-0.5"
          >
            <ChevronRight className={cn("w-4 h-4 transition-transform duration-200", !block.collapsed && "rotate-90")} />
          </button>
        )}
      </div>

      {/* Editable content */}
      <div className={cn(
        "flex-1 min-w-0 relative",
        block.type === "quote" && "border-l-[3px] border-[#050040]/25 pl-4",
        block.type === "code"  && "bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 my-0.5",
        block.collapsed && block.type === "toggle" && "opacity-50",
      )}>
        <div
          ref={combinedRef}
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          data-placeholder={blockPlaceholder(block.type)}
          className={cn(
            blockContentStyle(block.type),
            "outline-none w-full min-h-[1.5em] py-0.5",
            "empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 empty:before:pointer-events-none",
          )}
        />
        {/* Slash menu anchored to this block */}
        {slashActive && (
          <BlockTypeMenu
            query={slashQuery}
            onSelect={onTypeSelect}
            onClose={onSlashClose}
          />
        )}
      </div>
    </div>
  );
}

// ── BlockEditor ────────────────────────────────────────────────────────────────
interface BlockEditorProps {
  initialContent: string;
  onChange: (content: string) => void;
}

function BlockEditor({ initialContent, onChange }: BlockEditorProps) {
  const [blocks, setBlocks] = React.useState<Block[]>(() => parseBlocks(initialContent));
  const [slashState,  setSlashState]  = React.useState<{ blockId: string; query: string } | null>(null);
  const [floatBar,    setFloatBar]    = React.useState<{ x: number; y: number } | null>(null);

  const refs    = React.useRef<Record<string, HTMLDivElement | null>>({});
  const blocksRef = React.useRef(blocks);
  React.useEffect(() => { blocksRef.current = blocks; }, [blocks]);

  // Floating format bar on selection
  React.useEffect(() => {
    function onSelChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setFloatBar(null); return; }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect.width) { setFloatBar(null); return; }
      setFloatBar({ x: rect.left + rect.width / 2, y: rect.top });
    }
    document.addEventListener("selectionchange", onSelChange);
    return () => document.removeEventListener("selectionchange", onSelChange);
  }, []);

  // Compute numbered list indices
  const numIndices = React.useMemo(() => {
    const map: Record<string, number> = {};
    let counter = 0;
    for (const b of blocks) {
      if (b.type === "numbered") { counter++; map[b.id] = counter; }
      else counter = 0;
    }
    return map;
  }, [blocks]);

  function commit(next: Block[]) {
    setBlocks(next);
    onChange(serializeBlocks(next));
  }

  function updateContent(id: string) {
    const el = refs.current[id];
    if (!el) return;
    const content = el.innerHTML;
    const next = blocksRef.current.map(b => b.id === id ? { ...b, content } : b);
    commit(next);
  }

  function insertAfter(id: string, type: BlockType = "paragraph") {
    const nb = emptyBlock(type);
    const curr = blocksRef.current;
    const idx = curr.findIndex(b => b.id === id);
    const next = [...curr.slice(0, idx + 1), nb, ...curr.slice(idx + 1)];
    commit(next);
    requestAnimationFrame(() => {
      const el = refs.current[nb.id];
      if (el) placeCaretAtStart(el);
    });
  }

  function deleteBlock(id: string) {
    const curr = blocksRef.current;
    if (curr.length === 1) {
      // clear content instead of removing last block
      const el = refs.current[id];
      if (el) { el.innerHTML = ""; commit(curr.map(b => b.id === id ? { ...b, content: "" } : b)); }
      return;
    }
    const idx = curr.findIndex(b => b.id === id);
    const prevId = curr[idx - 1]?.id;
    const next = curr.filter(b => b.id !== id);
    commit(next);
    if (prevId) {
      requestAnimationFrame(() => {
        const el = refs.current[prevId];
        if (el) placeCaretAtEnd(el);
      });
    }
  }

  function changeType(id: string, type: BlockType) {
    setSlashState(null);
    const curr = blocksRef.current;
    const next = curr.map(b => b.id === id ? { ...b, type, content: type === "divider" ? "" : b.content } : b);
    commit(next);
    if (type !== "divider") {
      requestAnimationFrame(() => {
        const el = refs.current[id];
        if (el) {
          // Restore content (layout effect won't run since id unchanged)
          const block = next.find(b => b.id === id)!;
          if (el.innerHTML !== block.content) el.innerHTML = block.content;
          placeCaretAtEnd(el);
        }
      });
    }
  }

  function handleInput(id: string) {
    const el = refs.current[id];
    if (!el) return;
    const text = el.textContent ?? "";
    if (text.startsWith("/")) {
      setSlashState({ blockId: id, query: text.slice(1) });
    } else {
      setSlashState(null);
    }
    updateContent(id);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>, block: Block) {
    // Slash type select via Enter
    if (slashState?.blockId === block.id && e.key === "Enter") {
      e.preventDefault();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const el = refs.current[block.id];
      if (el) updateContent(block.id);
      // Continue list type on Enter, otherwise paragraph
      const nextType: BlockType =
        block.type === "bullet" || block.type === "numbered" ? block.type : "paragraph";
      insertAfter(block.id, nextType);
      return;
    }

    if (e.key === "Backspace") {
      const el = refs.current[block.id];
      const isEmpty = !el || el.textContent === "" || el.innerHTML === "" || el.innerHTML === "<br>";
      if (isEmpty) {
        e.preventDefault();
        if (block.type !== "paragraph") {
          changeType(block.id, "paragraph");
        } else {
          deleteBlock(block.id);
        }
        return;
      }
    }

    // Clear slash state on Escape
    if (e.key === "Escape") {
      setSlashState(null);
    }
  }

  function toggleCollapse(id: string) {
    const next = blocksRef.current.map(b => b.id === id ? { ...b, collapsed: !b.collapsed } : b);
    commit(next);
  }

  return (
    <div className="relative select-text">
      {blocks.map((block) => (
        <BlockRow
          key={block.id}
          block={block}
          numIndex={numIndices[block.id] ?? 1}
          slashActive={slashState?.blockId === block.id}
          slashQuery={slashState?.blockId === block.id ? slashState.query : ""}
          editableRef={(el) => { refs.current[block.id] = el; }}
          onInput={() => handleInput(block.id)}
          onKeyDown={(e) => handleKeyDown(e, block)}
          onFocus={() => {}}
          onBlur={() => {}}
          onInsertAfter={() => insertAfter(block.id)}
          onTypeSelect={(type) => changeType(block.id, type)}
          onSlashClose={() => setSlashState(null)}
          onDelete={() => deleteBlock(block.id)}
          onToggleCollapse={() => toggleCollapse(block.id)}
        />
      ))}

      {/* Click to add block at end */}
      <button
        onMouseDown={() => {
          const last = blocksRef.current.at(-1);
          if (last && last.type !== "divider") {
            const el = refs.current[last.id];
            if (el && (el.textContent ?? "").trim() !== "") {
              insertAfter(last.id);
              return;
            }
            if (el) placeCaretAtEnd(el);
          }
        }}
        className="w-full h-12 block"
        aria-hidden
      />

      {floatBar && <FloatingFormatBar x={floatBar.x} y={floatBar.y} />}
    </div>
  );
}

// ── MeetBookView ───────────────────────────────────────────────────────────────
export default function MeetBookView({ workspaceId }: { workspaceId?: string }) {
  const { addNotification } = useNotifications();
  const [notebooks,    setNotebooks]    = React.useState<Notebook[]>([]);
  const [expanded,     setExpanded]     = React.useState<Set<string>>(new Set());
  const [notesMap,     setNotesMap]     = React.useState<Record<string, Note[] | undefined>>({});
  const [activeNote,   setActiveNote]   = React.useState<Note | null>(null);
  const [draftTitle,   setDraftTitle]   = React.useState("");
  const [saveState,    setSaveState]    = React.useState<"idle" | "saving" | "saved">("idle");
  const [savedAt,      setSavedAt]      = React.useState<string | null>(null);
  const [loading,      setLoading]      = React.useState(true);
  const [mobilePanel,  setMobilePanel]  = React.useState<"list" | "editor">("list");
  const [wordCount,    setWordCount]    = React.useState(0);

  const [renamingNB,   setRenamingNB]   = React.useState<{ id: string; val: string } | null>(null);
  const [renamingNote, setRenamingNote] = React.useState<{ id: string; val: string } | null>(null);
  const [nbEmojiPicker,   setNbEmojiPicker]   = React.useState<string | null>(null);
  const [noteEmojiPicker, setNoteEmojiPicker] = React.useState(false);
  const [menu, setMenu] = React.useState<
    | { kind: "nb";   id: string; nb: Notebook; x: number; y: number }
    | { kind: "note"; id: string; note: Note;   nbId: string; x: number; y: number }
    | null
  >(null);

  const [trashItems,  setTrashItems]  = React.useState<TrashItem[]>([]);
  const [trashOpen,   setTrashOpen]   = React.useState(false);
  const [trashLoaded, setTrashLoaded] = React.useState(false);

  const saveTimer  = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleRef   = React.useRef<HTMLTextAreaElement>(null);
  const draftContentRef = React.useRef("");

  // Auto-resize title textarea
  React.useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = "auto";
      titleRef.current.style.height = titleRef.current.scrollHeight + "px";
    }
  }, [draftTitle]);

  React.useEffect(() => {
    fetchNotebooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  React.useEffect(() => {
    const close = () => { setNbEmojiPicker(null); setNoteEmojiPicker(false); };
    document.addEventListener("click", close);
    return () => {
      document.removeEventListener("click", close);
      clearTimeout(saveTimer.current);
    };
  }, []);

  // ── API helpers ──
  async function fetchNotebooks() {
    setLoading(true);
    try {
      const qs   = workspaceId ? `?workspaceId=${workspaceId}` : "";
      const res  = await fetch(`/api/meetbook/notebooks${qs}`);
      const data = await res.json();
      setNotebooks(data.notebooks ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function fetchNotes(notebookId: string) {
    if (notesMap[notebookId] !== undefined) return;
    const res  = await fetch(`/api/meetbook/notes?notebookId=${notebookId}`);
    const data = await res.json();
    setNotesMap(prev => ({ ...prev, [notebookId]: data.notes ?? [] }));
  }

  async function apiPatch(url: string, body: object) {
    return fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  async function apiDelete(url: string) { return fetch(url, { method: "DELETE" }); }

  async function createNotebook() {
    const res  = await fetch("/api/meetbook/notebooks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Sin título", emoji: "📓", workspaceId: workspaceId ?? null }),
    });
    const { notebook } = await res.json();
    setNotebooks(prev => [notebook, ...prev]);
    setNotesMap(prev => ({ ...prev, [notebook.id]: [] }));
    setExpanded(prev => new Set([...prev, notebook.id]));
    setRenamingNB({ id: notebook.id, val: "Sin título" });
  }

  async function renameNotebook(id: string, title: string) {
    await apiPatch(`/api/meetbook/notebooks/${id}`, { title });
    setNotebooks(prev => prev.map(nb => nb.id === id ? { ...nb, title } : nb));
  }

  async function changeNbEmoji(id: string, emoji: string) {
    await apiPatch(`/api/meetbook/notebooks/${id}`, { emoji });
    setNotebooks(prev => prev.map(nb => nb.id === id ? { ...nb, emoji } : nb));
  }

  async function trashNotebook(id: string) {
    await apiPatch(`/api/meetbook/notebooks/${id}`, { trash: true });
    setNotebooks(prev => prev.filter(nb => nb.id !== id));
    setNotesMap(prev => { const n = { ...prev }; delete n[id]; return n; });
    setExpanded(prev => { const s = new Set(prev); s.delete(id); return s; });
    if (activeNote?.notebook_id === id) { setActiveNote(null); draftContentRef.current = ""; }
    setTrashLoaded(false);
  }

  async function permanentDeleteNotebook(item: TrashItem) {
    await apiDelete(`/api/meetbook/notebooks/${item.id}`);
    setTrashItems(prev => prev.filter(t => !(t.kind === "notebook" && t.id === item.id)));
  }

  async function restoreNotebook(item: TrashItem) {
    await apiPatch(`/api/meetbook/notebooks/${item.id}`, { trash: false });
    setTrashItems(prev => prev.filter(t => !(t.kind === "notebook" && t.id === item.id)));
    fetchNotebooks();
  }

  function downloadTxt(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename.replace(/[^\w\s.()\-]/g, "_");
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  async function duplicateNotebook(nb: Notebook) {
    const res = await fetch("/api/meetbook/notebooks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `${nb.title} (copia)`, emoji: nb.emoji, workspaceId: workspaceId ?? null }),
    });
    const { notebook: newNb } = await res.json();
    let fetchedNotes: Note[] = notesMap[nb.id] ?? [];
    if (notesMap[nb.id] === undefined) {
      const nr = await fetch(`/api/meetbook/notes?notebookId=${nb.id}`);
      fetchedNotes = (await nr.json()).notes ?? [];
    }
    const newNotes: Note[] = [];
    for (const note of fetchedNotes) {
      const nr = await fetch("/api/meetbook/notes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId: newNb.id, title: note.title, emoji: note.emoji, content: note.content }),
      });
      newNotes.push((await nr.json()).note);
    }
    setNotebooks(prev => [newNb, ...prev]);
    setNotesMap(prev => ({ ...prev, [newNb.id]: newNotes }));
    setExpanded(prev => new Set([...prev, newNb.id]));
  }

  async function exportNotebook(nb: Notebook) {
    let fetchedNotes: Note[] = notesMap[nb.id] ?? [];
    if (notesMap[nb.id] === undefined) {
      const nr = await fetch(`/api/meetbook/notes?notebookId=${nb.id}`);
      fetchedNotes = (await nr.json()).notes ?? [];
    }
    const lines: string[] = [`${nb.emoji} ${nb.title}`, "=".repeat(nb.title.length + 2), ""];
    for (const note of fetchedNotes) {
      lines.push(`${note.emoji} ${note.title}`, "-".repeat(note.title.length + 2), "");
      for (const block of parseBlocks(note.content)) {
        if (block.type === "divider") { lines.push("─".repeat(30)); continue; }
        lines.push(block.content.replace(/<[^>]*>/g, "").trim());
      }
      lines.push("", "");
    }
    downloadTxt(`${nb.title}.txt`, lines.join("\n"));
  }

  async function createNote(notebookId: string) {
    const res = await fetch("/api/meetbook/notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notebookId, title: "Sin título", emoji: "📄" }),
    });
    const { note } = await res.json();
    setNotesMap(prev => ({ ...prev, [notebookId]: [note, ...(prev[notebookId] ?? [])] }));
    openNote(note);
    setMobilePanel("editor");
    setRenamingNote({ id: note.id, val: "Sin título" });
    addNotification({ title: "Nota creada", description: `La nota "${note.title}" se creó correctamente`, type: "note" });
  }

  async function renameNote(noteId: string, notebookId: string, title: string) {
    await apiPatch(`/api/meetbook/notes/${noteId}`, { title });
    setNotesMap(prev => ({
      ...prev,
      [notebookId]: (prev[notebookId] ?? []).map(n => n.id === noteId ? { ...n, title } : n),
    }));
    if (activeNote?.id === noteId) setActiveNote(prev => prev ? { ...prev, title } : prev);
  }

  async function togglePin(note: Note) {
    const next = !note.is_pinned;
    await apiPatch(`/api/meetbook/notes/${note.id}`, { is_pinned: next });
    setNotesMap(prev => ({
      ...prev,
      [note.notebook_id]: (prev[note.notebook_id] ?? []).map(n => n.id === note.id ? { ...n, is_pinned: next } : n),
    }));
    if (activeNote?.id === note.id) setActiveNote(prev => prev ? { ...prev, is_pinned: next } : prev);
  }

  async function trashNote(note: Note) {
    await apiPatch(`/api/meetbook/notes/${note.id}`, { trash: true });
    setNotesMap(prev => ({
      ...prev,
      [note.notebook_id]: (prev[note.notebook_id] ?? []).filter(n => n.id !== note.id),
    }));
    if (activeNote?.id === note.id) { setActiveNote(null); draftContentRef.current = ""; }
    setTrashLoaded(false);
  }

  async function permanentDeleteNote(item: TrashItem) {
    await apiDelete(`/api/meetbook/notes/${item.id}`);
    setTrashItems(prev => prev.filter(t => !(t.kind === "note" && t.id === item.id)));
  }

  async function restoreNote(item: TrashItem) {
    await apiPatch(`/api/meetbook/notes/${item.id}`, { trash: false });
    setTrashItems(prev => prev.filter(t => !(t.kind === "note" && t.id === item.id)));
    if (item.notebook_id) setNotesMap(prev => { const n = { ...prev }; delete n[item.notebook_id!]; return n; });
  }

  async function duplicateNote(note: Note) {
    const res = await fetch("/api/meetbook/notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notebookId: note.notebook_id, title: `${note.title} (copia)`, emoji: note.emoji, content: note.content }),
    });
    const { note: newNote } = await res.json();
    setNotesMap(prev => ({ ...prev, [note.notebook_id]: [newNote, ...(prev[note.notebook_id] ?? [])] }));
  }

  function exportNote(note: Note) {
    const lines: string[] = [`${note.emoji} ${note.title}`, "=".repeat(note.title.length + 2), ""];
    let numCounter = 0;
    for (const block of parseBlocks(note.content)) {
      const text = block.content.replace(/<[^>]*>/g, "").trim();
      if (block.type === "divider") { lines.push("─".repeat(40)); numCounter = 0; continue; }
      if (block.type === "numbered") numCounter++; else numCounter = 0;
      const prefix =
        block.type === "h1" ? "# " : block.type === "h2" ? "## " : block.type === "h3" ? "### " :
        block.type === "bullet" ? "• " : block.type === "numbered" ? `${numCounter}. ` :
        block.type === "quote" ? "> " : block.type === "toggle" ? "▸ " : "";
      lines.push(`${prefix}${text}`);
    }
    downloadTxt(`${note.title}.txt`, lines.join("\n"));
  }

  async function loadTrash() {
    const res = await fetch("/api/meetbook/trash");
    const data = await res.json();
    const items: TrashItem[] = [
      ...(data.notebooks ?? []).map((nb: Notebook & { deleted_at: string }) => ({
        kind: "notebook" as const, id: nb.id, title: nb.title, emoji: nb.emoji, deleted_at: nb.deleted_at,
      })),
      ...(data.notes ?? []).map((n: Note & { deleted_at: string; notebook_title?: string }) => ({
        kind: "note" as const, id: n.id, title: n.title, emoji: n.emoji, deleted_at: n.deleted_at,
        notebook_id: n.notebook_id, notebook_title: n.notebook_title,
      })),
    ];
    items.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
    setTrashItems(items);
    setTrashLoaded(true);
  }

  async function changeNoteEmoji(noteId: string, notebookId: string, emoji: string) {
    await apiPatch(`/api/meetbook/notes/${noteId}`, { emoji });
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
    draftContentRef.current = note.content;
    setSaveState("idle");
    setSavedAt(note.updated_at);
    setWordCount(blockWordCount(parseBlocks(note.content)));
  }

  function scheduleAutoSave(noteId: string, title: string, content: string) {
    setSaveState("idle");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(noteId, title, content), 1200);
  }

  async function doSave(noteId: string, title: string, content: string) {
    setSaveState("saving");
    const res = await apiPatch(`/api/meetbook/notes/${noteId}`, { title, content });
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
    if (activeNote) scheduleAutoSave(activeNote.id, val, draftContentRef.current);
  }

  function handleBlocksChange(content: string) {
    draftContentRef.current = content;
    setWordCount(blockWordCount(parseBlocks(content)));
    if (activeNote) scheduleAutoSave(activeNote.id, draftTitle, content);
  }

  function toggleNotebook(nb: Notebook) {
    const isOpen = expanded.has(nb.id);
    setExpanded(prev => { const s = new Set(prev); isOpen ? s.delete(nb.id) : s.add(nb.id); return s; });
    if (!isOpen && notesMap[nb.id] === undefined) fetchNotes(nb.id);
  }

  const activeNB = notebooks.find(nb => nb.id === activeNote?.notebook_id);

  // ── Skeleton ──
  if (loading) {
    return (
      <div className="flex h-full animate-pulse">
        <div className="w-72 border-r border-slate-100 p-4 space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-9 bg-slate-100 rounded-xl" />)}
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
      "w-full lg:w-72 lg:shrink-0",
      mobilePanel === "editor" ? "hidden lg:flex" : "flex",
    )}>
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <BookMarked className="w-5 h-5 text-[#050040]" />
          <span className="text-base font-semibold text-[#050040]">MeetBook</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); createNotebook(); }}
          title="Nuevo cuaderno"
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-[#050040]"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {notebooks.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Sin cuadernos aún</p>
            <button onClick={createNotebook} className="mt-3 text-sm font-semibold text-[#050040] hover:underline">
              Crear el primero
            </button>
          </div>
        ) : notebooks.map((nb) => {
          const isOpen  = expanded.has(nb.id);
          const nbNotes = notesMap[nb.id] ?? [];
          return (
            <div key={nb.id}>
              <div className="group flex items-center gap-1.5 px-3 py-2 mx-1 rounded-xl cursor-pointer transition-colors hover:bg-slate-50">
                <button onClick={() => toggleNotebook(nb)} className="p-0.5 rounded transition-colors shrink-0">
                  {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>
                <div className="relative shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setNbEmojiPicker(nbEmojiPicker === nb.id ? null : nb.id); }}
                    className="text-lg leading-none hover:scale-110 transition-transform"
                  >
                    {nb.emoji}
                  </button>
                  {nbEmojiPicker === nb.id && (
                    <EmojiPicker emojis={NB_EMOJIS} onSelect={(e) => changeNbEmoji(nb.id, e)} onClose={() => setNbEmojiPicker(null)} />
                  )}
                </div>
                {renamingNB?.id === nb.id ? (
                  <input
                    autoFocus value={renamingNB.val}
                    onChange={(e) => setRenamingNB({ id: nb.id, val: e.target.value })}
                    onBlur={() => { renameNotebook(nb.id, renamingNB.val || "Sin título"); setRenamingNB(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { renameNotebook(nb.id, renamingNB.val || "Sin título"); setRenamingNB(null); } }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 text-sm font-medium bg-white border border-[#050040]/30 rounded-lg px-2 py-0.5 outline-none"
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => { e.stopPropagation(); setRenamingNB({ id: nb.id, val: nb.title }); }}
                    onClick={() => toggleNotebook(nb)}
                    className="flex-1 min-w-0 text-sm font-medium text-slate-700 truncate"
                  >
                    {nb.title}
                  </span>
                )}
                {notesMap[nb.id] !== undefined && (
                  <span className="text-xs text-slate-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {nbNotes.length}
                  </span>
                )}
                <div className="shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setMenu({ kind: "nb", id: nb.id, nb, x: r.right, y: r.bottom });
                    }}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-200"
                  >
                    <MoreHorizontal className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="ml-8 pl-2 border-l border-slate-100">
                  <button onClick={() => createNote(nb.id)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-[#050040] hover:bg-slate-50 rounded-lg transition-colors">
                    <Plus className="w-3.5 h-3.5" />Nueva nota
                  </button>
                  {nbNotes.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-slate-400 italic">Sin notas</p>
                  ) : nbNotes.map((note) => {
                    const isActive = activeNote?.id === note.id;
                    return (
                      <div key={note.id} className={cn("group flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer transition-colors", isActive ? "bg-[#050040] text-white" : "hover:bg-slate-50")}>
                        <span className="text-base shrink-0 leading-none">{note.emoji}</span>
                        {renamingNote?.id === note.id ? (
                          <input
                            autoFocus value={renamingNote.val}
                            onChange={(e) => setRenamingNote({ id: note.id, val: e.target.value })}
                            onBlur={() => { renameNote(note.id, nb.id, renamingNote.val || "Sin título"); setRenamingNote(null); }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { renameNote(note.id, nb.id, renamingNote.val || "Sin título"); setRenamingNote(null); } }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 min-w-0 text-xs bg-white border border-[#050040]/30 rounded-lg px-2 py-0.5 outline-none text-slate-800"
                          />
                        ) : (
                          <span
                            onClick={() => { openNote(note); setMobilePanel("editor"); }}
                            onDoubleClick={(e) => { e.stopPropagation(); setRenamingNote({ id: note.id, val: note.title }); }}
                            className={cn("flex-1 min-w-0 text-xs font-medium truncate", isActive ? "text-white" : "text-slate-600")}
                          >
                            {note.is_pinned && <Pin className="w-3 h-3 inline mr-1 opacity-60" />}
                            {note.title}
                          </span>
                        )}
                        <div className="shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setMenu({ kind: "note", id: note.id, note, nbId: nb.id, x: r.right, y: r.bottom });
                            }}
                            className={cn("p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity", isActive ? "hover:bg-white/20" : "hover:bg-slate-200")}
                          >
                            <MoreHorizontal className={cn("w-4 h-4", isActive ? "text-white" : "text-slate-400")} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Papelera ── */}
      <div className="border-t border-slate-100 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!trashOpen && !trashLoaded) loadTrash();
            setTrashOpen(v => !v);
          }}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
        >
          {trashOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          <Trash2 className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left">Papelera</span>
          {trashLoaded && trashItems.length > 0 && (
            <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{trashItems.length}</span>
          )}
        </button>

        {trashOpen && (
          <div className="pb-2 max-h-64 overflow-y-auto">
            {!trashLoaded ? (
              <p className="px-4 py-3 text-sm text-slate-400 text-center">Cargando…</p>
            ) : trashItems.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-400 text-center">Papelera vacía</p>
            ) : trashItems.map(item => (
              <div
                key={`${item.kind}-${item.id}`}
                className="group flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-base shrink-0 opacity-60">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 truncate line-through">{item.title}</p>
                  <p className="text-[10px] text-slate-400">
                    {item.kind === "note" ? (item.notebook_title ?? "Nota") : "Cuaderno"}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    title="Restaurar"
                    onClick={() => item.kind === "note" ? restoreNote(item) : restoreNotebook(item)}
                    className="p-1 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title="Eliminar definitivamente"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar "${item.title}" para siempre? No se puede deshacer.`)) {
                        item.kind === "note" ? permanentDeleteNote(item) : permanentDeleteNotebook(item);
                      }
                    }}
                    className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );

  // ── Editor area ──
  const editor = (
    <div className={cn("flex-1 flex flex-col min-w-0 bg-white", mobilePanel === "list" ? "hidden lg:flex" : "flex")}>
      {activeNote ? (
        <>
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => setMobilePanel("list")} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0">
                <ArrowLeft className="w-5 h-5 text-slate-500" />
              </button>
              <span className="text-sm text-slate-400 truncate hidden sm:block">{activeNB?.emoji} {activeNB?.title}</span>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 hidden sm:block" />
              <span className="text-sm font-medium text-slate-600 truncate">{activeNote.emoji} {draftTitle || "Sin título"}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={cn("text-sm transition-all flex items-center gap-1",
                saveState === "saving" ? "text-slate-400" :
                saveState === "saved"  ? "text-green-600" : "text-slate-300"
              )}>
                {saveState === "saving" && "Guardando…"}
                {saveState === "saved"  && <><Check className="w-3.5 h-3.5" />Guardado {savedAt ? relTime(savedAt) : ""}</>}
                {saveState === "idle" && savedAt && `Editado ${relTime(savedAt)}`}
              </span>
              <span className="text-sm text-slate-300 hidden sm:block">{wordCount} palabras</span>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-6 sm:px-12 py-14">

              {/* Emoji + Title */}
              <div className="flex items-start gap-3 mb-2 pl-16">
                <div className="relative mt-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setNoteEmojiPicker(!noteEmojiPicker); }}
                    className="text-6xl leading-none hover:scale-105 transition-transform select-none"
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
              </div>

              <div className="pl-16 mb-1">
                <textarea
                  ref={titleRef}
                  value={draftTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Sin título"
                  rows={1}
                  className="w-full text-5xl font-bold text-slate-800 bg-transparent outline-none resize-none placeholder:text-slate-200 leading-tight overflow-hidden"
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                />
              </div>

              <div className="flex items-center gap-3 mb-10 pl-16">
                <span className="text-sm text-slate-400">
                  {new Date(activeNote.created_at).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}
                </span>
                {activeNote.is_pinned && (
                  <span className="flex items-center gap-1 text-sm text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                    <Pin className="w-3.5 h-3.5" />Anclada
                  </span>
                )}
              </div>

              {/* Block editor – keyed by note id so it remounts on note switch */}
              <BlockEditor
                key={activeNote.id}
                initialContent={activeNote.content}
                onChange={handleBlocksChange}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-20 h-20 rounded-2xl bg-[#050040]/8 flex items-center justify-center mb-5">
            <FileText className="w-9 h-9 text-[#050040]" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Ninguna nota seleccionada</h3>
          <p className="text-base text-slate-400 max-w-xs">Selecciona una nota del panel izquierdo o crea una nueva</p>
          {notebooks.length > 0 && (
            <button
              onClick={() => createNote(notebooks[0].id)}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-[#050040] text-white rounded-xl text-base font-semibold hover:bg-[#050040]/90 transition"
            >
              <Plus className="w-5 h-5" />Nueva nota
            </button>
          )}
          <button onClick={() => setMobilePanel("list")} className="lg:hidden mt-3 text-sm text-[#050040] font-semibold hover:underline flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />Ver cuadernos
          </button>
        </div>
      )}
    </div>
  );

  // ── Fixed context menu (outside overflow containers) ──────────────────────────
  const contextMenu = menu && (
    <>
      {/* Backdrop — cierra el menú al hacer clic fuera */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        onClick={() => setMenu(null)}
      />
      <div
        style={{ position: "fixed", top: menu.y + 4, left: menu.x, transform: "translateX(-100%)", zIndex: 9999 }}
        className="bg-white rounded-xl shadow-2xl border border-slate-100 py-1.5 min-w-[210px]"
        onClick={(e) => e.stopPropagation()}
      >
      {menu.kind === "nb" ? (
        <>
          <button onClick={() => { createNote(menu.nb.id); setMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            <Plus className="w-4 h-4" />Nueva nota
          </button>
          <button onClick={() => { setRenamingNB({ id: menu.nb.id, val: menu.nb.title }); setMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            <Type className="w-4 h-4" />Renombrar
          </button>
          <button onClick={() => { duplicateNotebook(menu.nb); setMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            <Copy className="w-4 h-4" />Duplicar
          </button>
          <button onClick={() => { exportNotebook(menu.nb); setMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            <Download className="w-4 h-4" />Exportar .txt
          </button>
          <div className="border-t border-slate-100 my-1" />
          <button onClick={() => { trashNotebook(menu.nb.id); setMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50">
            <Trash2 className="w-4 h-4" />Mover a papelera
          </button>
        </>
      ) : (
        <>
          <button onClick={() => { togglePin(menu.note); setMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            {menu.note.is_pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            {menu.note.is_pinned ? "Desanclar" : "Anclar"}
          </button>
          <button onClick={() => { setRenamingNote({ id: menu.note.id, val: menu.note.title }); setMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            <Type className="w-4 h-4" />Renombrar
          </button>
          <button onClick={() => { duplicateNote(menu.note); setMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            <Copy className="w-4 h-4" />Duplicar
          </button>
          <button onClick={() => { exportNote(menu.note); setMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            <Download className="w-4 h-4" />Exportar .txt
          </button>
          <div className="border-t border-slate-100 my-1" />
          <button onClick={() => { trashNote(menu.note); setMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50">
            <Trash2 className="w-4 h-4" />Mover a papelera
          </button>
        </>
      )}
    </div>
    </>
  );

  return (
    <div className="flex h-full">
      {sidebar}
      {editor}
      {contextMenu}
    </div>
  );
}
