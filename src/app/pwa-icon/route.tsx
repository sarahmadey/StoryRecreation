import { ImageResponse } from "next/og";

// A PNG app icon for "Add to Home Screen" (some launchers don't take SVG).
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 70%, #4a2c18, #1b110a 70%)",
        }}
      >
        <svg width="400" height="400" viewBox="0 0 48 48">
          <circle cx="24" cy="35" r="11" fill="#6b4a1a" opacity="0.6" />
          <path
            d="M24 3.5c-4.5 0-7.9 3-8.7 6.6C11.1 10.6 8.8 13.6 8.8 17c0 4 3.2 7.2 7.2 7.2h16c4 0 7.2-3.2 7.2-7.2 0-3.4-2.3-6.4-6.5-6.9C31.9 6.5 28.5 3.5 24 3.5z"
            fill="#3b2414"
            stroke="#e2b55c"
            strokeWidth="2"
          />
          <path d="M17 24.2c.4 5.7-.9 11.3-4.4 16.8h22.8c-3.5-5.5-4.8-11.1-4.4-16.8" fill="#2a1b11" stroke="#e2b55c" strokeWidth="2" />
          <path d="M19.4 41v-7.6a4.6 4.6 0 0 1 9.2 0V41z" fill="#ffcf6e" />
          <path d="M7 41.2h34" stroke="#e2b55c" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
