"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SLIDES = [
  {
    image: "/onboarding/undraw_online-meeting_qe61.svg",
    tag: "Bienvenido",
    title: "Tu asistente de\nreuniones inteligente",
    description:
      "MeetBox captura, transcribe y analiza cada reunión automáticamente para que puedas enfocarte en lo que realmente importa: tomar decisiones.",
  },
  {
    image: "/onboarding/undraw_ai-research-assistant_cxx0.svg",
    tag: "Inteligencia Artificial",
    title: "Transcripción precisa\nen tiempo real",
    description:
      "Nuestro motor de IA convierte cada conversación en texto al instante, identificando participantes, temas clave y momentos importantes de la reunión.",
  },
  {
    image: "/onboarding/undraw_writing-online_x665.svg",
    tag: "Productividad",
    title: "Resúmenes y notas\nautomáticas",
    description:
      "Al terminar cada reunión recibes un resumen ejecutivo con los puntos clave, decisiones tomadas y próximos pasos. Sin esfuerzo extra.",
  },
  {
    image: "/onboarding/undraw_programming_j1zw.svg",
    tag: "Hardware + Software",
    title: "Dispositivo y app\ndesktop integrados",
    description:
      "Conecta el dispositivo MeetBox a tu sala y gestiona todo desde la aplicación desktop. Una solución completa, lista para usar desde el primer día.",
  },
];

const STORAGE_KEY = "meetbox_onboarding_done";

export default function Onboarding({ onComplete }: { onComplete?: () => void } = {}) {
  const [visible, setVisible] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  const [animating, setAnimating] = React.useState(false);
  const [direction, setDirection] = React.useState<"next" | "prev">("next");

  React.useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function finish() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    onComplete?.();
  }

  function go(nextIndex: number, dir: "next" | "prev") {
    if (animating) return;
    setAnimating(true);
    setDirection(dir);
    setTimeout(() => {
      setCurrent(nextIndex);
      setAnimating(false);
    }, 280);
  }

  if (!visible) return null;

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white px-4">
      <div className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-[0_8px_40px_-8px_rgba(5,0,64,0.18),0_2px_12px_-2px_rgba(5,0,64,0.08)]">

        {/* Image area */}
        <div className="relative h-64 bg-[#050040] flex items-center justify-center overflow-hidden">
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-all duration-280",
              animating && direction === "next" && "opacity-0 -translate-x-6",
              animating && direction === "prev" && "opacity-0 translate-x-6",
              !animating && "opacity-100 translate-x-0",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.image}
              alt={slide.title}
              className="h-52 w-auto object-contain select-none"
              draggable={false}
            />
          </div>

          {/* Skip button */}
          <button
            onClick={finish}
            className="absolute top-4 right-4 text-xs font-semibold text-white/60 hover:text-white transition px-2 py-1 rounded-lg hover:bg-white/10"
          >
            Omitir
          </button>
        </div>

        {/* Content */}
        <div className="px-8 pt-6 pb-8">

          {/* Tag */}
          <div
            className={cn(
              "inline-flex items-center bg-[#050040]/8 rounded-full px-3 py-1 mb-3 transition-all duration-280",
              animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0",
            )}
          >
            <span className="text-xs font-semibold text-[#050040]">{slide.tag}</span>
          </div>

          {/* Title */}
          <h2
            className={cn(
              "text-2xl font-bold text-[#050040] leading-tight mb-3 whitespace-pre-line transition-all duration-280",
              animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0",
            )}
          >
            {slide.title}
          </h2>

          {/* Description */}
          <p
            className={cn(
              "text-sm text-slate-500 leading-relaxed mb-7 transition-all duration-300",
              animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0",
            )}
          >
            {slide.description}
          </p>

          {/* Footer: dots + buttons */}
          <div className="flex items-center justify-between">

            {/* Dots */}
            <div className="flex items-center gap-1.5">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => i !== current && go(i, i > current ? "next" : "prev")}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    i === current
                      ? "w-6 h-2 bg-[#050040]"
                      : "w-2 h-2 bg-slate-200 hover:bg-slate-300",
                  )}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-2">
              {current > 0 && (
                <button
                  onClick={() => go(current - 1, "prev")}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Anterior
                </button>
              )}
              {isLast ? (
                <button
                  onClick={finish}
                  className="px-6 py-2 rounded-xl bg-[#050040] text-sm font-semibold text-white hover:bg-slate-800 transition"
                >
                  Comenzar
                </button>
              ) : (
                <button
                  onClick={() => go(current + 1, "next")}
                  className="px-6 py-2 rounded-xl bg-[#050040] text-sm font-semibold text-white hover:bg-slate-800 transition flex items-center gap-1.5"
                >
                  Siguiente
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
