import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const { data: gen } = await db.from("texts").select("id").eq("source", "generated");
const ids = (gen ?? []).map((t) => t.id);
if (ids.length) { await db.from("user_texts").delete().in("text_id", ids); await db.from("texts").delete().in("id", ids); }
console.log(`purged ${ids.length} generated texts`);
