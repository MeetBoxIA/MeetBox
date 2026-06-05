"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OtpDialog } from "@/components/ui/otp-dialog";
import { FaGoogle } from "react-icons/fa";
import { Loader2 } from "lucide-react";

interface AuthTabsCardProps {
  defaultTab?: "sign-in" | "sign-up";
}

export default function AuthTabsCard({ defaultTab = "sign-in" }: AuthTabsCardProps) {
  const [activeTab, setActiveTab] = React.useState<"sign-in" | "sign-up">(defaultTab);
  const [otpOpen, setOtpOpen] = React.useState(false);
  const [pendingEmail, setPendingEmail] = React.useState("");
  const [loading, setLoading] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");

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
    await signIn(provider, { callbackUrl: "/auth/verify" });
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
      window.location.href = "/dashboard";
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
    // 1. Crear usuario en Supabase
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: suName, email: pendingEmail, password: suPassword }),
    });

    if (!res.ok) {
      const { error } = await res.json();
      setOtpOpen(false);
      setError(error ?? "Error al crear la cuenta.");
      return;
    }

    // 2. Iniciar sesión con el usuario recién creado
    await signIn("credentials", {
      email: pendingEmail,
      password: suPassword,
      otpVerified: "true",
      callbackUrl: "/dashboard",
    });
  }

  const toggleTab = () => {
    setActiveTab((p) => (p === "sign-in" ? "sign-up" : "sign-in"));
    setError("");
  };

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
                  <a href="#" className="text-xs text-[#050040] hover:underline">¿Olvidaste tu contraseña?</a>
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
                  placeholder="Mínimo 8 caracteres"
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
