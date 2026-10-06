import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "AgenteTVN · De la señal a la decisión",
  description: "Copiloto editorial para TVN Media: agenda priorizada, fichas con evidencia y borradores para revisión humana, a partir de noticias públicas e indicadores oficiales.",
  keywords: ["TVN", "editorial", "evidencia", "noticias", "Panamá", "agente"],
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%231a2f52'/%3E%3Ccircle cx='32' cy='26' r='11' fill='none' stroke='white' stroke-width='4'/%3E%3Ccircle cx='32' cy='26' r='3.5' fill='%23e8b64c'/%3E%3Cpath d='M32 37v9M24 50h16' stroke='white' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a2f52",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`antialiased bg-background text-foreground`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
