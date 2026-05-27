import { auth } from "@/../auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/auth");

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <svg width="24" height="31" viewBox="0 0 31 40" fill="none">
            <path d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585"
              stroke="#050040" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xl font-semibold tracking-tight text-[#050040]">MeetBox</span>
        </div>

        {/* Avatar */}
        {session.user?.image && (
          <img
            src={session.user.image}
            alt={session.user.name ?? ""}
            className="w-16 h-16 rounded-full mx-auto mb-4 border-2 border-slate-100"
          />
        )}

        <div className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1 mb-4">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs font-semibold text-green-700">Sesión activa</span>
        </div>

        <h1 className="text-2xl font-semibold text-[#050040] mb-1">
          ¡Bienvenido{session.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}!
        </h1>
        <p className="text-slate-500 text-sm mb-6">{session.user?.email}</p>

        <div className="bg-slate-50 rounded-xl p-4 text-left mb-6 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Sesión</p>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Nombre</span>
            <span className="font-medium text-[#050040]">{session.user?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Email</span>
            <span className="font-medium text-[#050040]">{session.user?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">ID</span>
            <span className="font-mono text-xs text-slate-400 truncate max-w-[180px]">{session.user?.id}</span>
          </div>
        </div>

        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
