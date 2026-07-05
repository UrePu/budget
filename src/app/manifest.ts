// PWA 매니페스트 — 크롬 "앱 설치" 요건: name, icons(192/512), start_url, display.
// /manifest.webmanifest 로 서빙되며 proxy.ts 에서 인증 예외 처리되어 있어야 한다.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "메소 가계부",
    short_name: "메소 가계부",
    description: "메이플스토리 메소와 원화를 함께 기록하는 개인 가계부",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f6f8",
    theme_color: "#f5f6f8",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
