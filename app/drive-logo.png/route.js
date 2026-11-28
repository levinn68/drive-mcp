import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0B0E",
          borderRadius: 56,
        }}
      >
        <svg width="220" height="220" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="drive-top" x1="16" y1="12" x2="62" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#B84CF8" />
              <stop offset="55%" stopColor="#6B3DF5" />
              <stop offset="100%" stopColor="#3B24C6" />
            </linearGradient>
            <linearGradient id="drive-bot" x1="18" y1="88" x2="62" y2="46" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0EA5FF" />
              <stop offset="55%" stopColor="#2B6BFF" />
              <stop offset="100%" stopColor="#6546F7" />
            </linearGradient>
          </defs>
          <path
            d="M23 16 H48 C70.5 16 84 30.8 84 50 C84 69.2 70.5 84 48 84 H23 V70.5 H47 C61.8 70.5 70 61.8 70 50 C70 38.2 61.8 29.5 47 29.5 H23 V16 Z"
            fill="#FFFFFF"
          />
          <path
            d="M18 19.5 C18 16.9 20.8 15.3 23.1 16.6 L56.8 40 C59.6 42 59.6 46.1 56.8 48.1 L46 55.6 L20.3 37.6 C18.8 36.6 18 35 18 33.2 V19.5 Z"
            fill="url(#drive-top)"
          />
          <path
            d="M18 66.8 C18 64.9 19 63.2 20.5 62.1 L56.7 42.8 C59 44.3 59.5 47.4 59 50.5 C58.5 53.3 57.6 55.8 55.5 57.3 L23 83.4 C20.7 84.7 18 83.1 18 80.5 V66.8 Z"
            fill="url(#drive-bot)"
          />
        </svg>
      </div>
    ),
    {
      width: 256,
      height: 256,
      headers: {
        "Cache-Control": "public, max-age=86400, immutable",
      },
    }
  );
}
