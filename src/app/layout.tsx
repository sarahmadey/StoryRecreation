import type { Metadata, Viewport } from "next";
import "@fontsource/cinzel-decorative/700.css";
import "@fontsource/im-fell-english/400.css";
import "@fontsource/im-fell-english/400-italic.css";
import "@fontsource-variable/lora/index.css";
import "@fontsource/andika/400.css";
import "./globals.css";
import { GrownupProvider } from "@/components/Grownup";
import { Motes } from "@/components/Art";
import { TestCopyBanner } from "@/components/TestCopyBanner";
import { KeyboardFix } from "@/components/KeyboardFix";
import { appName } from "@/lib/server/config";

export async function generateMetadata(): Promise<Metadata> {
  const name = appName();
  return {
    title: { default: name, template: `%s · ${name}` },
    description: "Magical audio stories for your family's books, and anything you dream up.",
    applicationName: name,
    appleWebApp: { capable: true, title: name, statusBarStyle: "black-translucent" },
  };
}

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
          <TestCopyBanner />
          <KeyboardFix />
          <div className="app">{children}</div>
        </GrownupProvider>
      </body>
    </html>
  );
}
