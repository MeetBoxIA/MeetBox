"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { OTPInput, SlotProps } from "input-otp";
import { Loader2, ShieldCheck, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VerifyClient({ email, callbackUrl }: { email: string; callbackUrl?: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [status, setStatus] = React.useState<"sending" | "idle" | "loading" | "send-error" | "verify-error" | "success">("sending");
  const [sendError, setSendError] = React.useState("");
  const [verifyError, setVerifyError] = React.useState("");
  const [locked, setLocked] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [devMode, setDevMode] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Enviar OTP automáticamente al cargar
  React.useEffect(() => {
    sendOTP();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendOTP() {
    setStatus("sending");
    setSendError("");
    setVerifyError("");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.dev) setDevMode(true);
        setLocked(false);
        setStatus("idle");
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        console.error("OTP error:", data.error);
        setSendError(data.error ?? "No se pudo enviar el código.");
        setStatus("send-error");
      }
    } catch {
      clearTimeout(timer);
      setSendError("No se pudo enviar el código. Revisa tu conexión e intenta de nuevo.");
      setStatus("send-error");
    }
  }

  async function onComplete(code: string) {
    if (locked) return;
    setStatus("loading");
    setVerifyError("");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("success");
        setTimeout(() => router.push(callbackUrl ?? "/dashboard"), 900);
      } else {
        const isLocked = Boolean(data.locked);
        setLocked(isLocked);
        setVerifyError(data.error ?? "No se pudo verificar el código. Inténtalo de nuevo.");
        setStatus("verify-error");
        setValue("");
        if (!isLocked) {
          setTimeout(() => { setStatus("idle"); inputRef.current?.focus(); }, 1500);
        }
      }
    } catch {
      setVerifyError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
      setStatus("verify-error");
      setValue("");
    }
  }

  async function resend() {
    setResending(true);
    setValue("");
    await sendOTP();
    setResending(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <svg width="22" height="28" viewBox="0 0 31 40" fill="none">
            <path d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585"
              stroke="#050040" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-lg font-semibold tracking-tight text-[#050040]">MeetBox</span>
        </div>

        {/* ── Enviando ── */}
        {status === "sending" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#050040]" />
            <p className="text-sm text-slate-500 text-center">
              Enviando código a <span className="font-medium text-slate-700">{email}</span>…
            </p>
          </div>
        )}

        {/* ── Error al enviar ── */}
        {status === "send-error" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-sm text-red-500" role="alert" aria-live="polite">
              {sendError || "No se pudo enviar el código."}
            </p>
            <button
              onClick={resend}
              className="text-sm font-semibold text-[#050040] hover:underline"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* ── Ingresa el código ── */}
        {(status === "idle" || status === "loading" || status === "verify-error") && (
          <>
            <div className="text-center mb-7">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#050040]/10 mb-4">
                <svg width="20" height="26" viewBox="0 0 31 40" fill="none">
                  <path d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585"
                    stroke="#050040" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-[#050040]">Verifica tu identidad</h1>
              <p className="text-sm text-slate-500 mt-1.5">
                Ingresa el código de 4 dígitos enviado a{" "}
                <span className="font-medium text-slate-700">{email}</span>
              </p>
              {devMode && (
                <div className="mt-3 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span className="text-xs font-semibold text-amber-700">DEV — revisa la terminal del servidor para ver el código</span>
                </div>
              )}
            </div>

            {/* OTP slots */}
            <div className="flex justify-center mb-5">
              <OTPInput
                ref={inputRef}
                value={value}
                onChange={setValue}
                maxLength={4}
                disabled={status === "loading" || locked}
                containerClassName="flex items-center has-[:disabled]:opacity-50"
                onFocus={() => { if (status === "verify-error" && !locked) setStatus("idle"); }}
                render={({ slots }) => (
                  <div className="flex gap-3">
                    {slots.map((slot, i) => (
                      <OtpSlot key={i} {...slot} hasError={status === "verify-error"} />
                    ))}
                  </div>
                )}
                onComplete={onComplete}
              />
            </div>

            {status === "loading" && (
              <div className="flex justify-center mb-4">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            )}

            {status === "verify-error" && (
              <p className="text-center text-xs text-red-500 mb-4" role="alert" aria-live="polite">
                {verifyError || "Código incorrecto o expirado. Inténtalo de nuevo."}
              </p>
            )}

            <p className="text-center text-sm text-slate-500">
              ¿No recibiste el código?{" "}
              <button
                onClick={resend}
                disabled={resending}
                className="inline-flex items-center gap-1 font-semibold text-[#050040] hover:underline disabled:opacity-50 transition"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", resending && "animate-spin")} />
                Reenviar
              </button>
            </p>
          </>
        )}

        {/* ── Verificado ── */}
        {status === "success" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-lg font-semibold text-[#050040]">¡Verificado!</p>
            <p className="text-sm text-slate-500">Redirigiendo al dashboard…</p>
            <Loader2 className="w-5 h-5 animate-spin text-slate-400 mt-1" />
          </div>
        )}
      </div>
    </main>
  );
}

function OtpSlot({ char, isActive, hasError }: SlotProps & { hasError?: boolean }) {
  return (
    <div className={cn(
      "flex size-14 items-center justify-center rounded-xl border-2 text-2xl font-bold text-[#050040] transition-all select-none",
      isActive && !hasError && "border-[#050040] ring-4 ring-[#050040]/10 bg-white",
      !isActive && char  && "border-slate-300 bg-white",
      !isActive && !char && "border-slate-200 bg-slate-50",
      hasError           && "border-red-400 bg-red-50 text-red-600",
    )}>
      {char}
    </div>
  );
}
