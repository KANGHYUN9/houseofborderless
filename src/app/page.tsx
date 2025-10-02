"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import rawManifest from "@/photos.manifest.json";
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

/* ------------------------ Swiper tuning constants ------------------------ */
const SWIPER_TUNING = {
    speed: 300, // animation duration; slower values feel heavier
    threshold: 36, // minimum finger movement in px to avoid accidental swipes
    touchRatio: 0.6, // movement ratio between finger and slide (lower is less sensitive)
    longSwipesRatio: 0.35, // required distance for a long swipe, tuned for weightier gestures
    resistanceRatio: 0.8, // edge resistance
    mousewheel: {
        forceToAxis: true, // reduce vertical scroll interference
        releaseOnEdges: true, // hand off scrolling back to the page at edges
        sensitivity: 0.3, // lower wheel and trackpad sensitivity
        thresholdDelta: 40, // ignore tiny wheel deltas below this value
    },
} as const;
const SWIPE_LOCK_MS = SWIPER_TUNING.speed + 180; // prevent more than one slide per gesture

type LoopingSwiperControls = {
    index: number;
    setIndex: (value: number) => void;
    attachSwiper: (swiper: SwiperType) => void;
    handleSlideChange: (swiper: SwiperType) => void;
    slidePrev: () => void;
    slideNext: () => void;
    slideTo: (target: number, speed?: number) => void;
    resetLock: () => void;
};

function useLoopingSwiper(total: number): LoopingSwiperControls {
    const [index, setIndexState] = useState(0);
    const swiperRef = useRef<SwiperType | null>(null);
    const lastRealIdxRef = useRef(0);
    const clampGuardRef = useRef(false);
    const gestureLockRef = useRef(0);

    const setSyncedIndex = useCallback(
        (value: number) => {
            const limit = Math.max(0, total);
            if (limit <= 0) {
                lastRealIdxRef.current = 0;
                setIndexState(0);
                return;
            }
            const normalized = ((value % limit) + limit) % limit;
            lastRealIdxRef.current = normalized;
            setIndexState(normalized);
        },
        [total]
    );

    useEffect(() => {
        if (total <= 0) {
            lastRealIdxRef.current = 0;
            setIndexState(0);
            return;
        }
        if (index >= total) {
            setSyncedIndex(total - 1);
        }
    }, [index, setSyncedIndex, total]);

    const handleSlideChange = useCallback(
        (sw: SwiperType) => {
            const now = Date.now();
            if (gestureLockRef.current && now < gestureLockRef.current) {
                clampGuardRef.current = true;
                sw.slideToLoop(lastRealIdxRef.current, SWIPER_TUNING.speed);
                return;
            }

            if (total <= 1) {
                setSyncedIndex(sw.realIndex);
                return;
            }

            if (clampGuardRef.current) {
                clampGuardRef.current = false;
                setSyncedIndex(sw.realIndex);
                return;
            }

            const prev = lastRealIdxRef.current;
            const next = sw.realIndex;
            const diff = getShortestLoopDelta(prev, next, total);

            if (Math.abs(diff) > 1) {
                const direction = diff > 0 ? 1 : -1;
                const target = (prev + direction + total) % total;
                clampGuardRef.current = true;
                setSyncedIndex(target);
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
                setSyncedIndex(next);
            }
        },
        [setSyncedIndex, total]
    );

    const attachSwiper = useCallback((swiper: SwiperType) => {
        swiperRef.current = swiper;
    }, []);

    const slidePrev = useCallback(() => {
        swiperRef.current?.slidePrev();
    }, []);

    const slideNext = useCallback(() => {
        swiperRef.current?.slideNext();
    }, []);

    const slideTo = useCallback(
        (target: number, speed: number = SWIPER_TUNING.speed) => {
            setSyncedIndex(target);
            const swiper = swiperRef.current;
            if (!swiper) return;
            swiper.slideToLoop(lastRealIdxRef.current, speed);
        },
        [setSyncedIndex]
    );

    const resetLock = useCallback(() => {
        clampGuardRef.current = false;
        gestureLockRef.current = 0;
    }, []);

    return {
        index,
        setIndex: setSyncedIndex,
        attachSwiper,
        handleSlideChange,
        slidePrev,
        slideNext,
        slideTo,
        resetLock,
    };
}

function useBodyScrollLock(locked: boolean) {
    useEffect(() => {
        if (typeof window === "undefined" || !locked) return;
        const body = document.body;
        const stored = {
            position: body.style.position,
            top: body.style.top,
            width: body.style.width,
            overflow: body.style.overflow,
        };
        const top = window.scrollY;

        body.style.position = "fixed";
        body.style.top = `-${top}px`;
        body.style.width = "100%";
        body.style.overflow = "hidden";

        return () => {
            body.style.position = stored.position;
            body.style.top = stored.top;
            body.style.width = stored.width;
            body.style.overflow = stored.overflow;
            window.scrollTo(0, top);
        };
    }, [locked]);
}

/* --------------------------------- Tabs ---------------------------------- */
type Tab = "about" | "photos";
const DEFAULT_TAB: Tab = "about";

function useHashTab(): [Tab | null, (t: Tab) => void] {
    const read = (): Tab => {
        if (typeof window === "undefined") return DEFAULT_TAB;
        const h = window.location.hash.replace("#", "");
        return (h === "about" || h === "photos" ? h : DEFAULT_TAB) as Tab;
    };
    // Initialize to null to avoid SSR flash
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
function TopNav({ active, onGoto }: { active: Tab; onGoto: (t: Tab) => void }) {
    const LinkBtn = ({ t, label }: { t: Tab; label: string }) => {
        const isActive = active === t;
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
/** Compact photo viewer that keeps a 16:10 box with Swiper */
export function PhotosViewer({ onOpenLightbox }: { onOpenLightbox: (index: number) => void }) {
    const total = PHOTOS.length;
    const controls = useLoopingSwiper(total);

    // Handle empty photo manifests
    if (total === 0) {
        return (
            <section className="w-full">
                <div className="flex items-center justify-center h-[50vh] border border-neutral-300">
                    <p className="text-neutral-500 text-sm">No photos available.</p>
                </div>
            </section>
        );
    }

    const openLightbox = () => onOpenLightbox(controls.index);

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
                {/* Top controls */}
                <div className="flex items-center justify-between text-[14px] text-black mb-2 select-none">
                    <span>
                        {controls.index + 1} of {total}
                    </span>
                    <div className="flex items-center gap-3">
                        <button onClick={controls.slidePrev} aria-label="prev" className="p-2 hover:opacity-70 text-lg">
                            ‹
                        </button>
                        <button onClick={controls.slideNext} aria-label="next" className="p-2 hover:opacity-70 text-lg">
                            ›
                        </button>
                    </div>
                </div>

                {/* Swiper frame maintains 16:10 cover layout */}
                <div className="relative w-full aspect-[16/10] max-h-[72vh] border border-neutral-300 overflow-hidden bg-white min-w-0">
                    <Swiper
                        modules={[Keyboard, Mousewheel]}
                        className="h-full w-full"
                        onSwiper={controls.attachSwiper}
                        speed={SWIPER_TUNING.speed}
                        threshold={SWIPER_TUNING.threshold}
                        touchRatio={SWIPER_TUNING.touchRatio}
                        longSwipesRatio={SWIPER_TUNING.longSwipesRatio}
                        resistanceRatio={SWIPER_TUNING.resistanceRatio}
                        freeMode={false}
                        slidesPerView={1}
                        centeredSlides={false}
                        mousewheel={{
                            ...SWIPER_TUNING.mousewheel,
                            thresholdDelta: 50, // avoid inertial double-slide jumps
                        }}
                        spaceBetween={0}
                        grabCursor
                        keyboard={{ enabled: true, onlyInViewport: true }}
                        loop={true}
                        observer
                        observeParents
                        /* Keep React state aligned with Swiper */
                        initialSlide={controls.index}
                        onSlideChange={controls.handleSlideChange}
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
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [fadeState, setFadeState] = useState<"in" | "out">("in");

    const totalPhotos = PHOTOS.length;
    const {
        index: lightboxIdx,
        setIndex: setLightboxIndex,
        attachSwiper: attachLightboxSwiper,
        handleSlideChange: handleLightboxSlideChange,
        slidePrev: lightboxSlidePrev,
        slideNext: lightboxSlideNext,
        resetLock: resetLightboxLock,
    } = useLoopingSwiper(totalPhotos);

    useBodyScrollLock(lightboxOpen);

    if (!tab) {
        // Render a blank screen to avoid SSR flashes before mount
        return <div className="min-h-screen bg-white"></div>;
    }

    const openLightbox = (index: number) => {
        resetLightboxLock();
        setLightboxIndex(index);
        setFadeState("out");
        setLightboxOpen(true);
        requestAnimationFrame(() => setFadeState("in"));
    };

    const closeLightbox = () => {
        setFadeState("out");
        resetLightboxLock();
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
                <TopNav active={tab} onGoto={setTab} />

                <div className="flex-1 pb-8 safe-bottom">
                    <div className="px-6 sm:px-8">
                        <FadeMount key={tab}>
                            {tab === "about" ? <AboutContent /> : <PhotosViewer onOpenLightbox={openLightbox} />}
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
                    {/* Top controls remain anchored */}
                    <div className="absolute top-0 left-0 right-0 z-10 h-[64px] flex items-center justify-between px-6 text-black text-[16px] select-none">
                        <span>
                            {lightboxIdx + 1} of {totalPhotos}
                        </span>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    lightboxSlidePrev();
                                }}
                                aria-label="prev"
                                className="p-2 hover:opacity-80 text-[23px]"
                            >
                                ‹
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    lightboxSlideNext();
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

                    {/* Keyboard navigation */}
                    <LightboxKeyHandler onPrev={lightboxSlidePrev} onNext={lightboxSlideNext} onClose={closeLightbox} />

                    {/* Content wrapper leaves room for the header so Swiper fills the rest */}
                    <div
                        className="absolute inset-0 pt-[64px] pb-[24px] px-4 pointer-events-none"
                        style={{
                            paddingTop: "calc(64px + env(safe-area-inset-top, 0px))",
                            paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
                        }}
                    >
                        {/* Center the viewer */}
                        <div className="w-full h-full grid place-items-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                            {/* Provide an explicit height so Swiper can fill it */}
                            <div
                                className="lightbox-swiper w-full h-full min-w-0"
                                style={{
                                    height: "calc(100vh - 64px - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
                                    maxWidth: "calc(100vw - 2rem)",
                                }}
                            >
                                <Swiper
                                    modules={[Keyboard, Mousewheel]}
                                    className="w-full h-full" // ensure Swiper stretches to available height
                                    onSwiper={attachLightboxSwiper}
                                    speed={SWIPER_TUNING.speed}
                                    threshold={SWIPER_TUNING.threshold}
                                    touchRatio={SWIPER_TUNING.touchRatio}
                                    longSwipesRatio={SWIPER_TUNING.longSwipesRatio}
                                    resistanceRatio={SWIPER_TUNING.resistanceRatio}
                                    freeMode={false}
                                    slidesPerView={1}
                                    slidesPerGroup={1}
                                    centeredSlides={false}
                                    /* Prevent the next slide from bleeding through */
                                    spaceBetween={0}
                                    roundLengths={true}
                                    loop={true}
                                    loopAdditionalSlides={2}
                                    mousewheel={{
                                        ...SWIPER_TUNING.mousewheel,
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
    return <div className={["transition-opacity duration-800", show ? "opacity-100" : "opacity-0"].join(" ")}>{children}</div>;
}
