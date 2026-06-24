"use client";
import * as React from "react";

// ── Inline renderer (bold, italic, code, links) ──────────────────────────────
// Order matters: **bold** must match before *italic*.
const INLINE_RE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\n]+\)|\*[^*\n]+\*)/g;

function renderInline(text: string, keyPrefix = ""): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${k++}`;

    if (tok.startsWith("**")) {
      out.push(<strong key={key} className="font-bold text-slate-900">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      out.push(<code key={key} className="bg-slate-100 text-[#050040] px-1.5 py-0.5 rounded text-[0.88em] font-mono">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("[")) {
      const close = tok.indexOf("]");
      const url   = tok.slice(close + 2, -1);
      out.push(
        <a key={key} href={url} target="_blank" rel="noopener noreferrer"
          className="text-[#050040] underline underline-offset-2 hover:no-underline">
          {tok.slice(1, close)}
        </a>,
      );
    } else if (tok.startsWith("*")) {
      out.push(<em key={key} className="italic">{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// ── Block renderer (headings, lists, code blocks, paragraphs) ───────────────
function isBullet(line: string)  { return /^\s*[-•]\s/.test(line); }
function isNumber(line: string)  { return /^\s*\d+\.\s/.test(line); }
function isHeading(line: string) { return /^#{1,3}\s/.test(line); }

export function ChatMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith("```")) {
      const fenceEnd = lines.findIndex((l, idx) => idx > i && l.trim().startsWith("```"));
      if (fenceEnd > i) {
        blocks.push(
          <pre key={`b${k++}`} className="bg-slate-50 border border-slate-100 rounded-xl p-3 my-2 overflow-x-auto">
            <code className="text-[13px] font-mono text-slate-800 whitespace-pre">
              {lines.slice(i + 1, fenceEnd).join("\n")}
            </code>
          </pre>,
        );
        i = fenceEnd + 1;
        continue;
      }
    }

    // Headings
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={`b${k++}`} className="text-base font-bold text-slate-900 mt-3 mb-1.5">{renderInline(line.slice(4), `b${k}`)}</h3>);
      i++; continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(<h2 key={`b${k++}`} className="text-lg font-bold text-slate-900 mt-3 mb-1.5">{renderInline(line.slice(3), `b${k}`)}</h2>);
      i++; continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(<h1 key={`b${k++}`} className="text-xl font-bold text-slate-900 mt-3 mb-1.5">{renderInline(line.slice(2), `b${k}`)}</h1>);
      i++; continue;
    }

    // Bullet list
    if (isBullet(line)) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i])) {
        items.push(lines[i].replace(/^\s*[-•]\s/, ""));
        i++;
      }
      blocks.push(
        <ul key={`b${k++}`} className="list-disc pl-5 space-y-1 my-2 marker:text-slate-400">
          {items.map((it, j) => <li key={j} className="leading-relaxed">{renderInline(it, `b${k}-${j}`)}</li>)}
        </ul>,
      );
      continue;
    }

    // Numbered list
    if (isNumber(line)) {
      const items: string[] = [];
      while (i < lines.length && isNumber(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s/, ""));
        i++;
      }
      blocks.push(
        <ol key={`b${k++}`} className="list-decimal pl-5 space-y-1 my-2 marker:text-slate-400">
          {items.map((it, j) => <li key={j} className="leading-relaxed">{renderInline(it, `b${k}-${j}`)}</li>)}
        </ol>,
      );
      continue;
    }

    // Blank line → spacing
    if (line.trim() === "") { i++; continue; }

    // Paragraph (collect contiguous non-special lines)
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== ""
        && !isBullet(lines[i]) && !isNumber(lines[i]) && !isHeading(lines[i])
        && !lines[i].trim().startsWith("```")) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`b${k++}`} className="leading-relaxed whitespace-pre-wrap">
        {renderInline(para.join("\n"), `b${k}`)}
      </p>,
    );
  }

  return <div className="space-y-2 text-[15px] text-slate-800">{blocks}</div>;
}
