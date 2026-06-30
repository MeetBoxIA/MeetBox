import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  themeColor: '#050040',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'MeetBox Desktop',
  description:
    'Descarga MeetBox Desktop para grabar el audio de tus videollamadas sin bots. Disponible para Windows, macOS y Linux.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MeetBox',
  },
  openGraph: {
    title: 'MeetBox Desktop',
    description: 'Graba el audio de tus videollamadas sin bots.',
    type: 'website',
  },
};

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
