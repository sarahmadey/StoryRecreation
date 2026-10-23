// Runs once when the server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Nightly backups to the family's own cloud storage, when it's been set up.
    const { startBackupSchedule } = await import("./lib/server/offsite");
    startBackupSchedule();
    // Classic covers kept with their books, for books shelved before covers were kept.
    const { keepMissingCoversSoon } = await import("./lib/server/covers");
    keepMissingCoversSoon();
    // The illustrator carries on with any pictures a restart (an update, say) stopped midway.
    const { resumeLostArtSoon } = await import("./lib/server/art");
    resumeLostArtSoon();
    // Photos for a book that was never finished are let go after a day.
    const { clearOldUploadsDaily } = await import("./lib/server/uploads");
    clearOldUploadsDaily();
  }
}
