import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeetBox",
  description: "Transcripción y resúmenes de reuniones en tiempo real. Presencial o virtual, sin perder un acuerdo.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
