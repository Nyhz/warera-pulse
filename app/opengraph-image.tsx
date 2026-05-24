import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#3fb950";
const BG = "#0a0e14";
const DIM = "#8b949e";
const FAINT = "#3d4757";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: "72px 80px",
          color: "#e6edf3",
          fontFamily: "monospace",
        }}
      >
        {/* brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 18, height: 18, borderRadius: 999, background: ACCENT }} />
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, color: ACCENT }}>
            WARERA PULSE
          </div>
          <div style={{ fontSize: 22, letterSpacing: 4, color: FAINT, marginLeft: 8 }}>
            GEO TERMINAL
          </div>
        </div>

        {/* headline + call-to-action */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, maxWidth: 1000 }}>
            Real-time market &amp; conflict terminal
          </div>
          <div style={{ fontSize: 32, color: DIM, maxWidth: 980 }}>
            Live prices, order books, candle charts, battles and hot nations for warera.io
          </div>
          <div style={{ display: "flex", marginTop: 12 }}>
            <div
              style={{
                display: "flex",
                background: ACCENT,
                color: "#06210d",
                fontSize: 28,
                fontWeight: 800,
                padding: "16px 32px",
                borderRadius: 10,
              }}
            >
              Open the live terminal →
            </div>
          </div>
        </div>

        {/* footer row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 24,
            color: FAINT,
            borderTop: `2px solid #141b26`,
            paddingTop: 28,
          }}
        >
          <div style={{ display: "flex", gap: 28 }}>
            <span style={{ color: ACCENT }}>● LIVE</span>
            <span>21 resources</span>
            <span>OHLC charts</span>
            <span>active conflicts</span>
          </div>
          <div>warera.io</div>
        </div>
      </div>
    ),
    size,
  );
}
