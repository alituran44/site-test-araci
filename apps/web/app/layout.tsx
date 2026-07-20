import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebAudit AI — Yapay Zekâ Destekli Web Denetim Platformu",
  description: "Web sitenizi SEO, Hız, Güvenlik ve GEO açısından denetleyin, 10x AI Persona ile test edin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
