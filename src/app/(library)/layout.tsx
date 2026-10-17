import { pageCtx } from "@/lib/server/auth";
import { TopBar } from "@/components/TopBar";

export default async function LibraryLayout({ children }: { children: React.ReactNode }) {
  const ctx = await pageCtx();
  return (
    <>
      <TopBar profile={ctx.profile} />
      {children}
    </>
  );
}
