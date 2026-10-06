import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans-condensed/500.css";
import "@fontsource/ibm-plex-sans-condensed/600.css";
import "@fontsource/ibm-plex-sans-condensed/700.css";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "AgenteTVN · De la señal a la decisión",
  description: "Copiloto editorial para TVN Media: agenda priorizada, fichas con evidencia y borradores para revisión humana, a partir de noticias públicas e indicadores oficiales.",
  keywords: ["TVN", "editorial", "evidencia", "noticias", "Panamá", "agente"],
  icons: { icon: "/marca/tvn-circulo.png", apple: "/marca/tvn-circulo.png" },
};

export const viewport: Viewport = {
  themeColor: "#00466f",
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content", // el teclado del celular encoge la hoja en vez de taparla
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
