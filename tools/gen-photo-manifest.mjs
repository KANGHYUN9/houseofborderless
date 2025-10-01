import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const photosDir = path.resolve(process.cwd(), "public/photos");
const outFile = path.resolve(process.cwd(), "src/photos.manifest.json");

const exts = /\.(jpe?g|png|webp|avif)$/i;

const files = (await fs.readdir(photosDir)).filter((f) => exts.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const items = [];
for (const name of files) {
    const src = `/photos/${name}`;
    const abs = path.join(photosDir, name);

    const meta = await sharp(abs).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    // 아주 작은 블러 썸네일 생성(너비 16px) → base64 data URL
    const blurBuf = await sharp(abs).resize(16).jpeg({ quality: 50 }).toBuffer();
    const blurDataURL = `data:image/jpeg;base64,${blurBuf.toString("base64")}`;

    items.push({ src, width, height, blurDataURL });
}

await fs.writeFile(outFile, JSON.stringify(items, null, 2));
console.log(`✅ Wrote ${items.length} items → ${path.relative(process.cwd(), outFile)}`);
