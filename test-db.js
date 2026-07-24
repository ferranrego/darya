import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function check() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  const { data, error } = await supabase
    .from("texts")
    .select("id, questions, source, doc")
    .order("created_at", { ascending: false })
    .limit(5);
    
  if (error) {
    console.error("DB Error:", error);
    return;
  }
  
  for (const row of data) {
    console.log("ID:", row.id);
    console.log("Source:", row.source);
    console.log("Questions:", JSON.stringify(row.questions));
    console.log("Sentences:", row.doc?.sentences?.length);
    console.log("-------------------");
  }
}

check();
