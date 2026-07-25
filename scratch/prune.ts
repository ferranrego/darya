import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
}

const db = createClient(url, secret, { auth: { persistSession: false } });

async function run() {
  const idsToDelete = [
    "5cf9f6a3-158b-4b32-9e99-727a95181096", // test
    "30b591b7-81ea-4372-82ae-aa3dd8a38882", // test
    "c1626427-9f38-4798-ad4b-9055bbfeeeda", // Princesa Peach
  ];

  for (const id of idsToDelete) {
    const res = await fetch(`${url}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: {
        "apikey": secret,
        "Authorization": `Bearer ${secret}`
      }
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Failed to delete ${id}: ${res.status} - ${errText}`);
    } else {
      console.log(`Successfully deleted ${id}`);
    }
  }
}

run().catch(console.error);
