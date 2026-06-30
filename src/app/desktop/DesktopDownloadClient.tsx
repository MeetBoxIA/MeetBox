'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Monitor, Download } from 'lucide-react';

const VERSION = '1.0.0';

type DownloadOS = 'windows' | 'mac' | 'linux';

const PLATFORMS: {
  key: DownloadOS;
  label: string;
  sublabel: string;
  emoji: string;
  file: string;
}[] = [
  {
    key: 'windows',
    label: 'Windows',
    sublabel: 'Windows 10 o superior',
    emoji: '🪟',
    file: `MeetBox Desktop Setup ${VERSION}.exe`,
  },
  {
    key: 'mac',
    label: 'macOS',
    sublabel: 'macOS 11 Big Sur o superior',
    emoji: '🍎',
    file: `MeetBox Desktop-${VERSION}-arm64.dmg`,
  },
  {
    key: 'linux',
    label: 'Linux',
    sublabel: 'Ubuntu 20.04+, Debian, Arch',
    emoji: '🐧',
    file: `MeetBox Desktop-${VERSION}.AppImage`,
  },
];

function detectPrimary(os: string): DownloadOS {
  if (os === 'mac') return 'mac';
  if (os === 'linux') return 'linux';
  return 'windows';
}

export default function DesktopDownloadClient({ os }: { os: string }) {
  const primaryOS = detectPrimary(os);
  const [downloading, setDownloading] = useState<DownloadOS | null>(null);
  const [notice, setNotice] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  async function handleDownload(platform: DownloadOS, fileName: string) {
    setDownloading(platform);
    setNotice(null);

    try {
      const res = await fetch(`/api/desktop/download?os=${platform}`);

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setNotice({ type: 'info', text: '¡Descarga iniciada! Revisa tu carpeta de descargas.' });
      } else if (res.status === 503) {
        setNotice({
          type: 'info',
          text: 'El instalador estará disponible muy pronto. Vuelve en unos días.',
        });
      } else {
        setNotice({ type: 'error', text: 'No se pudo descargar. Intenta de nuevo.' });
      }
    } catch {
      setNotice({ type: 'error', text: 'Error de conexión. Intenta de nuevo.' });
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#050040] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center group-hover:bg-white/15 transition-colors">
            <Monitor className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-base">MeetBox</span>
        </Link>
        <Link
          href="/auth"
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          Iniciar sesión →
        </Link>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        {/* Icon */}
        <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center mb-8 ring-1 ring-white/10">
          <Monitor className="w-12 h-12 text-white" />
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
          MeetBox Desktop
        </h1>
        <p className="text-white/50 text-lg max-w-md mb-12">
          Graba el audio de tus videollamadas sin bots. Compatible con Zoom, Google Meet y Microsoft Teams.
        </p>

        {/* Download buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl mb-4">
          {PLATFORMS.map((p) => {
            const isPrimary = p.key === primaryOS;
            const isLoading = downloading === p.key;
            return (
              <button
                key={p.key}
                onClick={() => handleDownload(p.key, p.file)}
                disabled={!!downloading}
                className={`flex flex-col items-center gap-2 px-5 py-5 rounded-2xl border transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isPrimary
                    ? 'bg-white text-[#050040] border-transparent hover:bg-white/90 shadow-lg shadow-white/10'
                    : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                }`}
              >
                <span className="text-2xl">{p.emoji}</span>
                <span className="font-bold text-sm">{p.label}</span>
                <span
                  className={`text-[11px] ${isPrimary ? 'text-[#050040]/50' : 'text-white/30'}`}
                >
                  {p.sublabel}
                </span>
                {isPrimary && (
                  <span className="text-[10px] font-semibold bg-[#050040]/10 text-[#050040]/70 px-2.5 py-0.5 rounded-full mt-0.5">
                    {isLoading ? 'Descargando…' : 'Recomendado'}
                  </span>
                )}
                {!isPrimary && isLoading && (
                  <span className="text-[10px] text-white/40">Descargando…</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notice */}
        {notice && (
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm max-w-sm mb-4 ${
              notice.type === 'error'
                ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
            }`}
          >
            {notice.text}
          </div>
        )}

        <p className="text-white/20 text-xs mb-14">
          Versión {VERSION} · Auto-actualización incluida · Gratis con tu plan
        </p>

        {/* Features grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl w-full">
          {[
            { icon: '🎙️', label: 'Sin bots', desc: 'Captura audio localmente' },
            { icon: '🔗', label: 'Zoom, Meet, Teams', desc: 'Funciona con los 3' },
            { icon: '🔄', label: 'Auto-actualización', desc: 'Siempre al día' },
            { icon: '☁️', label: 'Sincronizado', desc: 'Con tu cuenta MeetBox' },
          ].map((f) => (
            <div
              key={f.label}
              className="bg-white/5 border border-white/5 rounded-xl p-4 text-left"
            >
              <span className="text-xl">{f.icon}</span>
              <p className="text-white text-xs font-semibold mt-2">{f.label}</p>
              <p className="text-white/30 text-[11px] mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center py-5 text-white/15 text-xs border-t border-white/5">
        © {new Date().getFullYear()} MeetBox ·{' '}
        <Link href="/auth" className="hover:text-white/30 transition-colors">
          Acceder a la app web
        </Link>
      </footer>
    </div>
  );
}
