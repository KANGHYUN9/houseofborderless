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
};

export default nextConfig;
