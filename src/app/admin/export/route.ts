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

  // Fetch profiles, we could fetch more tables if needed (e.g. daily_activity)
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("*, daily_activity(*)");

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
