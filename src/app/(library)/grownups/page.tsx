import { pageCtx } from "@/lib/server/auth";
import { listDesignedVoices, listProfiles } from "@/lib/server/db";
import { appStatus } from "@/lib/server/config";
import { GrownupsView } from "./GrownupsView";

export const metadata = { title: "Grown-ups' corner" };

export default async function GrownupsPage() {
  const ctx = await pageCtx();
  return (
    <main className="page page-narrow">
      <GrownupsView
        familyName={ctx.household.name}
        email={ctx.household.email}
        unlocked={ctx.grownup}
        pinSet={Boolean(ctx.household.pin_hash)}
        profiles={listProfiles(ctx.household.id)}
        designed={listDesignedVoices(ctx.household.id)}
        status={appStatus()}
      />
    </main>
  );
}
