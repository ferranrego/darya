import { config } from "dotenv";
config({ path: ".env.local" });

async function run() {
  const req = await fetch("http://localhost:3000/api/generate/comprehension", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ textId: "some-id" }), // this will fail with text not found, but I just want to see the error, wait I don't have a valid ID.
  });
}
