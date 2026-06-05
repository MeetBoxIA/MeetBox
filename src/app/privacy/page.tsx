export const metadata = {
  title: "Política de Privacidad — MeetBox",
  description: "Cómo MeetBox recopila, usa y protege tus datos.",
}

const sections = [
  {
    title: "1. Responsable del tratamiento",
    body: `MeetBox SAS, con domicilio en Medellín, Colombia, es la empresa responsable del tratamiento de sus datos personales. Para cualquier consulta relacionada con privacidad puede escribirnos a privacidad@meetbox.io. Cumplimos con la Ley 1581 de 2012 (Habeas Data) de Colombia y con el Reglamento General de Protección de Datos (RGPD) de la Unión Europea para usuarios en esa región.`,
  },
  {
    title: "2. Datos que recopilamos",
    body: `Recopilamos los siguientes tipos de información: (a) Datos de cuenta: nombre, correo electrónico, empresa y contraseña cifrada, proporcionados al registrarse. (b) Audio y transcripciones: el audio de las reuniones capturado por el Dispositivo se transmite cifrado a nuestros servidores para su procesamiento. Las transcripciones, resúmenes y tareas generadas se almacenan asociadas a su cuenta. (c) Datos de uso: información sobre cómo interactúa con el Software, incluyendo frecuencia de reuniones, duración y funcionalidades utilizadas, siempre de forma agregada y sin identificar contenido de las conversaciones. (d) Datos técnicos: dirección IP, tipo de navegador, sistema operativo y logs de acceso para garantizar la seguridad y el funcionamiento del servicio.`,
  },
  {
    title: "3. Finalidad del tratamiento",
    body: `Sus datos son utilizados exclusivamente para: prestar el servicio de transcripción, detección de tareas y generación de resúmenes; enviar los resúmenes ejecutivos a los participantes indicados; gestionar su cuenta y suscripción; mejorar la precisión de nuestros modelos de procesamiento de lenguaje natural mediante datos anonimizados; enviar comunicaciones relacionadas con el servicio (actualizaciones, facturas, alertas de seguridad); y cumplir con obligaciones legales. No utilizamos sus datos para publicidad de terceros ni los vendemos a ninguna empresa.`,
  },
  {
    title: "4. Procesamiento de audio",
    body: `El audio de las reuniones es el dato más sensible que procesamos. Lo tratamos con las siguientes garantías: el audio se cifra en tránsito usando TLS 1.3 y en reposo usando AES-256; el procesamiento ocurre en servidores ubicados en la región de América (AWS us-east-1 y sa-east-1); el audio crudo se elimina automáticamente tras 24 horas de generada la transcripción; las transcripciones y resúmenes se conservan mientras la cuenta esté activa y hasta 30 días después de su cancelación; ningún empleado de MeetBox accede al contenido de audio o transcripciones salvo requerimiento legal expreso.`,
  },
  {
    title: "5. Base legal para el tratamiento",
    body: `El tratamiento de sus datos se basa en: (a) la ejecución del contrato de servicio que usted acepta al registrarse; (b) su consentimiento explícito para el procesamiento de audio de reuniones, que puede revocar en cualquier momento eliminando su cuenta; (c) el interés legítimo de MeetBox en mejorar el servicio mediante datos estadísticos anonimizados; y (d) el cumplimiento de obligaciones legales aplicables.`,
  },
  {
    title: "6. Compartición de datos con terceros",
    body: `MeetBox utiliza los siguientes proveedores de servicios que pueden procesar datos en su nombre: Amazon Web Services (infraestructura de nube), OpenAI / Whisper (procesamiento de transcripción de audio), Stripe (procesamiento de pagos — nunca recibimos ni almacenamos datos de tarjetas), y proveedores de email transaccional para el envío de resúmenes. Todos los proveedores están vinculados por acuerdos de procesamiento de datos que garantizan el mismo nivel de protección descrito en esta política. No compartimos datos con anunciantes, socios comerciales ni otras terceras partes fuera de este listado.`,
  },
  {
    title: "7. Integraciones con servicios externos",
    body: `Cuando el Usuario conecta MeetBox con servicios externos como Slack, Jira o Google Calendar, autoriza expresamente el envío de resúmenes y tareas a dichos servicios. MeetBox actúa como intermediario y no almacena las credenciales de acceso a esos servicios más allá de los tokens de autorización necesarios para la integración. El Usuario puede revocar estas integraciones en cualquier momento desde el panel de configuración.`,
  },
  {
    title: "8. Derechos del titular de los datos",
    body: `De acuerdo con la Ley 1581 de 2012 y el RGPD, usted tiene derecho a: acceder a sus datos personales almacenados; rectificar datos inexactos o incompletos; solicitar la eliminación de sus datos ("derecho al olvido"); oponerse al tratamiento o solicitar su limitación; portabilidad de sus datos en formato estructurado; y revocar el consentimiento otorgado en cualquier momento. Para ejercer cualquiera de estos derechos, escriba a privacidad@meetbox.io. Responderemos en un plazo máximo de 15 días hábiles.`,
  },
  {
    title: "9. Seguridad de la información",
    body: `Implementamos medidas técnicas y organizativas adecuadas para proteger sus datos: cifrado AES-256 en reposo y TLS 1.3 en tránsito, autenticación de dos factores disponible para todas las cuentas, auditorías de seguridad periódicas, controles de acceso basados en roles mínimos necesarios (principio de mínimo privilegio), y un plan de respuesta a incidentes con notificación a los afectados en un plazo máximo de 72 horas en caso de brecha de seguridad.`,
  },
  {
    title: "10. Retención de datos",
    body: `Los datos de cuenta y las transcripciones se conservan mientras la cuenta esté activa. Tras la cancelación de la cuenta, los datos se eliminan permanentemente en un plazo de 30 días, excepto cuando su conservación sea requerida por ley (por ejemplo, registros contables que deben conservarse por 5 años según la legislación colombiana). El audio crudo de las reuniones se elimina automáticamente a las 24 horas de procesado.`,
  },
  {
    title: "11. Transferencias internacionales",
    body: `Sus datos pueden ser transferidos y procesados fuera de Colombia, específicamente en servidores de Amazon Web Services en Estados Unidos y Brasil. Estas transferencias se realizan bajo las garantías adecuadas descritas en las cláusulas contractuales estándar de la Comisión Europea y bajo los mecanismos de transferencia reconocidos por la Superintendencia de Industria y Comercio de Colombia.`,
  },
  {
    title: "12. Cambios a esta política",
    body: `Podemos actualizar esta Política de Privacidad para reflejar cambios en nuestras prácticas o en la legislación aplicable. Notificaremos los cambios materiales por correo electrónico con al menos 15 días de anticipación. La fecha de "última actualización" al inicio del documento siempre indicará la versión vigente.`,
  },
  {
    title: "13. Contacto y reclamaciones",
    body: `Para cualquier consulta, solicitud o reclamación relacionada con el tratamiento de sus datos personales puede contactarnos en privacidad@meetbox.io o escribir a nuestra dirección postal en Medellín, Colombia. Si considera que sus derechos no han sido atendidos adecuadamente, tiene derecho a presentar una reclamación ante la Superintendencia de Industria y Comercio (SIC) en Colombia o ante la autoridad de protección de datos de su país de residencia.`,
  },
]

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-semibold text-[#050040]">Política de Privacidad</h1>
          <p className="mt-3 text-slate-500 text-sm">
            Última actualización: 25 de mayo de 2025 · Versión 1.0
          </p>
          <p className="mt-4 text-slate-600 text-sm leading-relaxed">
            En MeetBox entendemos que el audio de sus reuniones es información sensible.
            Esta política explica con precisión qué datos recopilamos, cómo los usamos,
            quién tiene acceso a ellos y cuáles son sus derechos como titular de esa información.
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
            <a href="/terms" className="text-slate-500 hover:text-[#050040] transition">Términos de Servicio</a>
            <a href="/" className="text-slate-500 hover:text-[#050040] transition">Volver al inicio</a>
          </div>
        </div>
      </div>
    </main>
  )
}
