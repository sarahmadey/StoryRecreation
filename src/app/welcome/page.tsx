import { redirect } from "next/navigation";
import { currentCtx } from "@/lib/server/auth";
import { signupMode } from "@/lib/server/signup";
import { WelcomeForm } from "./WelcomeForm";

export const metadata = { title: "Welcome" };

export default async function WelcomePage() {
  if (await currentCtx()) redirect("/");
  return (
    <main className="page page-narrow" style={{ paddingTop: 40 }}>
      <div className="hero">
        <h1 className="welcome-title">
          <img src="/brand/storyhollow-lockup.webp" width={960} height={960} alt="Storyhollow" />
        </h1>
        <p className="muted" style={{ fontSize: "1.15rem", maxWidth: "34em", margin: "0 auto" }}>
          A new story for every night. Photograph the pages of a book you love (or something wonderful you
          found today) and a cast of storytellers will bring it to life.
        </p>
      </div>
      <WelcomeForm signup={signupMode()} />
    </main>
  );
}
