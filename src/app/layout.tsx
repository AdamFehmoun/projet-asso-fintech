import type { Metadata } from "next";
import "./globals.css"; // <--- C'est cette ligne qui manquait peut-être !
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Projet B - Fintech",
  description: "SaaS Association",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
