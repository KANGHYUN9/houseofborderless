"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import rawManifest from "@/photos.manifest.json";

/* Swiper (pnpm add swiper) test */
import { Swiper, SwiperSlide } from "swiper/react";
import { Keyboard, Mousewheel } from "swiper/modules";
import "swiper/css"; // ensure Swiper's core layout styles are available
import type { Swiper as SwiperType } from "swiper";

/* ----------------------------- Manifest types ----------------------------- */
type PhotoItem = {
    src: string;
    width: number;
    height: number;
    blurDataURL?: string;
};
type ManifestShape = PhotoItem[] | { photos: PhotoItem[] } | { default: PhotoItem[] };

function normalizePhotos(m: ManifestShape): PhotoItem[] {
    if (Array.isArray(m)) return m;
    if ("photos" in m) return m.photos;
    if ("default" in m) return m.default;
    return [];
}
const PHOTOS: PhotoItem[] = normalizePhotos(rawManifest as ManifestShape);

function getShortestLoopDelta(prev: number, next: number, total: number) {
    if (total <= 1) return next - prev;
    let diff = next - prev;
    const half = total / 2;
    if (diff > half) diff -= total;
    if (diff < -half) diff += total;
    return diff;
}

/* ------------------------ Swiper 감도/동작 튜닝 상수 ------------------------ */
const SWIPER_TUNING = {
    speed: 300, // 커밋 애니메이션 속도(느릴수록 묵직)
    threshold: 36, // 손가락 최소 이동(px) — 실수 스와이프 방지
    touchRatio: 0.6, // 손가락 이동 대비 슬라이드 이동량(낮을수록 둔감)
    longSwipesRatio: 0.35, // 긴 스와이프 요구량(기본 0.5 → 더 묵직)
    resistanceRatio: 0.8, // 끝단 탄성
    mousewheel: {
        forceToAxis: true, // 세로 스크롤 간섭 최소화
        releaseOnEdges: true, // 끝에서 페이지 스크롤로 자연스럽게 풀기
        sensitivity: 0.3, // 휠/트랙패드 민감도 낮춤
        thresholdDelta: 40, // 이 미만의 미세 델타 무시
    },
} as const;
const SWIPE_LOCK_MS = SWIPER_TUNING.speed + 180; // 한 번의 제스처 동안 2장 이상 이동 방지

/* --------------------------------- Tabs ---------------------------------- */
type Tab = "about" | "photos";
const DEFAULT_TAB: Tab = "about";

function useHashTab(): [Tab | null, (t: Tab) => void] {
    const read = (): Tab => {
        if (typeof window === "undefined") return DEFAULT_TAB;
        const h = window.location.hash.replace("#", "");
        return (h === "about" || h === "photos" ? h : DEFAULT_TAB) as Tab;
    };
    // SSR 깜빡임 방지: 초기 null
    const [tab, setTab] = useState<Tab | null>(null);

    useEffect(() => {
        setTab(read());
        const onHash = () => setTab(read());
        window.addEventListener("hashchange", onHash);
        return () => window.removeEventListener("hashchange", onHash);
    }, []);

    const go = (t: Tab) => {
        if (typeof window !== "undefined") window.location.hash = t;
        setTab(t);
    };
    return [tab, go];
}

/* -------------------------------- Sidebar -------------------------------- */
function Sidebar() {
    return (
        <aside className="py-6 md:py-8 px-[var(--pad)] md:px-10 md:sticky md:top-0 md:h-screen select-none">
            <div className="flex items-start gap-3 px-10 md:px-[var(--pad)]">
                <div className="font-ui text-[18px]">House of</div>
                <Image
                    src="/logo.svg"
                    alt="BORDERLESS"
                    width={200}
                    height={200}
                    className="w-[200px] md:w-[200px] -mt-2 ml-auto md:ml-5 md:mr-0"
                    priority
                    draggable={false}
                />
            </div>
        </aside>
    );
}

/* ------------------------------- Top Navigation -------------------------- */
function TopNav({ active, mounted, onGoto }: { active: Tab; mounted: boolean; onGoto: (t: Tab) => void }) {
    const LinkBtn = ({ t, label }: { t: Tab; label: string }) => {
        const isActive = mounted && active === t;
        return (
            <button
                onClick={() => onGoto(t)}
                className={[
                    "font-ui py-1 underline-offset-[6px]",
                    "text-[16px] md:text-[18px]",
                    isActive ? "underline" : "hover:underline",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
            >
                {label}
            </button>
        );
    };

    return (
        <nav className="px-8 pt-4 md:pt-6 mb-6 md:mb-10" aria-label="primary">
            <div className="max-w-[640px] mx-auto flex justify-between items-center">
                <LinkBtn t="about" label="About" />
                <LinkBtn t="photos" label="Photos" />
                <a
                    href="https://example.com/reservation"
                    target="_blank"
                    rel="noreferrer"
                    className="font-ui py-1 text-[16px] md:text-[18px] hover:underline underline-offset-[6px]"
                >
                    Reservation
                </a>
            </div>
        </nav>
    );
}

/* ---------------------------------- About -------------------------------- */
function AboutContent() {
    return (
        <article className="font-normal leading-[1.9] tracking-[0.01em] mt-10 md:mt-25 text-[12px] md:text-[13px] max-w-[640px] mx-auto">
            <p className="mb-6">
                보더리스(Borderless)는 단순한 스테이가 아닙니다.
                <br />
                이곳은 당신이 스스로의 경계를 시험하고, 넘어설 수 있도록 초대하는 공간입니다.
            </p>
            <p className="mb-6">
                둥근 지붕과 사각의 벽, 서로 다른 형태가 만나 이루는 구조처럼, 보더리스는 익숙한 틀을 벗어나 새로운 감각을 마주하게 합니다.
                모호함은 곧 자유가 되고, 새로운 시도가 됩니다.
            </p>
            <p className="mb-6">
                여기서 묻습니다. “당신의 경계는 어디까지인가?” 보더리스는 낯선 경험을 허락합니다. 창밖 자연을 바라보며 멈춘 순간, 일상에서는
                상상조차 하지 못했던 자유를 맛보는 순간. 이곳은 당신의 감각을 흔들고, 익숙한 질서를 부드럽게 넘어서는 자리입니다.
            </p>
            <p>
                삼각의 회전으로 완성된 로고는 ‘경계 없음’, ‘확장’, ‘연장’의 의미를 담아, 어느 쪽이 기준인지 알 수 없는 모호함을 드러냅니다.
                그 모호함은 곧 자유가 되고, 새로운 시도가 됩니다. 그래서 우리는 정보를 추측보다 경험하는 편지처럼, 지나치게 명백하기보다,
                인간의 온기가 남아 있는 ‘타자체’와 닮은 서체를 택했습니다. 완벽한 정제 대신, 사랑의 숨결을 담은 불완전함. 그 이야기야말로
                보더리스가 전하는 메시지이자 경험입니다.
            </p>
        </article>
    );
}

/* ------------------------------ Photos Viewer ---------------------------- */
/** 작은 포토뷰어: 16:10 박스(object-cover) 유지 + Swiper 적용 */
export function PhotosViewer({
    over = 160,
    gutter = 24,
    onOpenLightbox,
}: {
    over?: number;
    gutter?: number;
    onOpenLightbox: (index: number) => void;
}) {
    const total = PHOTOS.length;
    const [idx, setIdx] = useState(0);

    // 버튼 제어용 Swiper ref
    const swiperRef = useRef<SwiperType | null>(null);
    const lastRealIdxRef = useRef(0);
    const clampGuardRef = useRef(false);
    const gestureLockRef = useRef<number>(0);

    useEffect(() => {
        lastRealIdxRef.current = idx;
    }, [idx]);

    const handleSlideChange = useCallback(
        (sw: SwiperType) => {
            const now = Date.now();
            if (gestureLockRef.current && now < gestureLockRef.current) {
                clampGuardRef.current = true;
                sw.slideToLoop(lastRealIdxRef.current, SWIPER_TUNING.speed);
                return;
            }

            if (total <= 1) {
                setIdx(sw.realIndex);
                lastRealIdxRef.current = sw.realIndex;
                return;
            }

            if (clampGuardRef.current) {
                clampGuardRef.current = false;
                setIdx(sw.realIndex);
                lastRealIdxRef.current = sw.realIndex;
                return;
            }

            const prev = lastRealIdxRef.current;
            const next = sw.realIndex;
            const diff = getShortestLoopDelta(prev, next, total);

            if (Math.abs(diff) > 1) {
                const direction = diff > 0 ? 1 : -1;
                const target = (prev + direction + total) % total;
                clampGuardRef.current = true;
                lastRealIdxRef.current = target;
                setIdx(target);
                sw.slideToLoop(target, SWIPER_TUNING.speed);
                gestureLockRef.current = now + SWIPE_LOCK_MS;
                if (typeof sw.once === "function") {
                    sw.once("transitionEnd", () => {
                        gestureLockRef.current = 0;
                    });
                } else {
                    window.setTimeout(() => {
                        gestureLockRef.current = 0;
                    }, SWIPER_TUNING.speed + 50);
                }
            } else {
                lastRealIdxRef.current = next;
                setIdx(next);
            }
        },
        [total]
    );

    // 사진 없음 처리
    if (total === 0) {
        return (
            <section className="w-full">
                <div className="flex items-center justify-center h-[50vh] border border-neutral-300">
                    <p className="text-neutral-500 text-sm">No photos available.</p>
                </div>
            </section>
        );
    }

    const openLightbox = () => onOpenLightbox(idx);

    return (
        <section className="w-full mt-10 md:mt-25">
            <div
                className={[
                    "relative space-y-3",
                    "w-full",
                    "md:w-[calc(100%+10vw)] md:max-w-none md:-translate-x-[10vw] md:transform",
                    "ml-auto",
                ].join(" ")}
            >
                {/* 상단 컨트롤 */}
                <div className="flex items-center justify-between text-[14px] text-black mb-2 select-none">
                    <span>
                        {idx + 1} of {total}
                    </span>
                    <div className="flex items-center gap-3">
                        <button onClick={() => swiperRef.current?.slidePrev()} aria-label="prev" className="p-2 hover:opacity-70 text-lg">
                            ‹
                        </button>
                        <button onClick={() => swiperRef.current?.slideNext()} aria-label="next" className="p-2 hover:opacity-70 text-lg">
                            ›
                        </button>
                    </div>
                </div>

                {/* Swiper 프레임: 16:10 + cover */}
                <div className="relative w-full aspect-[16/10] max-h-[72vh] border border-neutral-300 overflow-hidden bg-white min-w-0">
                    <Swiper
                        modules={[Keyboard, Mousewheel]}
                        className="h-full w-full"
                        onSwiper={(sw) => (swiperRef.current = sw)}
                        /* ==== 민감도/한 장씩만 넘김(트랙패드 포함) ==== */
                        speed={300}
                        threshold={36}
                        touchRatio={0.6}
                        longSwipesRatio={0.35}
                        resistanceRatio={0.8}
                        freeMode={false}
                        slidesPerView={1}
                        centeredSlides={false}
                        mousewheel={{
                            forceToAxis: true,
                            releaseOnEdges: true,
                            sensitivity: 0.3,
                            thresholdDelta: 50, // 관성으로 두 장씩 점프 방지
                        }}
                        /* ==== 슬라이드 간 간격 (틈 보임 방지에도 효과) ==== */
                        spaceBetween={0}
                        /* ==== UX ==== */
                        grabCursor
                        keyboard={{ enabled: true, onlyInViewport: true }}
                        loop={true}
                        observer
                        observeParents
                        /* 상태 동기화 */
                        initialSlide={idx}
                        onSlideChange={handleSlideChange}
                    >
                        {PHOTOS.map((p, i) => (
                            <SwiperSlide key={p.src ?? i} className="relative h-full">
                                <div className="relative h-full w-full cursor-zoom-in" onClick={openLightbox}>
                                    <Image
                                        fill
                                        src={p.src}
                                        alt={`photo ${i + 1}`}
                                        className="object-cover select-none"
                                        sizes="(min-width: 768px) 70vw, 100vw"
                                        placeholder={p.blurDataURL ? "blur" : "empty"}
                                        blurDataURL={p.blurDataURL}
                                        draggable={false}
                                        priority={i === 0}
                                    />
                                </div>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>
            </div>
        </section>
    );
}

/* --------------------------- LightboxKeyHandler --------------------------- */
function LightboxKeyHandler({ onPrev, onNext, onClose }: { onPrev: () => void; onNext: () => void; onClose: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowLeft") onPrev();
            if (e.key === "ArrowRight") onNext();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onPrev, onNext, onClose]);
    return null;
}

/* --------------------------------- Page ---------------------------------- */
export default function Page() {
    const [tab, setTab] = useHashTab();
    const [mounted, setMounted] = useState(false);

    // 라이트박스 상태
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIdx, setLightboxIdx] = useState<number>(0);
    const [fadeState, setFadeState] = useState<"in" | "out">("in");

    // 라이트박스용 Swiper ref
    const lightboxSwiperRef = useRef<SwiperType | null>(null);
    const lightboxLastIdxRef = useRef(0);
    const lightboxClampGuardRef = useRef(false);
    const totalPhotos = PHOTOS.length;
    const lightboxGestureLockRef = useRef<number>(0);
    const scrollLockRef = useRef<{
        top: number;
        style: { position: string; top: string; width: string; overflow: string };
    } | null>(null);

    useEffect(() => {
        lightboxLastIdxRef.current = lightboxIdx;
    }, [lightboxIdx]);

    const handleLightboxSlideChange = useCallback(
        (sw: SwiperType) => {
            const now = Date.now();
            if (lightboxGestureLockRef.current && now < lightboxGestureLockRef.current) {
                lightboxClampGuardRef.current = true;
                sw.slideToLoop(lightboxLastIdxRef.current, SWIPER_TUNING.speed);
                return;
            }

            if (totalPhotos <= 1) {
                setLightboxIdx(sw.realIndex);
                lightboxLastIdxRef.current = sw.realIndex;
                return;
            }

            if (lightboxClampGuardRef.current) {
                lightboxClampGuardRef.current = false;
                setLightboxIdx(sw.realIndex);
                lightboxLastIdxRef.current = sw.realIndex;
                return;
            }

            const prev = lightboxLastIdxRef.current;
            const next = sw.realIndex;
            const diff = getShortestLoopDelta(prev, next, totalPhotos);

            if (Math.abs(diff) > 1) {
                const direction = diff > 0 ? 1 : -1;
                const target = (prev + direction + totalPhotos) % totalPhotos;
                lightboxClampGuardRef.current = true;
                lightboxLastIdxRef.current = target;
                setLightboxIdx(target);
                sw.slideToLoop(target, SWIPER_TUNING.speed);
                lightboxGestureLockRef.current = now + SWIPE_LOCK_MS;
                if (typeof sw.once === "function") {
                    sw.once("transitionEnd", () => {
                        lightboxGestureLockRef.current = 0;
                    });
                } else {
                    window.setTimeout(() => {
                        lightboxGestureLockRef.current = 0;
                    }, SWIPER_TUNING.speed + 50);
                }
            } else {
                lightboxLastIdxRef.current = next;
                setLightboxIdx(next);
            }
        },
        [setLightboxIdx, totalPhotos]
    );

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const body = document.body;

        if (lightboxOpen) {
            const currentTop = window.scrollY;
            scrollLockRef.current = {
                top: currentTop,
                style: {
                    position: body.style.position,
                    top: body.style.top,
                    width: body.style.width,
                    overflow: body.style.overflow,
                },
            };

            body.style.position = "fixed";
            body.style.top = `-${currentTop}px`;
            body.style.width = "100%";
            body.style.overflow = "hidden";

            return () => {
                const stored = scrollLockRef.current;
                if (!stored) return;
                body.style.position = stored.style.position;
                body.style.top = stored.style.top;
                body.style.width = stored.style.width;
                body.style.overflow = stored.style.overflow;
                window.scrollTo(0, stored.top);
                scrollLockRef.current = null;
            };
        }

        const stored = scrollLockRef.current;
        if (!stored) return;
        body.style.position = stored.style.position;
        body.style.top = stored.style.top;
        body.style.width = stored.style.width;
        body.style.overflow = stored.style.overflow;
        window.scrollTo(0, stored.top);
        scrollLockRef.current = null;
    }, [lightboxOpen]);

    if (!tab) {
        // 마운트 전 빈 화면으로 SSR 깜빡임 방지
        return <div className="min-h-screen bg-white"></div>;
    }

    const closeLightbox = () => {
        setFadeState("out");
        setTimeout(() => setLightboxOpen(false), 300);
    };

    return (
        <div className="min-h-screen bg-white text-neutral-900 grid grid-cols-1 md:grid-cols-2">
            <Sidebar />
            <main
                className={[
                    "flex flex-col min-h-screen",
                    "[--pad:20px] sm:[--pad:24px] md:[--pad:64px] lg:[--pad:80px]",
                    "[--content:520px] md:[--content:560px] lg:[--content:620px]",
                    "lg:pr-6 md:pr-12",
                ].join(" ")}
            >
                <TopNav active={tab} mounted={true} onGoto={setTab} />

                <div className="flex-1 pb-8 safe-bottom">
                    <div className="px-6 sm:px-8">
                        <FadeMount key={tab}>
                            {tab === "about" ? (
                                <AboutContent />
                            ) : (
                                <PhotosViewer
                                    onOpenLightbox={(i) => {
                                        setLightboxIdx(i);
                                        lightboxLastIdxRef.current = i;
                                        lightboxGestureLockRef.current = 0;
                                        setFadeState("out");
                                        setLightboxOpen(true);
                                        requestAnimationFrame(() => setFadeState("in"));
                                    }}
                                />
                            )}
                        </FadeMount>
                    </div>
                </div>

                <footer className="font-ui text-xs md:text-sm text-black px-10 pb-6">
                    <div className="max-w-[var(--content)]">2024 Copyright All Rights Are Reserved.</div>
                </footer>
            </main>

            {/* --------------------------- Lightbox Overlay --------------------------- */}
            {lightboxOpen && (
                <div
                    className={`fixed inset-0 z-[999] bg-white/98 transition-opacity duration-300
  ${fadeState === "in" ? "opacity-100" : "opacity-0"}`}
                    onClick={closeLightbox}
                    role="dialog"
                    aria-modal="true"
                >
                    {/* 상단 컨트롤 (원래 위치 유지) */}
                    <div className="absolute top-0 left-0 right-0 z-10 h-[64px] flex items-center justify-between px-6 text-black text-[16px] select-none">
                        <span>
                            {lightboxIdx + 1} of {totalPhotos}
                        </span>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    lightboxSwiperRef.current?.slidePrev();
                                }}
                                aria-label="prev"
                                className="p-2 hover:opacity-80 text-[23px]"
                            >
                                ‹
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    lightboxSwiperRef.current?.slideNext();
                                }}
                                aria-label="next"
                                className="p-2 hover:opacity-80 text-[23px]"
                            >
                                ›
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeLightbox();
                                }}
                                aria-label="close"
                                className="ml-2 p-2 hover:opacity-80 text-[20px]"
                                title="Close (Esc)"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* 키보드 내비 */}
                    <LightboxKeyHandler
                        onPrev={() => lightboxSwiperRef.current?.slidePrev()}
                        onNext={() => lightboxSwiperRef.current?.slideNext()}
                        onClose={closeLightbox}
                    />

                    {/* ✅ 컨텐츠 래퍼: 상단바 높이만큼 패딩 → 남은 영역을 Swiper가 꽉 채움 */}
                    <div
                        className="absolute inset-0 pt-[64px] pb-[24px] px-4 pointer-events-none"
                        style={{
                            paddingTop: "calc(64px + env(safe-area-inset-top, 0px))",
                            paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
                        }}
                    >
                        {/* 가운데 정렬 래퍼 */}
                        <div className="w-full h-full grid place-items-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                            {/* ⬇️ 여기서 정확한 높이를 계산해 Swiper에 h-full 전달 */}
                            <div
                                className="lightbox-swiper w-full h-full min-w-0"
                                style={{
                                    height: "calc(100vh - 64px - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
                                    maxWidth: "calc(100vw - 2rem)",
                                }}
                            >
                                <Swiper
                                    modules={[Keyboard, Mousewheel]}
                                    className="w-full h-full" // ⬅️ h-full만
                                    onSwiper={(sw) => (lightboxSwiperRef.current = sw)}
                                    /* 민감도/한장씩 */
                                    speed={SWIPER_TUNING.speed}
                                    threshold={SWIPER_TUNING.threshold}
                                    touchRatio={SWIPER_TUNING.touchRatio}
                                    longSwipesRatio={SWIPER_TUNING.longSwipesRatio}
                                    resistanceRatio={SWIPER_TUNING.resistanceRatio}
                                    freeMode={false}
                                    slidesPerView={1}
                                    slidesPerGroup={1}
                                    centeredSlides={false}
                                    /* 다음 슬라이드 비침 방지 */
                                    spaceBetween={0}
                                    roundLengths={true}
                                    loop={true}
                                    loopAdditionalSlides={2}
                                    mousewheel={{
                                        forceToAxis: true,
                                        releaseOnEdges: true,
                                        sensitivity: 0.3,
                                        thresholdDelta: 50,
                                    }}
                                    observer
                                    observeParents
                                    initialSlide={lightboxIdx}
                                    onSlideChange={handleLightboxSlideChange}
                                >
                                    {PHOTOS.map((p, i) => (
                                        <SwiperSlide key={p.src ?? i} className="flex items-center justify-center h-full">
                                            <div className="relative h-full w-full">
                                                <Image
                                                    fill
                                                    src={p.src}
                                                    alt={`photo ${i + 1}`}
                                                    className="object-contain select-none"
                                                    sizes="100vw"
                                                    placeholder={p.blurDataURL ? "blur" : "empty"}
                                                    blurDataURL={p.blurDataURL}
                                                    draggable={false}
                                                    priority={i === lightboxIdx}
                                                />
                                            </div>
                                        </SwiperSlide>
                                    ))}
                                </Swiper>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function FadeMount({ children }: { children: React.ReactNode }) {
    const [show, setShow] = useState(false);
    useEffect(() => {
        const id = requestAnimationFrame(() => setShow(true));
        return () => cancelAnimationFrame(id);
    }, []);
    return <div className={["transition-opacity duration-500", show ? "opacity-100" : "opacity-0"].join(" ")}>{children}</div>;
}
