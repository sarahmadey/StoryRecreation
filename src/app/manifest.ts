import type { MetadataRoute } from "next";
import { appName } from "@/lib/server/config";

// Answered per request, so the test copy installs as "Storyhollow Test".
export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appName(),
    short_name: appName(),
    description: "Magical audio stories for your family's books.",
    start_url: "/",
    display: "standalone",
    background_color: "#120b07",
    theme_color: "#1b110a",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
