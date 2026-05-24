import sharp from "sharp";

// Source: the candidate logo (white background, lots of padding).
const SRC = "scripts/favicon-candidate.png";

// 1) Trim the white padding around the logo.
const trimmed = await sharp(SRC).trim({ threshold: 15 }).png().toBuffer();
const m = await sharp(trimmed).metadata();

// 2) Square it on white, centered, with a little breathing room.
const side = Math.round(Math.max(m.width, m.height) * 1.12);
const square = await sharp({
  create: { width: side, height: side, channels: 4, background: "#ffffff" },
})
  .composite([{ input: trimmed, gravity: "center" }])
  .png()
  .toBuffer();

// 3) Emit the favicon (Next serves app/icon.png) + the Apple touch icon.
await sharp(square).resize(256, 256).png().toFile("app/icon.png");
await sharp(square).resize(180, 180).flatten({ background: "#ffffff" }).png().toFile("app/apple-icon.png");

console.log(`trimmed ${m.width}x${m.height} -> square ${side} -> app/icon.png (256), app/apple-icon.png (180)`);
