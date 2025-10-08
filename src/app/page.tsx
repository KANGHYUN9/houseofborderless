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

const preloadedSrcs = new Set<string>();

function preloadImage(src: string) {
    if (typeof window === "undefined") return;
    if (!src || preloadedSrcs.has(src)) return;
    const img = new window.Image();
    img.src = src;
    preloadedSrcs.add(src);
}

function usePhotoPreload(photos: PhotoItem[], currentIndex: number, radius = 2) {
    useEffect(() => {
        if (!photos.length || typeof window === "undefined") return;
        const total = photos.length;
        const safeIndex = ((currentIndex % total) + total) % total;

        preloadImage(photos[safeIndex]?.src);

        for (let offset = 1; offset <= radius; offset += 1) {
            const next = (safeIndex + offset) % total;
            const prev = (safeIndex - offset + total) % total;
            preloadImage(photos[next]?.src ?? "");
            preloadImage(photos[prev]?.src ?? "");
        }
    }, [photos, currentIndex, radius]);
}

function normalizePath(src: string) {
    if (!src) return src;
    const s = src
        .replace(/^https?:\/\/[^/]+/i, "")
        .replace(/[\\]+/g, "/")
        .replace(/[#?].*$/, "");
    return s.startsWith("/") ? s : `/${s}`;
}
const NORM_PHOTOS: PhotoItem[] = PHOTOS.map((p) => ({ ...p, src: normalizePath(p.src) }));

function getShortestLoopDelta(prev: number, next: number, total: number) {
    if (total <= 1) return next - prev;
    let diff = next - prev;
    const half = total / 2;
    if (diff > half) diff -= total;
    if (diff < -half) diff += total;
    return diff;
}

/* ----------------------- Build groups from file paths --------------------- */
type PhotoGroup = {
    id: string; // 폴더명
    label: string; // 탭 라벨
    title?: string;
    description?: string;
    indices: number[]; // PHOTOS의 전역 인덱스
};

const PHOTOS_BASE_DIR = "photos"; // public/photos 하위 폴더명

function pathSegmentsAbs(abs: string) {
    return abs.replace(/^\/+/, "").split("/");
}

function buildGroupsFromPaths(
    baseDir: string | null,
    depth = 0,
    labels: Record<string, { label?: string; title?: string; description?: string }> = {},
    order?: string[]
) {
    const map = new Map<string, number[]>();
    NORM_PHOTOS.forEach((p, idx) => {
        const segs = pathSegmentsAbs(p.src);
        let start = 0;
        if (baseDir) {
            const i = segs.findIndex((s) => s.toLowerCase() === baseDir.toLowerCase());
            start = i >= 0 ? i + 1 : 0;
        }
        const key = segs[start + depth] || "misc";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(idx);
    });
    const keys = order
        ? order.filter((k) => map.has(k)).concat([...map.keys()].filter((k) => !order.includes(k)).sort())
        : [...map.keys()].sort();
    return keys.map((k) => ({
        id: k,
        label: labels[k]?.label ?? k,
        title: labels[k]?.title,
        description: labels[k]?.description,
        indices: map.get(k)!,
    }));
}

/* -------- Optional: 폴더명 → 한국어 라벨/설명 매핑 -------- */
const GROUP_LABELS: Record<string, { label?: string; title?: string; description?: string }> = {
    atrium: {
        label: "중정",
        description: `집의 한가운데 자리한 ‘수공간’입니다. \n원형 하늘을 열어둔 이 공간은 건축의 중심이자, 방과 공간을 이어주는 축이 됩니다. 단순한 장식이 아니라 빛과 바람이 드나드는 열린 장치입니다.`,
    },
    room: {
        label: "룸",
        description: `제주의 전통 민가 배열에서 영감을 얻었습니다. \n안거리, 밖거리처럼 각각 독립적인 방이 수공간을 중심으로 연결되어, 닫힌 집이 아니라 열린 풍경 속 집을 보여줍니다.`,
    },
    exterior: {
        label: "외부",
        description: `멀리서 보면 눈 덮인 한라산을 닮았습니다. \n올레길 같은 좁고 깊은 길을 지나면, 제주의 돌담과 향기를 따라 수공간, 곧 백록담 같은 풍경에 닿게 됩니다.`,
    },
    pool: {
        label: "수영장",
        description: `폭 4m, 길이 11m의 긴 수영장은 하늘과 구름을 고스란히 담습니다. \n높은 돌담이 둘러싸고 있어 고요하면서도 압도적인 분위기를 줍니다.\n   `,
    },
};

const GROUPS: PhotoGroup[] = buildGroupsFromPaths(
    PHOTOS_BASE_DIR,
    0,
    GROUP_LABELS,
    ["atrium", "room", "exterior", "pool"] // 탭 순서
);

/* ------------------------ Swiper tuning constants ------------------------ */
const SWIPER_TUNING = {
    speed: 480, // transition animation duration (ms). ~480ms feels smooth and weighty without being sluggish
    threshold: 70, // minimum swipe distance (px) required to trigger a slide. Lower = easier to swipe
    touchRatio: 0.4, // ratio between finger movement and slide movement. Higher = more responsive, lower = heavier
    longSwipesRatio: 1.2, // how far the user must swipe (relative to slide width) to trigger a long swipe
    longSwipesMs: 220, // maximum duration (ms) of a swipe gesture to be considered a "long swipe"
    resistance: true, // enable edge resistance when swiping past the first/last slide
    resistanceRatio: 0.72, // how strong the edge resistance feels (0 = no resistance, 1 = very strong)
    followFinger: true, // whether the slide follows the finger during drag
    shortSwipes: true, // allow short quick swipes to trigger slide changes
    simulateTouch: true, // allow mouse events to simulate touch interactions
    mousewheel: {
        forceToAxis: true,
        releaseOnEdges: true,
        sensitivity: 3.0, // super light — even the tiniest swipe triggers
        thresholdDelta: 5, // almost no movement needed
        thresholdTime: 80, // very short cooldown, back-to-back swipes feel instant
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
    const [attachedSwiper, setAttachedSwiper] = useState<SwiperType | null>(null);
    const lastRealIdxRef = useRef(0);
    const clampGuardRef = useRef(false);
    const gestureLockRef = useRef(0);
    const totalRef = useRef(total);

    useEffect(() => {
        totalRef.current = total;
    }, [total]);

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
        if (swiperRef.current === swiper) return;
        swiperRef.current = swiper;
        setAttachedSwiper(swiper);
    }, []);

    useEffect(() => {
        if (!attachedSwiper) return;

        const touchEndHandler = (swiper: SwiperType) => {
            const totalSlides = totalRef.current;
            if (!swiper || totalSlides <= 1) return;

            const prev = lastRealIdxRef.current;
            const current = swiper.realIndex;
            const diff = getShortestLoopDelta(prev, current, totalSlides);

            if (Math.abs(diff) <= 1) return;

            const direction = diff > 0 ? 1 : -1;
            const target = (prev + direction + totalSlides) % totalSlides;

            clampGuardRef.current = true;
            gestureLockRef.current = Date.now() + SWIPE_LOCK_MS;
            setSyncedIndex(target);
            swiper.slideToLoop(target, SWIPER_TUNING.speed);
        };

        attachedSwiper.on("touchEnd", touchEndHandler);

        return () => {
            attachedSwiper.off("touchEnd", touchEndHandler);
        };
    }, [attachedSwiper, setSyncedIndex]);

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
                    "cursor-pointer",
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
                    href="https://www.stayfolio.com/findstay/house-of-borderless?utm_source=link&utm_medium=share&utm_campaign=findstay&utm_content=house-of-borderless"
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
                여기서 묻습니다. “당신의 경계는 어디까지인가?”
                <br />
                보더리스는 낯선 경험을 허락합니다. 창밖의 자연을 바라보는 순간,일상에서는 상상조차 하지 못했던 자유를 느낍니다. 이곳은
                익숙한 질서를 부드럽게 흔들며,당신의 감각을 새롭게 여는 공간입니다.
            </p>
        </article>
    );
}

/* ------------------------------ Photos Viewer ---------------------------- */
/** Compact photo viewer that keeps a 16:10 box with Swiper */
export function PhotosViewer({
    photos,
    onOpenLightbox,
    swiperKey,
}: {
    photos: PhotoItem[];
    onOpenLightbox: (groupLocalIndex: number) => void;
    swiperKey: string;
}) {
    const total = photos.length;
    const controls = useLoopingSwiper(total);
    usePhotoPreload(photos, controls.index);

    if (total === 0) {
        return (
            <section className="w-full">
                <div className="flex items-center justify-center h-[40vh] border border-neutral-300">
                    <p className="text-neutral-500 text-sm">No photos in this group.</p>
                </div>
            </section>
        );
    }

    const open = () => onOpenLightbox(controls.index);

    return (
        <section className="w-full">
            <div
                className={[
                    "relative space-y-3",
                    "w-full",
                    "md:w-[calc(100%+10vw)] md:max-w-none md:-translate-x-[10vw] md:transform",
                    "ml-auto",
                ].join(" ")}
            >
                <div className="flex items-center justify-between text-[14px] text-black mb-2 select-none">
                    <span>
                        {controls.index + 1} of {total}
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={controls.slidePrev}
                            aria-label="prev"
                            className="p-2 text-lg cursor-pointer transition-opacity hover:opacity-45"
                        >
                            ‹
                        </button>
                        <button
                            onClick={controls.slideNext}
                            aria-label="next"
                            className="p-2 text-lg cursor-pointer transition-opacity hover:opacity-45"
                        >
                            ›
                        </button>
                    </div>
                </div>

                <div className="relative w-full aspect-[16/9] border border-neutral-300 overflow-hidden bg-white min-w-0 photo-swiper">
                    <Swiper
                        key={swiperKey}
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
                        mousewheel={{ ...SWIPER_TUNING.mousewheel, thresholdDelta: 50 }}
                        spaceBetween={0}
                        grabCursor
                        keyboard={{ enabled: true, onlyInViewport: true }}
                        loop
                        observer
                        observeParents
                        initialSlide={controls.index}
                        onSlideChange={controls.handleSlideChange}
                    >
                        {photos.map((p, i) => (
                            <SwiperSlide key={p.src ?? i} className="relative h-full">
                                <div className="relative h-full w-full cursor-pointer" onClick={open}>
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

function PhotosSection({
    onOpenLightboxGroup,
}: {
    onOpenLightboxGroup: (args: { photos: PhotoItem[]; startIndex: number; groupId: string }) => void;
}) {
    const [activeId, setActiveId] = useState<string>(GROUPS[0]?.id ?? "all");
    const group = GROUPS.find((g) => g.id === activeId) ?? GROUPS[0];
    const indices = group.indices;
    const photos = indices.map((i) => NORM_PHOTOS[i]).filter(Boolean);

    const openFromGroup = (localIdx: number) => {
        onOpenLightboxGroup({ photos, startIndex: localIdx, groupId: activeId });
    };

    return (
        <div className="space-y-2.5">
            {/* 탭 */}
            <div className="max-w-[640px] mx-auto flex flex-wrap gap-x-6 md:gap-x-8 gap-y-2 items-center">
                {GROUPS.map((g) => {
                    const active = g.id === activeId;
                    return (
                        <button
                            key={g.id}
                            onClick={() => setActiveId(g.id)}
                            className={[
                                "font-ui text-[14px] md:text-[16px] underline-offset-[6px]",
                                active ? "underline" : "hover:underline",
                            ].join(" ")}
                            aria-current={active ? "page" : undefined}
                        >
                            {g.label}
                        </button>
                    );
                })}
            </div>

            <FadeMount key={activeId}>
                <div className="space-y-3">
                    {(group.title || group.description) && (
                        <div className="mx-auto max-w-[640px] max-w-[550px] h-[90px]">
                            {group.title && <div className="font-ui text-[15px] md:text-[16px] mb-2">{group.title}</div>}
                            {group.description && (
                                <p className="font-normal leading-[1.9] tracking-[0.01em] text-[clamp(11px,2.2vw,13px)] text-black/90 whitespace-pre-wrap">
                                    {group.description}
                                </p>
                            )}
                        </div>
                    )}

                    <PhotosViewer photos={photos} onOpenLightbox={openFromGroup} swiperKey={`${activeId}:${photos.length}`} />
                </div>
            </FadeMount>
        </div>
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

    /* --------------------------- Lightbox states --------------------------- */
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxSet, setLightboxSet] = useState<PhotoItem[]>([]);
    const [lightboxKey, setLightboxKey] = useState<string>(""); // Swiper reset key
    const [fadeState, setFadeState] = useState<"in" | "out">("in"); // ← 이거 추가
    const lightboxTotal = lightboxSet.length;

    const {
        index: lightboxIdx,
        setIndex: setLightboxIndex,
        attachSwiper: attachLightboxSwiper,
        handleSlideChange: handleLightboxSlideChange,
        slidePrev: lightboxSlidePrev,
        slideNext: lightboxSlideNext,
        resetLock: resetLightboxLock,
    } = useLoopingSwiper(lightboxTotal);
    usePhotoPreload(lightboxSet, lightboxIdx, 3);

    useBodyScrollLock(lightboxOpen);

    /* ...기존 스크롤 동작 useEffect와 SSR-플래시 방지 로직은 그대로... */

    if (!tab) return <div className="min-h-screen bg-white"></div>;

    // 그룹 서브셋으로 라이트박스 열기
    const openLightboxGroup = ({ photos, startIndex, groupId }: { photos: PhotoItem[]; startIndex: number; groupId: string }) => {
        resetLightboxLock();
        setLightboxSet(photos);
        setLightboxKey(`${groupId}:${photos.length}`);
        setFadeState("out");
        setLightboxOpen(true);

        // ✅ 다음 프레임에 인덱스 설정 + 페이드 인
        requestAnimationFrame(() => {
            setLightboxIndex(startIndex);
            setFadeState("in"); // ★ 이 줄이 핵심
        });
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
                            {tab === "about" ? <AboutContent /> : <PhotosSection onOpenLightboxGroup={openLightboxGroup} />}
                        </FadeMount>
                    </div>
                </div>

                <footer className="font-ui text-xs md:text-sm text-black px-10 mt-2 pb-6">
                    <div className="max-w-[var(--content)]">2024 Copyright All Rights Are Reserved.</div>
                </footer>
            </main>

            {/* --------------------------- Lightbox Overlay --------------------------- */}
            {lightboxOpen && (
                <div
                    className={`fixed inset-0 z-[999] bg-white/98 transition-opacity duration-300 ${
                        fadeState === "in" ? "opacity-100" : "opacity-0"
                    }`}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="absolute top-0 left-0 right-0 z-10 h-[64px] flex items-center justify-between px-6 text-black text-[16px] select-none">
                        <span>
                            {lightboxIdx + 1} of {lightboxTotal}
                        </span>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    lightboxSlidePrev();
                                }}
                                aria-label="prev"
                                className="p-2 text-[23px] cursor-pointer transition-opacity hover:opacity-45"
                            >
                                ‹
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    lightboxSlideNext();
                                }}
                                aria-label="next"
                                className="p-2 text-[23px] cursor-pointer transition-opacity hover:opacity-45"
                            >
                                ›
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeLightbox();
                                }}
                                aria-label="close"
                                className="ml-2 p-2 text-[20px] cursor-pointer transition-opacity hover:opacity-45"
                                title="Close (Esc)"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    <LightboxKeyHandler onPrev={lightboxSlidePrev} onNext={lightboxSlideNext} onClose={closeLightbox} />

                    <div
                        className="absolute inset-0 pt-[64px] pb-[24px] px-4 pointer-events-none"
                        style={{
                            paddingTop: "calc(64px + env(safe-area-inset-top, 0px))",
                            paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
                        }}
                    >
                        <div className="w-full h-full grid place-items-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                            <div
                                className="lightbox-swiper w-full h-full min-w-0"
                                style={{
                                    height: "calc(100vh - 64px - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
                                    maxWidth: "calc(100vw - 2rem)",
                                }}
                            >
                                <Swiper
                                    key={lightboxKey}
                                    modules={[Keyboard, Mousewheel]}
                                    className="w-full h-full"
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
                                    spaceBetween={0}
                                    roundLengths
                                    loop
                                    loopAdditionalSlides={2}
                                    mousewheel={{ ...SWIPER_TUNING.mousewheel, thresholdDelta: 50 }}
                                    observer
                                    observeParents
                                    initialSlide={lightboxIdx}
                                    onSlideChange={handleLightboxSlideChange}
                                >
                                    {lightboxSet.map((p, i) => (
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
