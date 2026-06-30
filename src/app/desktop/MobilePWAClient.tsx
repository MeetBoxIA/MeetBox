'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Smartphone, Download, Plus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function MobilePWAClient({ os }: { os: string }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const isIOS = os === 'ios';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {});
    }

    // Capture Android/Chrome install prompt
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // Detect install via appinstalled event
    const onInstalled = () => setInstalled(true);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  }

  if (installed) {
    return (
      <div className="min-h-screen bg-[#050040] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center mb-6">
          <Smartphone className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">¡App instalada!</h1>
        <p className="text-white/50 mb-8 text-base">
          MeetBox ya está en tu pantalla de inicio. Ábrela desde ahí.
        </p>
        <Link
          href="/auth"
          className="bg-white text-[#050040] font-bold px-7 py-3.5 rounded-2xl text-sm active:scale-95 transition-transform"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050040] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <span className="text-white font-bold text-base">MeetBox</span>
        <Link href="/auth" className="text-white/40 text-sm hover:text-white transition-colors">
          Iniciar sesión
        </Link>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center px-6 py-10 text-center">
        <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mb-6 ring-1 ring-white/10">
          <Smartphone className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-3">MeetBox en tu móvil</h1>
        <p className="text-white/50 mb-8 max-w-xs text-base leading-relaxed">
          Instala MeetBox como app nativa. Al abrirla vas directo al dashboard — gestiona reuniones, conecta el desktop y más.
        </p>

        {/* Primary CTA (Android Chrome shows the native prompt) */}
        {installPrompt ? (
          <button
            onClick={handleInstall}
            className="flex items-center gap-2.5 bg-white text-[#050040] font-bold px-8 py-4 rounded-2xl text-base mb-8 active:scale-95 transition-transform shadow-lg shadow-white/10"
          >
            <Download className="w-5 h-5" />
            Instalar MeetBox
          </button>
        ) : (
          <div className="w-full max-w-sm mb-8">
            {isIOS ? (
              /* iOS instructions */
              <div className="bg-white/8 border border-white/10 rounded-2xl p-5 text-left space-y-4">
                <p className="text-white text-sm font-semibold">Añadir a pantalla de inicio (Safari)</p>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-white/10 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <p className="text-white/80 text-sm">Toca el botón compartir</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      Ícono <span className="text-base">⬆️</span> en la barra inferior de Safari
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-white/10 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div className="flex items-start gap-2">
                    <Plus className="w-4 h-4 text-white/60 mt-0.5 shrink-0" />
                    <p className="text-white/80 text-sm">
                      Selecciona <span className="font-semibold text-white">"Añadir a pantalla de inicio"</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-white/10 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <p className="text-white/80 text-sm">Toca <span className="font-semibold text-white">"Añadir"</span> en la confirmación</p>
                </div>
              </div>
            ) : (
              /* Android / other browser instructions */
              <div className="bg-white/8 border border-white/10 rounded-2xl p-5 text-left space-y-3">
                <p className="text-white text-sm font-semibold">Instalar desde Chrome</p>
                <p className="text-white/60 text-sm">
                  Abre esta página en Chrome y toca el menú{' '}
                  <span className="font-bold text-white">⋮</span> → "Añadir a pantalla de inicio"
                </p>
                <p className="text-white/30 text-xs">
                  O espera el banner de instalación que aparecerá automáticamente.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
          {[
            { icon: '📅', label: 'Reuniones', desc: 'Gestiona tu agenda' },
            { icon: '🤖', label: 'Meety IA', desc: 'Asistente inteligente' },
            { icon: '📝', label: 'Notas', desc: 'MeetBook integrado' },
            { icon: '🔔', label: 'Alertas', desc: 'Notificaciones push' },
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
          Acceder desde el navegador
        </Link>
      </footer>
    </div>
  );
}
