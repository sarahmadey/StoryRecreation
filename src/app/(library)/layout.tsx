import { Suspense } from "react";
import { pageCtx } from "@/lib/server/auth";
import { TopBar } from "@/components/TopBar";

// The header waits for who's reading on its own, so a tap that opens a page shows the page's
// loading screen at once rather than waiting for it (each page checks who's signed in itself).
export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<TopBar profile={undefined} />}>
        <ReaderTopBar />
      </Suspense>
      {children}
    </>
  );
}

async function ReaderTopBar() {
  const ctx = await pageCtx();
  return <TopBar profile={ctx.profile} />;
}
