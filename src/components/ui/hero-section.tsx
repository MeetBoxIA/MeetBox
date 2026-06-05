'use client';

import React from 'react';
import SplitText from './split-text';

export default function HeroSection() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    function onClickOutside(e: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target as Node)) return;
      setMenuOpen(false);
    }
    if (menuOpen) {
      document.addEventListener('keydown', onKey);
      document.addEventListener('click', onClickOutside);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClickOutside);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');
        * { font-family: 'Poppins', sans-serif; }
      `}</style>

      <section className="bg-[url('https://raw.githubusercontent.com/prebuiltui/prebuiltui/main/assets/hero/gridBackground.png')] w-full min-h-screen bg-no-repeat bg-cover bg-center text-sm pb-44">
        <nav className="flex items-center justify-between p-4 md:px-16 lg:px-24 xl:px-32 md:py-6 w-full">
          <a href="#" aria-label="MeetBox home" className="flex items-center gap-2">
            <svg width="31" height="40" viewBox="0 0 31 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585" stroke="#050040" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xl font-semibold tracking-tight text-[#050040]">MeetBox</span>
          </a>

          <div
            ref={menuRef}
            className={[
              'max-md:absolute max-md:top-0 max-md:left-0 max-md:transition-all max-md:duration-300 max-md:overflow-hidden max-md:h-full max-md:bg-white/50 max-md:backdrop-blur',
              'flex items-center gap-8 font-medium',
              'max-md:flex-col max-md:justify-center',
              menuOpen ? 'max-md:w-full' : 'max-md:w-0',
            ].join(' ')}
            aria-hidden={!menuOpen}
          >
            <a href="#como-funciona" className="hover:text-gray-600">Cómo funciona</a>
            <a href="#integraciones" className="hover:text-gray-600">Integraciones</a>
            <a href="#precios" className="hover:text-gray-600">Precios</a>

            <button
              onClick={() => setMenuOpen(false)}
              className="md:hidden bg-gray-800 hover:bg-black text-white p-2 rounded-md aspect-square font-medium transition"
              aria-label="Cerrar menú"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <a
              href="/auth?tab=sign-up"
              className="border border-slate-300 hover:border-slate-400 text-[#050040] px-5 py-2.5 rounded-full text-sm font-medium transition"
            >
              ¿Ya tienes el tuyo?
            </a>
            <button className="bg-[#050040] hover:bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-medium transition">
              Reserva el tuyo
            </button>
          </div>

          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden bg-gray-800 hover:bg-black text-white p-2 rounded-md aspect-square font-medium transition"
            aria-label="Abrir menú"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12h16" /><path d="M4 18h16" /><path d="M4 6h16" />
            </svg>
          </button>
        </nav>

        <div className="flex items-center gap-2 border border-slate-300 hover:border-slate-400/70 rounded-full w-max mx-auto px-4 py-2 mt-40 md:mt-32">
          <span className="text-xs font-medium text-[#050040]">Nuevo · Lanzamiento para LATAM</span>
          <button className="flex items-center gap-1 font-semibold text-xs text-[#050040]">
            <span>Ver más</span>
            <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M3.959 9.5h11.083m0 0L9.501 3.958M15.042 9.5l-5.541 5.54" stroke="#050040" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col items-center mt-8 px-4">
          <SplitText
            tag="h1"
            text="Presencial o virtual."
            className="text-4xl md:text-7xl font-medium text-[#050040] text-center"
            delay={60}
            duration={0.8}
            ease="power3.out"
            splitType="chars"
            from={{ opacity: 0, y: 50 }}
            to={{ opacity: 1, y: 0 }}
            threshold={0}
            rootMargin="0px"
            textAlign="center"
          />
          <SplitText
            tag="h1"
            text="Sin perder un acuerdo."
            className="text-4xl md:text-7xl font-medium text-[#050040] text-center mt-2"
            delay={60}
            duration={0.8}
            ease="power3.out"
            splitType="chars"
            from={{ opacity: 0, y: 50 }}
            to={{ opacity: 1, y: 0 }}
            threshold={0}
            rootMargin="0px"
            textAlign="center"
          />
        </div>

        <p className="text-sm md:text-base mx-auto max-w-2xl text-center mt-6 max-md:px-4 text-slate-600">
          MeetBox Hardware para salas presenciales. MeetBox Desktop para videollamadas.
          El mismo backend, la misma IA, el mismo resumen en menos de 60 segundos.
        </p>

        {/* Two-product badges */}
        <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
          <span className="inline-flex items-center gap-2 border border-slate-300 rounded-full px-4 py-1.5 text-xs font-medium text-slate-700 bg-white/60">
            <span className="w-2 h-2 rounded-full bg-[#050040]" />
            Dispositivo — sala presencial
          </span>
          <span className="text-slate-300 text-sm">+</span>
          <span className="inline-flex items-center gap-2 border border-slate-300 rounded-full px-4 py-1.5 text-xs font-medium text-slate-700 bg-white/60">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Desktop — Zoom, Meet, Teams
          </span>
        </div>

        <div className="mx-auto w-full flex flex-col sm:flex-row items-center justify-center gap-3 mt-8 px-4">
<button
  onClick={() => {
    document
      .getElementById("productos")
      ?.scrollIntoView({ behavior: "smooth" });
  }}
  className="bg-[#050040] hover:bg-slate-900 text-white px-8 py-3.5 rounded-full font-medium transition text-sm"
>
  Ver los productos
</button>
          <a
            href="/auth?tab=sign-up"
            className="inline-flex items-center gap-2 border border-slate-300 hover:bg-slate-200/30 rounded-full px-6 py-3.5 text-sm transition"
          >
            ¿Ya tienes el tuyo? Actívalo
            <svg width="6" height="8" viewBox="0 0 6 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M1.25.5 4.75 4l-3.5 3.5" stroke="#050040" strokeOpacity=".4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </section>
    </>
  );
}
