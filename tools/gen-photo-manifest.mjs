// tools/gen-photo-manifest.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import glob from "fast-glob";
import sharp from "sharp";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const BASE_DIR = "photos"; // public/photos
const OUT = path.join(process.cwd(), "src/photos.manifest.json");

// 허용 확장자 (대소문자/HEIC 포함)
const exts = ["jpg", "jpeg", "png", "webp", "avif", "gif", "heic", "heif"];
const pattern = `${PUBLIC_DIR}/${BASE_DIR}/**/*.{${exts.join(",")}}`;

function toPublicPath(abs) {
    const rel = path.relative(PUBLIC_DIR, abs).split(path.sep).join("/");
    return rel.startsWith("/") ? `/${rel}` : `/${rel}`;
}

async function getSize(abs) {
    try {
        const meta = await sharp(abs).metadata();
        if (!meta.width || !meta.height) throw new Error("no dimension");
        return { width: meta.width, height: meta.height };
    } catch (err) {
        console.warn("⚠️ Skip:", path.basename(abs), "-", err.message);
        return null;
    }
}

async function main() {
    const files = await glob(pattern, { caseSensitiveMatch: false, onlyFiles: true });
    console.log(`Found ${files.length} files under public/${BASE_DIR}`);

    const items = [];
    for (const abs of files) {
        const size = await getSize(abs);
        if (!size) continue;
        items.push({
            src: toPublicPath(abs),
            width: size.width,
            height: size.height,
        });
    }

    items.sort((a, b) => a.src.localeCompare(b.src, "en"));
    await fs.writeFile(OUT, JSON.stringify(items, null, 2));
    console.log(`✅ Wrote ${items.length} items → ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
