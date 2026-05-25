"use client"

import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FaGoogle, FaMicrosoft } from "react-icons/fa"

interface AuthTabsCardProps {
  defaultTab?: "sign-in" | "sign-up"
}

export default function AuthTabsCard({ defaultTab = "sign-in" }: AuthTabsCardProps) {
  const [activeTab, setActiveTab] = React.useState<"sign-in" | "sign-up">(defaultTab)

  const toggleTab = () => setActiveTab((p) => (p === "sign-in" ? "sign-up" : "sign-in"))

  const inputClass =
    "w-full mt-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#050040] focus:ring-2 focus:ring-[#050040]/10 transition"

  const socialBtn =
    "flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "sign-in" | "sign-up")}
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
          <button className={socialBtn}>
            <FaGoogle className="text-[#EA4335]" /> Continuar con Google
          </button>
          <button className={socialBtn}>
            <FaMicrosoft className="text-[#00A4EF]" /> Iniciar con Microsoft
          </button>

          <div className="flex items-center gap-3 my-1">
            <span className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">o con email</span>
            <span className="flex-1 h-px bg-slate-200" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Email</label>
            <input type="email" placeholder="tu@empresa.com" className={inputClass} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Contraseña</label>
              <a href="#" className="text-xs text-[#050040] hover:underline">¿Olvidaste tu contraseña?</a>
            </div>
            <input type="password" placeholder="••••••••" className={inputClass} />
          </div>

          <button className="mt-2 w-full rounded-xl bg-[#050040] py-3 text-sm font-semibold text-white hover:bg-slate-800 transition">
            Iniciar sesión
          </button>

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
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Nombre completo</label>
            <input type="text" placeholder="Tu nombre" className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Email de trabajo</label>
            <input type="email" placeholder="tu@empresa.com" className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Contraseña</label>
            <input type="password" placeholder="Mínimo 8 caracteres" className={inputClass} />
          </div>

          <button className="mt-2 w-full rounded-xl bg-[#050040] py-3 text-sm font-semibold text-white hover:bg-slate-800 transition">
            Crear cuenta gratis
          </button>

          <p className="text-center text-xs text-slate-500 mt-1">
            ¿Ya tienes cuenta?{" "}
            <span className="font-semibold text-[#050040] cursor-pointer hover:underline" onClick={toggleTab}>
              Inicia sesión
            </span>
          </p>
        </div>
      </TabsContent>
    </Tabs>
  )
}
