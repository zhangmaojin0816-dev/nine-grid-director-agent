import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "九格导演 Agent | AI 视频分镜工作台",
  description: "先判断视频类型，再生成九宫格线稿分镜、镜头策略和平台提示词。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
