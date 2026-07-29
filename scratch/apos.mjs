import { apostropheProblems } from "../scripts/verify-ca-entries.ts";
const cases = ["La explicació és clara.", "L'explicació és clara.", "El home menja.",
               "Bec de aigua freda.", "La idea és bona.", "La universitat és gran.", "Vaig a l'escola."];
for (const c of cases) {
  const p = apostropheProblems(c);
  console.log(`  ${c.padEnd(30)} ${p.length ? "✗ " + p[0] : "✓"}`);
}
