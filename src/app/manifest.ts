import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lantern Library",
    short_name: "Lantern",
    description: "Magical audio stories for your family's books.",
    start_url: "/",
    display: "standalone",
    background_color: "#120b07",
    theme_color: "#1b110a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/pwa-icon", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
