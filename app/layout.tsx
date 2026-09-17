import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const sans = Noto_Sans_SC({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "滑记",
  title: "滑记",
  description: "间隔复习 · 记忆卡片 · 学习社区",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "滑记", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2aa89a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={`${sans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#d7e4df] font-sans text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
