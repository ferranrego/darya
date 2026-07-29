import { verifyIrregulars } from "../scripts/verify-ca-entries.ts";
for (const p of verifyIrregulars()) console.log("  ✗", p);
