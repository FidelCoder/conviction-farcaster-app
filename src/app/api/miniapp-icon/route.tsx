import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isSplash = searchParams.get("size") === "splash";
  const size = isSplash ? 200 : 1024;

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#f7f7f2",
          color: "#126149",
          display: "flex",
          fontSize: isSplash ? 82 : 430,
          fontWeight: 800,
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        CM
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, immutable, no-transform, max-age=31536000",
      },
    },
  );
}
