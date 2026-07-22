"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { updateProfile } from "@/lib/db/profiles";
import { seedKnownWords } from "@/lib/db/words";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function WelcomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [hasOnboardingData, setHasOnboardingData] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("darya_onboarding_data")) {
      setHasOnboardingData(true);
      setMode("signup");
    }
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const db = supabaseBrowser();
    const result =
      mode === "signin"
        ? await db.auth.signInWithPassword({ email, password })
        : await db.auth.signUp({
            email,
            password,
            options: { data: { display_name: name.trim() || email.split("@")[0] } },
          });
    if (result.error) {
      setError(result.error.message);
      setBusy(false);
      return;
    }
    
    if (result.data.user) {
      const storedData = localStorage.getItem("darya_onboarding_data");
      if (storedData) {
        try {
          const parsed = JSON.parse(storedData);
          await seedKnownWords(db, result.data.user.id, parsed.knownLexemeIds);
          await updateProfile(db, result.data.user.id, {
            can_read_script: parsed.canRead,
            level_estimate: parsed.levelId,
            onboarded_at: new Date().toISOString(),
          });
          localStorage.removeItem("darya_onboarding_data");
        } catch (e) {
          console.error("Failed to sync onboarding data", e);
        }
      }
    }

    router.push("/");
    router.refresh();
  }

  const inputCls =
    "h-12 w-full rounded-xl border border-line bg-surface px-4 text-[15px] text-ink " +
    "placeholder:text-ink-faint focus:border-lapis focus:outline-none transition-colors";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="mb-10 text-center">
          <p lang="prs" className="text-[64px] leading-tight text-lapis">
            دریا
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight">Darya</h1>
          <p className="mt-2 text-[15px] text-ink-soft">
            {hasOnboardingData
              ? "Create an account to save your progress."
              : "Learn Dari by reading, one word at a time."}
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <input
              className={inputCls}
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          )}
          <input
            className={inputCls}
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <input
            className={inputCls}
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
          {error && <p className="text-[13px] text-danger">{error}</p>}
          <Button type="submit" size="lg" disabled={busy} className="mt-2">
            {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            if (mode === "signin") {
              // New users without onboarding data should go through the
              // onboarding wizard first; it sends them back here to sign up.
              if (hasOnboardingData) setMode("signup");
              else router.push("/onboarding");
            } else {
              setMode("signin");
            }
          }}
          className="mx-auto mt-6 block text-[14px] text-lapis hover:underline"
        >
          {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </motion.div>
    </div>
  );
}
