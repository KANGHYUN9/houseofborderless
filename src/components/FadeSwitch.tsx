"use client";

import React, { useEffect, useState } from "react";

type FadeSwitchProps = {
    activeKey: string; // 탭, 라우트 등 유니크한 값
    children: React.ReactNode; // 바꿀 내용
    duration?: number; // 애니메이션 시간 (ms)
};

export default function FadeSwitch({ activeKey, children, duration = 250 }: FadeSwitchProps) {
    const [displayed, setDisplayed] = useState(children);
    const [fadeState, setFadeState] = useState<"in" | "out">("in");

    useEffect(() => {
        setFadeState("out"); // 먼저 fadeOut
        const timeout = setTimeout(() => {
            setDisplayed(children); // 실제 컨텐츠 교체
            setFadeState("in"); // 다시 fadeIn
        }, duration);
        return () => clearTimeout(timeout);
    }, [activeKey, children, duration]);

    return <div className={`transition-opacity duration-${duration} ${fadeState === "in" ? "opacity-100" : "opacity-0"}`}>{displayed}</div>;
}
