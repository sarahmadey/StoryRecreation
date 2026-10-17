import { pageCtx } from "@/lib/server/auth";
import { listProfiles } from "@/lib/server/db";
import { ProfilePicker } from "@/components/Readers";

export const metadata = { title: "Who's listening?" };

export default async function WhoPage() {
  const ctx = await pageCtx();
  return (
    <main className="page">
      <ProfilePicker profiles={listProfiles(ctx.household.id)} />
    </main>
  );
}
