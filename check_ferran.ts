import { createClient } from "@supabase/supabase-js";
import fs from "fs";

async function checkDb(envFile: string, name: string) {
  const envContent = fs.readFileSync(envFile, 'utf-8');
  let url = '';
  let key = '';
  envContent.split('\n').forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('SUPABASE_SECRET_KEY=')) key = line.split('=')[1].trim();
  });

  if (!url || !key) {
    console.log(`[${name}] Missing URL or KEY`);
    return;
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: profiles, error } = await db.from("profiles").select("*");
  if (error) {
    console.log(`[${name}] Error fetching profiles:`, error.message);
    return;
  }

  const ferran = profiles.find(p => JSON.stringify(p).toLowerCase().includes("ferran"));
  
  if (!ferran) {
    console.log(`[${name}] Could not find Ferran in profiles.`);
    return;
  }

  console.log(`[${name}] Found Ferran! ID: ${ferran.id}, Level: ${ferran.level_estimate}`);

  const { data: words } = await db.from("user_words").select("status").eq("user_id", ferran.id);
  const known = words?.filter(w => w.status === 'known' || w.status === 'learning').length || 0;
  console.log(`[${name}] Known/Learning words: ${known}`);

  const { data: texts } = await db.from("texts").select("id, created_at, new_words, vocab_used").eq("level", ferran.level_estimate).order('created_at', { ascending: false }).limit(5);
  
  if (texts && texts.length > 0) {
    const taughtCounts = texts.map(t => {
      return { id: t.id, date: t.created_at, new_words: t.new_words?.length || 0, vocab: t.vocab_used?.length || 0 };
    });
    console.log(`[${name}] Recent 5 texts teaching counts for this level:`, taughtCounts);
  } else {
    console.log(`[${name}] No texts found for level ${ferran.level_estimate}`);
  }
}

async function main() {
  await checkDb(".env.local", "Dari");
  await checkDb(".env.ca.local", "Catalan");
}

main();
