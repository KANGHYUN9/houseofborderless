import type { NextConfig } from "next";
import { EventEmitter } from "node:events";

const MAX_LISTENERS = 32;

if (typeof EventEmitter.defaultMaxListeners === "number") {
    EventEmitter.defaultMaxListeners = Math.max(EventEmitter.defaultMaxListeners, MAX_LISTENERS);
}

if (typeof process.getMaxListeners === "function" && typeof process.setMaxListeners === "function") {
    if (process.getMaxListeners() < MAX_LISTENERS) {
        process.setMaxListeners(MAX_LISTENERS);
    }
}

const nextConfig: NextConfig = {
    reactStrictMode: false,
    images: {
        deviceSizes: [320, 420, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [16, 24, 32, 48, 64, 96, 128, 256, 384],
        formats: ["image/webp", "image/avif"],
    },
};

export default nextConfig;
