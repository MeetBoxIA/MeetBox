'use client';

import { useEffect, useState } from 'react';

export default function FloatingNav() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 90);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={[
        'fixed top-4 left-0 right-0 z-50 flex justify-center px-4 transition-all duration-300',
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-3 pointer-events-none',
      ].join(' ')}
    >
      <nav className="w-full max-w-3xl bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-lg shadow-black/5 rounded-2xl px-5 py-3 flex items-center justify-between gap-4">

        {/* Logo */}
        <a href="#" className="flex items-center gap-2 flex-shrink-0">
          <svg width="20" height="26" viewBox="0 0 31 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585" stroke="#050040" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-semibold tracking-tight text-[#050040]">MeetBox</span>
        </a>

        {/* Links — hidden on small screens */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a href="#como-funciona" className="hover:text-[#050040] transition">Cómo funciona</a>
          <a href="#integraciones" className="hover:text-[#050040] transition">Integraciones</a>
          <a href="#precios" className="hover:text-[#050040] transition">Precios</a>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href="/auth?tab=sign-up"
            className="hidden sm:inline-flex border border-slate-200 text-[#050040] text-xs font-medium px-4 py-2 rounded-xl hover:bg-slate-50 transition"
          >
            ¿Ya tienes el tuyo?
          </a>
          <button className="bg-[#050040] hover:bg-slate-800 text-white text-xs font-medium px-4 py-2 rounded-xl transition">
            Reserva el tuyo
          </button>
        </div>
      </nav>
    </div>
  );
}
