import { ImageResponse } from "next/og";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const size = 512;

const variants = {
  signal: { bg: "#1b1110", accent: "#f97316", second: "#ffd166", mark: "SIG" },
  oracle: { bg: "#10191f", accent: "#2dd4bf", second: "#7dd3fc", mark: "ORC" },
  vault: { bg: "#141612", accent: "#84cc16", second: "#f8fafc", mark: "VLT" },
  cast: { bg: "#171226", accent: "#8b5cf6", second: "#f0abfc", mark: "CST" },
  neon: { bg: "#09090b", accent: "#22c55e", second: "#fb7185", mark: "NEO" },
} as const;

type VariantKey = keyof typeof variants;

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const variantKey = normalizeVariant(searchParams.get("variant"));
  const handle = normalizeHandle(searchParams.get("handle"));
  const variant = variants[variantKey];

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: variant.bg,
          color: "#f8fafc",
          display: "flex",
          fontFamily: "Inter, Arial, sans-serif",
          height: "100%",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background: variant.accent,
            borderRadius: 999,
            filter: "blur(4px)",
            height: 430,
            opacity: 0.16,
            position: "absolute",
            right: -120,
            top: -80,
            width: 430,
          }}
        />
        <div
          style={{
            background: variant.second,
            borderRadius: 999,
            bottom: -90,
            height: 260,
            left: -80,
            opacity: 0.16,
            position: "absolute",
            width: 260,
          }}
        />
        <div
          style={{
            alignItems: "center",
            border: "4px solid rgba(255,255,255,0.14)",
            borderRadius: 64,
            display: "flex",
            flexDirection: "column",
            gap: 24,
            height: 390,
            justifyContent: "center",
            padding: 36,
            position: "relative",
            width: 390,
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: variant.accent,
              border: "3px solid rgba(255,255,255,0.32)",
              borderRadius: 999,
              color: "#0b0b0b",
              display: "flex",
              fontSize: 72,
              fontWeight: 950,
              height: 174,
              justifyContent: "center",
              letterSpacing: 0,
              width: 174,
            }}
          >
            {variant.mark}
          </div>
          <div
            style={{
              color: variant.second,
              fontSize: 30,
              fontWeight: 900,
              maxWidth: 320,
              overflow: "hidden",
              textAlign: "center",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {handle}
          </div>
          <div
            style={{
              color: "rgba(248,250,252,0.66)",
              fontSize: 20,
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            Conviction Markets
          </div>
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}

function normalizeVariant(value: string | null): VariantKey {
  return value && value in variants ? (value as VariantKey) : "signal";
}

function normalizeHandle(value: string | null) {
  const clean = (value ?? "yourname.viction").replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 48);

  return clean || "yourname.viction";
}
