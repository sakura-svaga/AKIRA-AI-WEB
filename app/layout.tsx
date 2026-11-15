import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AKIRA AI",
  description: "Your personal AI workspace powered by TokenWave.",
  applicationName: "AKIRA AI",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AKIRA AI"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090b10",
  colorScheme: "dark"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
