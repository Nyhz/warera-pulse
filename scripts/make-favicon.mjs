import sharp from "sharp";

// Source: the candidate logo (white background, lots of padding).
const SRC = "scripts/favicon-candidate.png";

// 1) Trim the transparent padding around the logo (keep the alpha channel).
const trimmed = await sharp(SRC).trim({ threshold: 10 }).png().toBuffer();
const m = await sharp(trimmed).metadata();

// 2) Square it on a TRANSPARENT canvas, centered, with a little breathing room.
const side = Math.round(Math.max(m.width, m.height) * 1.12);
const square = await sharp({
  create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: trimmed, gravity: "center" }])
  .png()
  .toBuffer();

// 3) Emit the favicon (Next serves app/icon.png) + the Apple touch icon.
//    Both keep transparency — no background added.
await sharp(square).resize(256, 256).png().toFile("app/icon.png");
await sharp(square).resize(180, 180).png().toFile("app/apple-icon.png");

console.log(`trimmed ${m.width}x${m.height} -> square ${side} -> app/icon.png (256), app/apple-icon.png (180)`);
