"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Poncha } from "@/components/poncha";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";
import { profile as lang } from "@/lib/lang";

export default function WelcomePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
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
            options: {
              data: { display_name: name.trim() || email.split("@")[0] },
              emailRedirectTo: location.origin,
            },
          });
    if (result.error) {
      setError(result.error.message);
      setBusy(false);
      return;
    }

    // Email confirmation is off in config; if the hosted project ever turns it
    // on, signUp returns a user without a session and no write would succeed.
    if (mode === "signup" && !result.data.session) {
      setError("Check your email to confirm your account, then sign in.");
      setMode("signin");
      setBusy(false);
      return;
    }

    // Drop any queries cached while anonymous (e.g. a null user) so the
    // onboarding wizard sees the fresh session.
    qc.clear();
    router.push(mode === "signup" ? "/onboarding" : "/");
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
          <div className="mb-4 flex justify-center">
            <Poncha pose="wave" size={160} priority animated />
          </div>
          <p lang={lang.code} className="text-[44px] leading-tight text-lapis">
            {lang.brand.nativeName}
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight">{lang.brand.appName}</h1>
          <p className="mt-2 text-[15px] text-ink-soft">
            {lang.brand.tagline} by reading, one word at a time.
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
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mx-auto mt-6 block text-[14px] text-lapis hover:underline"
        >
          {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </motion.div>
    </div>
  );
}
