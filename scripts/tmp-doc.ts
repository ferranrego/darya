import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const lex = JSON.parse(readFileSync(join(import.meta.dirname, "..", "content", "ca", "lexicon", "lexicon.json"), "utf8"));
const { data: users } = await db.auth.admin.listUsers();
const u = users.users.find((x) => x.email === "riera-verify@example.com")!;
const { data: words } = await db.from("user_words").select("lexeme_id,status").eq("user_id", u.id);
const tracked = new Set((words ?? []).filter((w) => ["known","learning"].includes(w.status)).map((w) => w.lexeme_id));
const prior = lex.entries.filter((e: { freqRank: number; id: string }) => e.freqRank <= 110).map((e: { id: string }) => e.id);
const known = new Set([...tracked, ...prior]);
const { data } = await db.from("texts").select("id,doc").eq("level", "L3");
for (const t of data ?? []) {
  const d = t.doc as Record<string, unknown>;
  const vocab = (d.vocabUsed as string[]) ?? [];
  const oov = vocab.filter((w) => !known.has(w)).length;
  console.log(`${t.id} translit=${JSON.stringify(d.titleTranslit)} title=${JSON.stringify(d.titleTarget)} oov=${oov}/${vocab.length} rate=${(oov/vocab.length).toFixed(2)}`);
  console.log("   ", (d.sentences as {target:string;translit?:string}[]).map((s)=>s.target).join(" "));
  console.log("    sentence translits:", JSON.stringify((d.sentences as {translit?:string}[]).map((s)=>s.translit)));
}
console.log(`tracked=${tracked.size} known=${known.size}`);
