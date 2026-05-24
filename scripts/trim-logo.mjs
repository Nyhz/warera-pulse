import sharp from "sharp";

const SRC = "public/warera-pulse-logo.webp";
const OUT = "public/logo.webp";

const trimmed = sharp(SRC).trim({ threshold: 10 });
const buf = await trimmed.resize({ height: 160 }).webp({ quality: 90 }).toBuffer();
await sharp(buf).toFile(OUT);

const meta = await sharp(OUT).metadata();
console.log(`wrote ${OUT}: ${meta.width}x${meta.height}, ${buf.length} bytes`);
