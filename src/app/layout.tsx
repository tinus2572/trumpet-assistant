import type { Metadata } from "next";
import { Archivo_Black, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  weight: "400",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trumpet Assistant",
  description: "Pitch analyzer for Bb trumpet",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${spaceGrotesk.variable} ${archivoBlack.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
