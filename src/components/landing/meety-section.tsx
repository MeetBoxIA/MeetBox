'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, CornerUpLeft } from 'lucide-react';

const SUGGESTIONS = [
  '¿Cuántos micrófonos tiene el dispositivo?',
  '¿Con qué apps se integra MeetBox?',
  '¿Cuánto cuesta el plan para empresas?',
];

const MOCK_ANSWERS: Record<string, string> = {
  '¿Cuántos micrófonos tiene el dispositivo?':
    'MeetBox tiene un **array de 6 micrófonos** dispuestos en círculo con tecnología de beamforming 360°. Esto le permite identificar la dirección de la voz y saber **quién está hablando** en cada momento, incluso en salas con eco o ruido de fondo.',
  '¿Cómo se conecta MeetBox a mi laptop?':
    'MeetBox se conecta por **USB-C** a cualquier laptop o directamente a la corriente eléctrica. No requiere drivers ni software adicional — es **plug & play**. En menos de 10 segundos está listo para usarse.',
  '¿Qué pasa con el audio después de la reunión?':
    'El audio crudo se **elimina automáticamente a las 24 horas** de procesado. Lo que persiste es la transcripción y el resumen, cifrados con AES-256. Nunca accedemos al contenido de tus reuniones sin requerimiento legal.',
  '¿Con qué apps se integra MeetBox?':
    'MeetBox se integra nativamente con **Slack** (envía el resumen al canal), **Jira** (crea tickets con las tareas detectadas) y **Google Calendar** (registra la reunión y agenda follow-ups). Próximamente: Notion, Linear y Microsoft Teams.',
  '¿Funciona sin internet?':
    'El dispositivo requiere conexión a internet para el procesamiento con Whisper en la nube. Si la conexión se corta durante la reunión, **almacena el audio localmente** y lo procesa en cuanto se restablece la conexión.',
  '¿Cuánto cuesta el plan para empresas?':
    'El plan **Empresa cuesta $199/mes** e incluye salas ilimitadas, dashboard de administración, SSO y soporte dedicado 24/7. El dispositivo físico se adquiere por separado a **$180 USD** (pago único). Las primeras 100 empresas reciben 3 meses gratis.',
};

const DEFAULT_ANSWER =
  'MeetBox es un dispositivo con **6 micrófonos** que va en el centro de la sala. Se conecta por USB-C, presionas un botón para iniciar y en menos de **60 segundos** después de terminar envía a todos el resumen, las decisiones y las tareas asignadas. ¿Quieres saber algo más específico?';

function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith('**') ? (
      <strong key={i} className="font-semibold text-[#050040]">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function MeetySection() {
  const [value, setValue] = React.useState('');
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleAsk = (question: string) => {
    const q = question.trim();
    if (!q) return;
    setValue(q);
    setAnswer(null);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setAnswer(MOCK_ANSWERS[q] ?? DEFAULT_ANSWER);
    }, 900);
  };

  return (
    <section className="bg-white py-28 px-4">
      <div className="max-w-4xl mx-auto text-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-6">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-widest">Asistente IA</span>
        </div>

        {/* Title */}
        <h2 className="text-4xl md:text-6xl font-semibold text-[#050040] leading-tight">
          Conoce a <span className="text-amber-500">Meety</span>
        </h2>
        <p className="mt-4 text-slate-500 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Tu asistente virtual para todo lo relacionado con MeetBox.
          Pregúntale sobre el dispositivo, el software, las integraciones o los planes.
        </p>

        {/* Card */}
        <div className="mt-10 bg-white rounded-3xl border border-slate-200 shadow-2xl shadow-slate-200/80 overflow-hidden text-left">

          {/* Input row */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
            <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAsk(value); }}
              placeholder="Pregúntale cualquier cosa a Meety sobre MeetBox…"
              className="flex-1 text-base text-slate-800 placeholder:text-slate-400 outline-none bg-transparent"
            />
            <button
              onClick={() => handleAsk(value)}
              disabled={!value.trim() || loading}
              className="flex-shrink-0 flex items-center gap-2 bg-[#050040] disabled:opacity-35 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-3 rounded-xl transition"
            >
              <CornerUpLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Pregúntale a Meety</span>
              <span className="sm:hidden">Enviar</span>
            </button>
          </div>

          {/* Suggestions */}
          <div className="px-6 py-4 flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/60">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleAsk(s)}
                className="inline-flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 bg-white rounded-full px-4 py-2 hover:bg-slate-50 hover:border-slate-300 hover:text-[#050040] transition whitespace-nowrap shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                {s}
              </button>
            ))}
            <span className="ml-auto self-center text-xs text-slate-400 hidden md:block">o presiona Enter</span>
          </div>

          {/* Answer */}
          <AnimatePresence>
            {(loading || answer) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="px-6 py-5"
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#050040] flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="w-2 h-2 rounded-full bg-slate-300 block"
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                      <span className="text-sm text-slate-400 ml-2">Meety está pensando…</span>
                    </div>
                  </div>
                ) : answer ? (
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#050040] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <p className="text-base text-slate-600 leading-relaxed">
                      {renderBold(answer)}
                    </p>
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Learn more */}
        <a
          href="#"
          className="inline-flex items-center gap-2 mt-7 text-sm font-semibold text-[#050040] hover:opacity-70 transition"
        >
          Aprende más sobre Meety
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </section>
  );
}
