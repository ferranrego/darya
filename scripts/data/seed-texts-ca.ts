import type { SeedTextSource } from "./seed-texts-prs.ts";

/**
 * Hand-authored Catalan seed texts. `pnpm build:texts --lang ca` tokenizes
 * these against the Catalan lexicon and writes full TextDocument JSON.
 *
 * Constraint: every word must resolve to a lexeme, so these use only the 250
 * curated core entries and the forms the Catalan conjugator generates from
 * them. The build fails on anything unresolvable, which is what keeps a seed
 * text from shipping words the reader cannot explain.
 *
 * No `translit`: Catalan is already Latin script.
 */
export const seedTexts: SeedTextSource[] = [
  {
    slug: "l1-001",
    level: "L1",
    titleTarget: "La casa",
    titleEn: "The house",
    sentences: [
      { target: "La casa és gran.", en: "The house is big." },
      { target: "El pare i la mare són a casa.", en: "Father and mother are at home." },
      { target: "El nen dorm.", en: "The child is sleeping." },
      { target: "El gos és petit.", en: "The dog is small." },
    ],
  },
  {
    slug: "l1-002",
    level: "L1",
    titleTarget: "El matí",
    titleEn: "The morning",
    sentences: [
      { target: "Al matí bec cafè.", en: "In the morning I drink coffee." },
      { target: "Menjo pa amb llet.", en: "I eat bread with milk." },
      { target: "Després vaig a la feina.", en: "Afterwards I go to work." },
      { target: "Treballo molt.", en: "I work a lot." },
    ],
  },
  {
    slug: "l1-003",
    level: "L1",
    titleTarget: "El meu amic",
    titleEn: "My friend",
    sentences: [
      { target: "El meu amic viu a la ciutat.", en: "My friend lives in the city." },
      { target: "Anem a la platja.", en: "We go to the beach." },
      { target: "El sol és molt bo.", en: "The sun is very good." },
      { target: "Estem contents.", en: "We are happy." },
    ],
  },
];
