import { pageCtx } from "@/lib/server/auth";
import { listDesignedVoices, listFamilyVoices, listKeepsakes, listProfiles } from "@/lib/server/db";
import { appStatus } from "@/lib/server/config";
import { familyBackup } from "@/lib/server/backup";
import { backupStatus } from "@/lib/server/offsite";
import { alertsStatus } from "@/lib/server/alerts";
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
        keepsakes={listKeepsakes(ctx.household.id)}
        familyVoices={listFamilyVoices(ctx.household.id)}
        backup={ctx.grownup ? familyBackup(ctx.household.id).summary : null}
        backups={ctx.grownup ? backupStatus() : null}
        alerts={ctx.grownup ? alertsStatus() : null}
        status={appStatus()}
      />
    </main>
  );
}
