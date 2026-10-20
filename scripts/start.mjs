// Starts Storyhollow in production. When Railway replaces this version with a
// new one it asks the old one to stop (SIGTERM); we pass that on to Next.js and
// report a clean stop, so an update isn't mistaken for a crash. If the server
// ever exits by itself, its own exit code is kept, so real crashes still show.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const next = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const server = spawn(process.execPath, [next, "start"], { stdio: "inherit" });

let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    stopping = true;
    server.kill(signal);
  });
}
server.on("exit", (code) => process.exit(stopping ? 0 : (code ?? 1)));
