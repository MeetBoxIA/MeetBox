"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OtpDialog } from "@/components/ui/otp-dialog";
import { FaGoogle } from "react-icons/fa";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";

interface AuthTabsCardProps {
  defaultTab?: "sign-in" | "sign-up";
  callbackUrl?: string;
}

export default function AuthTabsCard({ defaultTab = "sign-in", callbackUrl }: AuthTabsCardProps) {
  const [activeTab, setActiveTab] = React.useState<"sign-in" | "sign-up">(defaultTab);
  const [otpOpen, setOtpOpen] = React.useState(false);
  const [pendingEmail, setPendingEmail] = React.useState("");
  const [loading, setLoading] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [signupSuccess, setSignupSuccess] = React.useState(false);

  // Forgot-password panel state
  const [forgotOpen, setForgotOpen] = React.useState(false);
  const [forgotEmail, setForgotEmail] = React.useState("");
  const [forgotStatus, setForgotStatus] = React.useState<"idle" | "loading" | "sent">("idle");
  const [forgotError, setForgotError] = React.useState("");

  // Sign-in form state
  const [siEmail, setSiEmail] = React.useState("");
  const [siPassword, setSiPassword] = React.useState("");

  // Sign-up form state
  const [suName, setSuName] = React.useState("");
  const [suEmail, setSuEmail] = React.useState("");
  const [suPassword, setSuPassword] = React.useState("");

  const inputClass =
    "w-full mt-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#050040] focus:ring-2 focus:ring-[#050040]/10 transition";
  const socialBtn =
    "flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50";

  async function handleOAuth(provider: "google") {
    setLoading(provider);
    setError("");
    const verifyUrl = callbackUrl
      ? `/auth/verify?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/auth/verify";
    await signIn(provider, { callbackUrl: verifyUrl });
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading("signin");
    setError("");
    const res = await signIn("credentials", {
      email: siEmail,
      password: siPassword,
      redirect: false,
    });
    setLoading(null);
    if (res?.error) {
      setError("Email o contraseña incorrectos.");
    } else {
      window.location.href = callbackUrl ?? "/dashboard";
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!suEmail || !suPassword || !suName) {
      setError("Completa todos los campos.");
      return;
    }
    if (suPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!/[A-Z]/.test(suPassword) || !/[0-9]/.test(suPassword)) {
      setError("La contraseña debe incluir al menos una mayúscula y un número.");
      return;
    }
    setLoading("signup");
    setError("");
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: suEmail }),
      });
      if (!res.ok) throw new Error();
      setPendingEmail(suEmail);
      setOtpOpen(true);
    } catch {
      setError("No se pudo enviar el código. Verifica el email e intenta de nuevo.");
    } finally {
      setLoading(null);
    }
  }

  async function onOtpVerified() {
    // Crear usuario en Supabase
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: suName, email: pendingEmail, password: suPassword }),
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: undefined }));
      setOtpOpen(false);
      setActiveTab("sign-up");
      setError(error ?? "Error al crear la cuenta.");
      return;
    }

    // Éxito: cerrar el diálogo OTP, limpiar el formulario de registro y
    // mostrar el panel de confirmación en lugar de iniciar sesión automáticamente.
    setOtpOpen(false);
    setSuName("");
    setSuEmail("");
    setSuPassword("");
    setPendingEmail("");
    setSignupSuccess(true);
  }

  const toggleTab = () => {
    setActiveTab((p) => (p === "sign-in" ? "sign-up" : "sign-in"));
    setError("");
  };

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotStatus("loading");
    setForgotError("");
    try {
      await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.toLowerCase().trim() }),
      });
      // Always show "sent" — anti-enumeration: never reveal if email exists.
      setForgotStatus("sent");
    } catch {
      setForgotError("No se pudo conectar. Intenta de nuevo.");
      setForgotStatus("idle");
    }
  }

  // ── Signup success panel (replaces the card content) ───────────────────────
  if (signupSuccess) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
        </div>
        <p className="font-semibold text-[#050040]">¡Cuenta creada!</p>
        <p className="text-sm text-slate-500">
          Tu cuenta se creó correctamente. Inicia sesión para continuar.
        </p>
        <button
          onClick={() => { setSignupSuccess(false); setActiveTab("sign-in"); setError(""); }}
          className="mt-2 w-full rounded-xl bg-[#050040] py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
        >
          Ir a iniciar sesión
        </button>
      </div>
    );
  }

  // ── Forgot-password panel (replaces the card content) ─────────────────────
  if (forgotOpen) {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => { setForgotOpen(false); setForgotStatus("idle"); setForgotEmail(""); setForgotError(""); }}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        {forgotStatus === "sent" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <p className="font-semibold text-[#050040]">Revisa tu correo</p>
            <p className="text-sm text-slate-500">
              Si <span className="font-medium text-slate-700">{forgotEmail}</span> está registrado,
              recibirás un enlace para restablecer tu contraseña.
            </p>
            <button
              onClick={() => { setForgotOpen(false); setForgotStatus("idle"); setForgotEmail(""); }}
              className="mt-2 text-sm font-semibold text-[#050040] hover:underline"
            >
              Volver al inicio de sesión
            </button>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-semibold text-[#050040]">¿Olvidaste tu contraseña?</h2>
              <p className="text-sm text-slate-500 mt-1">
                Ingresa tu email y te enviaremos un enlace de recuperación.
              </p>
            </div>
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Email</label>
                <input
                  type="email" required autoComplete="email"
                  placeholder="tu@empresa.com"
                  value={forgotEmail}
                  onChange={(e) => { setForgotEmail(e.target.value); setForgotError(""); }}
                  className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#050040] focus:ring-2 focus:ring-[#050040]/10 transition"
                />
              </div>

              {forgotError && (
                <p className="text-xs text-red-500 text-center">{forgotError}</p>
              )}

              <button
                type="submit"
                disabled={forgotStatus === "loading"}
                className="w-full rounded-xl bg-[#050040] py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {forgotStatus === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
                Enviar enlace de recuperación
              </button>
            </form>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <Tabs
        value={activeTab}
        onValueChange={(v) => { setActiveTab(v as "sign-in" | "sign-up"); setError(""); }}
        className="w-full"
      >
        <TabsList className="mb-8 w-full rounded-xl bg-slate-100 p-1">
          <TabsTrigger
            value="sign-in"
            className="flex-1 rounded-lg py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-[#050040] data-[state=active]:shadow-sm text-slate-500 transition-all"
          >
            Iniciar sesión
          </TabsTrigger>
          <TabsTrigger
            value="sign-up"
            className="flex-1 rounded-lg py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-[#050040] data-[state=active]:shadow-sm text-slate-500 transition-all"
          >
            Crear cuenta
          </TabsTrigger>
        </TabsList>

        {/* ── Sign In ── */}
        <TabsContent value="sign-in" className="mt-0">
          <div className="flex flex-col gap-3">
            <button
              className={socialBtn}
              disabled={!!loading}
              onClick={() => handleOAuth("google")}
            >
              {loading === "google" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FaGoogle className="text-[#EA4335]" />}
              Continuar con Google
            </button>
            <div className="flex items-center gap-3 my-1">
              <span className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">o con email</span>
              <span className="flex-1 h-px bg-slate-200" />
            </div>

            <form onSubmit={handleSignIn} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Email</label>
                <input
                  type="email" required autoComplete="email"
                  placeholder="tu@empresa.com"
                  value={siEmail} onChange={(e) => setSiEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Contraseña</label>
                  <button
                    type="button"
                    onClick={() => { setForgotEmail(siEmail); setForgotOpen(true); }}
                    className="text-xs text-[#050040] hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <input
                  type="password" required autoComplete="current-password"
                  placeholder="••••••••"
                  value={siPassword} onChange={(e) => setSiPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              {error && activeTab === "sign-in" && (
                <p className="text-xs text-red-500 text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={!!loading}
                className="mt-1 w-full rounded-xl bg-[#050040] py-3 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading === "signin" && <Loader2 className="w-4 h-4 animate-spin" />}
                Iniciar sesión
              </button>
            </form>

            <p className="text-center text-xs text-slate-500 mt-1">
              ¿No tienes cuenta?{" "}
              <span className="font-semibold text-[#050040] cursor-pointer hover:underline" onClick={toggleTab}>
                Créala gratis
              </span>
            </p>
          </div>
        </TabsContent>

        {/* ── Sign Up ── */}
        <TabsContent value="sign-up" className="mt-0">
          <div className="flex flex-col gap-3">
            <button
              className={socialBtn}
              disabled={!!loading}
              onClick={() => handleOAuth("google")}
            >
              {loading === "google" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FaGoogle className="text-[#EA4335]" />}
              Registrarse con Google
            </button>
            <div className="flex items-center gap-3 my-1">
              <span className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">o con email</span>
              <span className="flex-1 h-px bg-slate-200" />
            </div>

            <form onSubmit={handleSignUp} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Nombre completo</label>
                <input
                  type="text" required autoComplete="name"
                  placeholder="Tu nombre"
                  value={suName} onChange={(e) => setSuName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Email de trabajo</label>
                <input
                  type="email" required autoComplete="email"
                  placeholder="tu@empresa.com"
                  value={suEmail} onChange={(e) => setSuEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Contraseña</label>
                <input
                  type="password" required autoComplete="new-password"
                  placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número"
                  value={suPassword} onChange={(e) => setSuPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              {error && activeTab === "sign-up" && (
                <p className="text-xs text-red-500 text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={!!loading}
                className="mt-1 w-full rounded-xl bg-[#050040] py-3 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading === "signup" && <Loader2 className="w-4 h-4 animate-spin" />}
                Crear cuenta gratis
              </button>
            </form>

            <p className="text-center text-xs text-slate-500 mt-1">
              ¿Ya tienes cuenta?{" "}
              <span className="font-semibold text-[#050040] cursor-pointer hover:underline" onClick={toggleTab}>
                Inicia sesión
              </span>
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <OtpDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        email={pendingEmail}
        onVerified={onOtpVerified}
      />
    </>
  );
}
