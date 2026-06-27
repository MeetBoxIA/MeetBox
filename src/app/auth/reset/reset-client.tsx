"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, KeyRound, CheckCircle2, AlertCircle } from "lucide-react";

export default function ResetClient() {
  const router       = useRouter();
  const params       = useSearchParams();
  const email        = params.get("email") ?? "";
  const token        = params.get("token") ?? "";

  const [password,  setPassword]  = React.useState("");
  const [confirm,   setConfirm]   = React.useState("");
  const [status,    setStatus]    = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [error,     setError]     = React.useState("");

  const inputClass =
    "w-full mt-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#050040] focus:ring-2 focus:ring-[#050040]/10 transition";

  if (!email || !token) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-slate-700 font-medium">Enlace inválido</p>
        <p className="text-sm text-slate-500">
          El enlace de recuperación no es válido o expiró.
        </p>
        <a href="/auth" className="mt-2 text-sm font-semibold text-[#050040] hover:underline">
          Volver al inicio de sesión
        </a>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setStatus("loading");

    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus("success");
        setTimeout(() => router.push("/auth"), 2500);
      } else {
        setError(data.error ?? "No se pudo actualizar la contraseña.");
        setStatus("error");
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <p className="text-lg font-semibold text-[#050040]">Contraseña actualizada</p>
        <p className="text-sm text-slate-500">Redirigiendo al inicio de sesión…</p>
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2.5 mb-7">
        <div className="w-10 h-10 rounded-full bg-[#050040]/10 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-[#050040]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[#050040]">Nueva contraseña</h1>
          <p className="text-xs text-slate-500">{email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Contraseña nueva</label>
          <input
            className={inputClass}
            type="password"
            placeholder="Mínimo 8 caracteres, 1 mayúscula, 1 número"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); setStatus("idle"); }}
            required
            autoComplete="new-password"
            minLength={8}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Confirmar contraseña</label>
          <input
            className={inputClass}
            type="password"
            placeholder="Repite la contraseña"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(""); setStatus("idle"); }}
            required
            autoComplete="new-password"
          />
        </div>

        {(error || status === "error") && (
          <p className="text-xs text-red-500 text-center -mt-1" role="alert">
            {error || "Error al actualizar la contraseña."}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full py-2.5 rounded-xl bg-[#050040] text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {status === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
          Actualizar contraseña
        </button>

        <a
          href="/auth"
          className="text-center text-xs text-slate-500 hover:text-slate-700 hover:underline transition"
        >
          Volver al inicio de sesión
        </a>
      </form>
    </>
  );
}
