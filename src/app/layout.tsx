import type { Metadata, Viewport } from "next";
import "@fontsource/cinzel-decorative/700.css";
import "@fontsource/im-fell-english/400.css";
import "@fontsource/im-fell-english/400-italic.css";
import "@fontsource-variable/lora/index.css";
import "@fontsource/andika/400.css";
import "./globals.css";
import { GrownupProvider } from "@/components/Grownup";
import { Motes } from "@/components/Art";

export const metadata: Metadata = {
  title: { default: "Lantern Library", template: "%s · Lantern Library" },
  description: "Magical audio stories for your family's books, and anything you dream up.",
  applicationName: "Lantern Library",
  appleWebApp: { capable: true, title: "Lantern", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#1b110a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GrownupProvider>
          <Motes />
          <div className="app">{children}</div>
        </GrownupProvider>
      </body>
    </html>
  );
}
