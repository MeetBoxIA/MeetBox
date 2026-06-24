export const metadata = {
  title: "Términos de Servicio — MeetBox",
  description: "Términos y condiciones de uso de MeetBox.",
}

const sections = [
  {
    title: "1. Descripción del servicio",
    body: `MeetBox es un sistema compuesto por un dispositivo físico de hardware (el "Dispositivo") y una plataforma de software en la nube (el "Software"). El Dispositivo captura audio en reuniones de trabajo mediante un array de micrófonos, y el Software procesa ese audio para generar transcripciones en tiempo real, detectar tareas y decisiones, y enviar resúmenes ejecutivos a los participantes. El servicio se ofrece bajo un modelo de suscripción mensual por sala o por empresa, según el plan contratado.`,
  },
  {
    title: "2. Aceptación de los términos",
    body: `Al crear una cuenta, activar un Dispositivo o utilizar cualquier funcionalidad del Software, usted ("el Usuario") acepta quedar vinculado por estos Términos de Servicio. Si actúa en nombre de una organización, declara tener autoridad para aceptar estos términos en su nombre. Si no acepta estos términos, no debe utilizar el servicio.`,
  },
  {
    title: "3. Registro y cuenta",
    body: `Para acceder al Software es necesario crear una cuenta con un correo electrónico válido y una contraseña segura. El Usuario es responsable de mantener la confidencialidad de sus credenciales y de todas las actividades realizadas bajo su cuenta. MeetBox no se responsabiliza por pérdidas derivadas del uso no autorizado de su cuenta cuando dicho uso resulte de la negligencia del Usuario.`,
  },
  {
    title: "4. Licencia de uso",
    body: `MeetBox otorga al Usuario una licencia limitada, no exclusiva, no transferible y revocable para usar el Software durante la vigencia de la suscripción activa. Esta licencia no incluye el derecho a sublicenciar, vender, revender, transferir, reproducir, distribuir ni explotar comercialmente el Software o cualquier parte de él. El Dispositivo físico se vende de forma definitiva al Usuario y no se requiere licencia de hardware adicional.`,
  },
  {
    title: "5. Uso aceptable",
    body: `El Usuario se compromete a utilizar MeetBox únicamente para reuniones en las que todos los participantes han sido informados y han consentido la grabación y transcripción del audio. Está prohibido usar el servicio para grabar conversaciones sin consentimiento, para actividades ilegales, para recopilar información de terceros sin autorización, o para interferir con la infraestructura de MeetBox. MeetBox se reserva el derecho de suspender cuentas que violen esta política sin previo aviso.`,
  },
  {
    title: "6. Facturación y pagos",
    body: `El Dispositivo tiene un precio único de $180 USD. El Software se factura mensualmente según el plan seleccionado: $29 USD/mes por sala o $199 USD/mes para el plan Empresa de salas ilimitadas. Los pagos se realizan por adelantado. MeetBox no emite reembolsos por períodos parciales. Las suscripciones se renuevan automáticamente salvo cancelación expresa antes del inicio del siguiente período de facturación.`,
  },
  {
    title: "7. Cancelación y terminación",
    body: `El Usuario puede cancelar su suscripción en cualquier momento desde el panel de administración. La cancelación surte efecto al finalizar el período de facturación en curso, durante el cual el acceso al Software se mantiene activo. MeetBox puede terminar o suspender el acceso al servicio por incumplimiento de estos términos, falta de pago o por razones de seguridad, con o sin previo aviso dependiendo de la gravedad del caso.`,
  },
  {
    title: "8. Propiedad intelectual",
    body: `MeetBox y sus licenciantes son los únicos titulares de todos los derechos de propiedad intelectual sobre el Software, la marca, los algoritmos de procesamiento de audio y cualquier otro componente del servicio. El Usuario conserva la titularidad del contenido generado a partir de sus reuniones (transcripciones, resúmenes, tareas), pero otorga a MeetBox una licencia limitada para procesar dicho contenido con el único fin de prestar el servicio contratado.`,
  },
  {
    title: "9. Limitación de responsabilidad",
    body: `En la máxima medida permitida por la ley, MeetBox no será responsable por daños indirectos, incidentales, especiales o consecuentes que resulten del uso o la imposibilidad de uso del servicio. La responsabilidad total de MeetBox ante el Usuario no excederá el monto pagado por el servicio durante los tres (3) meses anteriores al evento que origina la reclamación.`,
  },
  {
    title: "10. Modificaciones",
    body: `MeetBox puede modificar estos Términos de Servicio en cualquier momento. Los cambios materiales serán notificados al correo registrado con al menos 15 días de anticipación. El uso continuado del servicio tras la vigencia de los nuevos términos constituye aceptación de los mismos.`,
  },
  {
    title: "11. Ley aplicable y jurisdicción",
    body: `Estos términos se rigen por las leyes de la República de Colombia. Cualquier disputa que no pueda resolverse amigablemente será sometida a los tribunales competentes de la ciudad de Medellín, Colombia. Si el Usuario se encuentra fuera de Colombia, las leyes locales de protección al consumidor pueden otorgarle derechos adicionales que estos términos no restringen.`,
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">

        <a href="/" className="inline-flex items-center gap-2 mb-12 group">
          <svg width="20" height="26" viewBox="0 0 31 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="m8.75 11.3 6.75 3.884 6.75-3.885M8.75 34.58v-7.755L2 22.939m27 0-6.75 3.885v7.754M2.405 15.408 15.5 22.954l13.095-7.546M15.5 38V22.939M29 28.915V16.962a2.98 2.98 0 0 0-1.5-2.585L17 8.4a3.01 3.01 0 0 0-3 0L3.5 14.377A3 3 0 0 0 2 16.962v11.953A2.98 2.98 0 0 0 3.5 31.5L14 37.477a3.01 3.01 0 0 0 3 0L27.5 31.5a3 3 0 0 0 1.5-2.585" stroke="#050040" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-base font-semibold tracking-tight text-[#050040] group-hover:opacity-70 transition">MeetBox</span>
        </a>

        <div className="mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Legal</p>
          <h1 className="text-4xl font-semibold text-[#050040]">Términos de Servicio</h1>
          <p className="mt-3 text-slate-500 text-sm">
            Última actualización: 25 de mayo de 2025 · Versión 1.0
          </p>
          <p className="mt-4 text-slate-600 text-sm leading-relaxed">
            Estos Términos de Servicio regulan el acceso y uso del dispositivo y la plataforma MeetBox,
            operada por <strong>MeetBox SAS</strong>, con domicilio en Medellín, Colombia.
            Le recomendamos leerlos detenidamente antes de usar el servicio.
          </p>
        </div>

        <div className="space-y-10">
          {sections.map((s) => (
            <div key={s.title}>
              <h2 className="text-base font-semibold text-[#050040] mb-2">{s.title}</h2>
              <p className="text-slate-600 text-sm leading-7">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-10 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            © 2025 MeetBox SAS · Medellín, Colombia
          </p>
          <div className="flex items-center gap-6 text-xs">
            <a href="/privacy" className="text-slate-500 hover:text-[#050040] transition">Política de Privacidad</a>
            <a href="/" className="text-slate-500 hover:text-[#050040] transition">Volver al inicio</a>
          </div>
        </div>
      </div>
    </main>
  )
}
