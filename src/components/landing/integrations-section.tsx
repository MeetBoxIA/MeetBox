'use client';

import LogoLoop from '@/components/ui/logo-loop';
import {
  SiSlack, SiJira, SiGithub, SiNotion, SiZoom,
  SiGooglecalendar, SiLinear, SiConfluence,
  SiTrello, SiAsana,
} from 'react-icons/si';

const integrationLogos = [
  { node: <SiSlack />,           title: 'Slack',              style: '#4A154B' },
  { node: <SiJira />,            title: 'Jira',               style: '#0052CC' },
  { node: <SiGooglecalendar />,  title: 'Google Calendar',    style: '#4285F4' },
  { node: <SiGithub />,          title: 'GitHub',             style: '#181717' },
  { node: <SiNotion />,          title: 'Notion',             style: '#000000' },
  { node: <SiLinear />,          title: 'Linear',             style: '#5E6AD2' },
  { node: <SiZoom />,            title: 'Zoom',               style: '#2D8CFF' },
  { node: <SiConfluence />,      title: 'Confluence',         style: '#172B4D' },
  { node: <SiTrello />,          title: 'Trello',             style: '#0052CC' },
  { node: <SiAsana />,           title: 'Asana',              style: '#F06A6A' },
];

const logos = integrationLogos.map(({ node, title, style }) => ({
  node: <span style={{ color: style }}>{node}</span>,
  title,
}));

export default function IntegrationsSection() {
  return (
    <section id="integraciones" className="bg-slate-50 pt-28 pb-0 px-4 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
            Integraciones
          </p>
          <h2 className="text-3xl md:text-5xl font-medium text-[#050040] max-w-2xl mx-auto">
            Se conecta con las herramientas que ya usas
          </h2>
          <p className="mt-4 text-slate-500 max-w-lg mx-auto text-sm md:text-base">
            El resumen llega directo a Slack, las tareas se crean en Jira, y los eventos se sincronizan con Google Calendar. Sin copiar, sin pegar.
          </p>
        </div>

        <div style={{ height: '96px', position: 'relative', overflow: 'hidden' }}>
          <LogoLoop
            logos={logos}
            speed={80}
            direction="left"
            logoHeight={48}
            gap={56}
            hoverSpeed={0}
            scaleOnHover
            fadeOut
            fadeOutColor="#f8fafc"
            ariaLabel="Integraciones de MeetBox"
          />
        </div>

        <div className="mt-20 pb-28 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          {[
            {
              title: 'Slack',
              description: 'El resumen ejecutivo y las tareas llegan automáticamente al canal de tu equipo.',
              icon: <SiSlack className="w-6 h-6" style={{ color: '#4A154B' }} />,
            },
            {
              title: 'Jira',
              description: 'Cada tarea detectada se convierte en un ticket asignado con fecha límite.',
              icon: <SiJira className="w-6 h-6" style={{ color: '#0052CC' }} />,
            },
            {
              title: 'Google Calendar',
              description: 'La reunión se registra con su resumen y los follow-ups se agendan solos.',
              icon: <SiGooglecalendar className="w-6 h-6" style={{ color: '#4285F4' }} />,
            },
          ].map((item) => (
            <div key={item.title} className="bg-white rounded-2xl p-6 border border-slate-100">
              <div className="mb-3">{item.icon}</div>
              <h3 className="font-semibold text-[#050040] mb-2">{item.title}</h3>
              <p className="text-slate-500 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
