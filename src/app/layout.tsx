export const metadata = {
    title: "House of Borderless",
    description: "About / Photos",
};

import "./globals.css";
import React from "react";
import localFont from "next/font/local";

/** 본문 기본(한글 + 본문 내 영문) → HY 타자전각 */
const kor = localFont({
    src: [{ path: "./fonts/HYTajaJeongakB.woff", weight: "0"}],
    variable: "--font-kor",
    display: "swap",
});

/** UI 전용(메뉴/라벨/카피 등 영어) → American Typewriter */
const ui = localFont({
    src: [
        { path: "./fonts/AmericanTypewriter-01.woff", weight: "400", style: "normal" },
        { path: "./fonts/AmericanTypewriter-Bold-03.woff", weight: "700", style: "normal" },
    ],
    variable: "--font-ui",
    display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ko" className={`${kor.variable} ${ui.variable}`}>
            {/* 기본은 HY (본문 전체). UI 글자는 .font-ui/.font-ui-bold로 오버라이드 */}
            <body className="min-h-screen bg-white text-neutral-900" style={{ fontFamily: "var(--font-kor), serif", fontWeight: 700 }}>
                {children}
            </body>
        </html>
    );
}
