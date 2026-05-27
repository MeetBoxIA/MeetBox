"use client";

import * as React from "react";
import { OTPInput, SlotProps } from "input-otp";
import { Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface OtpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onVerified: () => void;
}

export function OtpDialog({ open, onOpenChange, email, onVerified }: OtpDialogProps) {
  const [value, setValue] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [resending, setResending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) { setValue(""); setStatus("idle"); }
  }, [open]);

  async function onComplete(code: string) {
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (res.ok) {
        setStatus("success");
        setTimeout(onVerified, 800);
      } else {
        setStatus("error");
        setValue("");
        setTimeout(() => { setStatus("idle"); inputRef.current?.focus(); }, 1500);
      }
    } catch {
      setStatus("error");
      setValue("");
    }
  }

  async function resend() {
    setResending(true);
    await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResending(false);
    setValue("");
    setStatus("idle");
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="px-8 py-8">
        <div className="flex flex-col items-center gap-3 mb-2">
          <div className={cn(
            "flex size-12 items-center justify-center rounded-full transition-colors",
            status === "success" ? "bg-green-100" : "bg-[#050040]/10",
          )}>
            {status === "success"
              ? <ShieldCheck className="w-6 h-6 text-green-600" />
              : (
                <svg width="20" height="26" viewBox="0 0 31 40" fill="none">
                  <path d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585" stroke="#050040" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )
            }
          </div>
          <DialogHeader>
            <DialogTitle className="text-center">
              {status === "success" ? "¡Código verificado!" : "Revisa tu email"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {status === "success"
                ? "Tu cuenta ha sido verificada correctamente."
                : <>Ingresa el código de 4 dígitos enviado a <span className="font-medium text-slate-700">{email}</span></>
              }
            </DialogDescription>
          </DialogHeader>
        </div>

        {status === "success" ? (
          <button
            onClick={() => onOpenChange(false)}
            className="w-full rounded-xl bg-[#050040] py-3 text-sm font-semibold text-white hover:bg-slate-800 transition"
          >
            Continuar
          </button>
        ) : (
          <div className="space-y-5">
            <div className="flex justify-center">
              <OTPInput
                ref={inputRef}
                value={value}
                onChange={setValue}
                maxLength={4}
                disabled={status === "loading"}
                containerClassName="flex items-center gap-3 has-[:disabled]:opacity-50"
                onFocus={() => { if (status === "error") setStatus("idle"); }}
                render={({ slots }) => (
                  <div className="flex gap-3">
                    {slots.map((slot, idx) => (
                      <OtpSlot key={idx} {...slot} hasError={status === "error"} />
                    ))}
                  </div>
                )}
                onComplete={onComplete}
              />
            </div>

            {status === "loading" && (
              <div className="flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            )}
            {status === "error" && (
              <p className="text-center text-xs text-red-500" role="alert" aria-live="polite">
                Código incorrecto o expirado. Inténtalo de nuevo.
              </p>
            )}

            <p className="text-center text-sm text-slate-500">
              ¿No recibiste el código?{" "}
              <button
                onClick={resend}
                disabled={resending}
                className="font-semibold text-[#050040] hover:underline disabled:opacity-50 transition"
              >
                {resending ? "Enviando..." : "Reenviar código"}
              </button>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OtpSlot({ char, isActive, hasError }: SlotProps & { hasError?: boolean }) {
  return (
    <div className={cn(
      "flex size-14 items-center justify-center rounded-xl border-2 text-2xl font-bold text-[#050040] transition-all select-none",
      isActive && !hasError && "border-[#050040] ring-4 ring-[#050040]/10 bg-white",
      !isActive && char && "border-slate-300 bg-white",
      !isActive && !char && "border-slate-200 bg-slate-50",
      hasError && "border-red-400 bg-red-50 text-red-600",
    )}>
      {char}
    </div>
  );
}
