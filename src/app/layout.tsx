import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

// 메이플스토리 서체 (넥슨 무료 배포, Light/Bold 2종) — 셀프 호스팅.
// 중간 굵기(400~500)는 Light, 굵은 쪽(600~800)은 Bold 로 매핑한다.
// 서체에 없는 글리프(특수문자 등)는 Pretendard 폴백으로 처리.
const maple = localFont({
  src: [
    {
      path: "../fonts/Maplestory-Light.woff2",
      weight: "300 500",
      style: "normal",
    },
    {
      path: "../fonts/Maplestory-Bold.woff2",
      weight: "600 800",
      style: "normal",
    },
  ],
  variable: "--font-maple",
  display: "swap",
});

export const metadata: Metadata = {
  title: "메소 가계부",
  description: "메이플스토리 메소와 원화를 함께 기록하는 개인 가계부",
  applicationName: "메소 가계부",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${maple.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
