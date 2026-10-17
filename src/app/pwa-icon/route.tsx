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
          background: "radial-gradient(circle at 50% 55%, #4a2c18, #1b110a 70%)",
        }}
      >
        <svg width="380" height="380" viewBox="0 0 48 48">
          <path d="M24 3c-3 0-5 2-5 4.5h10C29 5 27 3 24 3z" fill="#e2b55c" />
          <rect x="15" y="8" width="18" height="4" rx="1.5" fill="#e2b55c" />
          <path d="M16 12h16l2 5H14z" fill="#d9a84e" />
          <rect x="15" y="17" width="18" height="20" rx="3" fill="#6b4a1a" stroke="#f3d48a" strokeWidth="2" />
          <ellipse cx="24" cy="28" rx="6" ry="8" fill="#ffbe5c" />
          <path d="M24 22c2 3 3 5 0 9-3-4-2-6 0-9z" fill="#fff3cf" />
          <path d="M14 37h20l-2 4H16z" fill="#e2b55c" />
        </svg>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
