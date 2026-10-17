import { redirect } from "next/navigation";
import { currentCtx } from "@/lib/server/auth";
import { WelcomeForm } from "./WelcomeForm";
import { Lantern } from "@/components/Art";

export const metadata = { title: "Welcome" };

export default async function WelcomePage() {
  if (await currentCtx()) redirect("/");
  return (
    <main className="page page-narrow" style={{ paddingTop: 40 }}>
      <div className="hero">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Lantern size={84} />
        </div>
        <h1>The Lantern Library</h1>
        <p className="muted" style={{ fontSize: "1.15rem", maxWidth: "34em", margin: "0 auto" }}>
          A new story for every night. Photograph the pages of a book you love (or something wonderful you
          found today) and a cast of storytellers will bring it to life.
        </p>
      </div>
      <WelcomeForm />
    </main>
  );
}
