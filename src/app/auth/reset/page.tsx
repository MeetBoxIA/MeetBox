import { Suspense } from "react";
import ResetClient from "./reset-client";

export default function ResetPage() {
  return (
    <main className="min-h-screen flex">
      {/* Brand panel — mirrors /auth layout */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#050040] relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-2.5">
          <svg width="28" height="36" viewBox="0 0 31 40" fill="none">
            <path d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585"
              stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xl font-semibold tracking-tight text-white">MeetBox</span>
        </div>

        <div className="relative">
          <h1 className="text-3xl font-bold text-white leading-tight">
            Recupera tu acceso
          </h1>
          <p className="text-base text-white/70 mt-3 max-w-md leading-relaxed">
            Crea una nueva contraseña segura para tu cuenta de MeetBox.
          </p>
        </div>

        <div className="relative" />
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 bg-slate-50">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <svg width="24" height="31" viewBox="0 0 31 40" fill="none">
              <path d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585"
                stroke="#050040" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xl font-semibold tracking-tight text-[#050040]">MeetBox</span>
          </div>

          <Suspense>
            <ResetClient />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
