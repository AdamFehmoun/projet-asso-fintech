import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Projet B Fintech",
  description: "Gestion financière pour l'ESIEE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased min-h-screen bg-background font-sans">
        {children}
      </body>
    </html>
  );
}
