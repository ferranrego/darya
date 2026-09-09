import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();

  if (!user || user.email !== "darya.6cf38@passmail.net") {
    return new NextResponse("Unauthorized", { status: 403 });
  }

  const admin = supabaseService();

  // Profiles, plus the two tables holding data the learner authored rather than
  // the app: their personal dictionary and what they chose to import. Article
  // bodies are left out deliberately - the export is about the account, and a
  // learner's imported reading can run to megabytes of someone else's prose.
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    // One string literal, not a concatenation: PostgREST's select is parsed at
    // the type level and a computed string collapses the result to `unknown`.
    .select("*, daily_activity(*), user_lexemes(*), imported_texts(id, source_url, title_en, read_at, words_tapped, sentence_count, char_count, new_word_ratio, created_at)");

  if (profilesError) {
    return new NextResponse(`Error fetching data: ${profilesError.message}`, { status: 500 });
  }

  // Fetch emails
  const { data: authData, error: authError } = await admin.auth.admin.listUsers();
  
  if (authError) {
    return new NextResponse(`Error fetching users: ${authError.message}`, { status: 500 });
  }

  const usersMap = new Map(authData.users.map(u => [u.id, u.email]));

  // Combine data
  const exportData = profiles.map(profile => ({
    ...profile,
    email: usersMap.get(profile.id),
  }));

  const json = JSON.stringify(exportData, null, 2);

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="darya-users-export-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
