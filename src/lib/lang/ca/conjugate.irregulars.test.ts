import { describe, expect, it } from "vitest";

import { conjugationSurfaces } from "./conjugate.ts";
import { verbSpec } from "./lexicon-index.ts";

/**
 * Forms the engine used to invent, and the rule that let it.
 *
 * A regular paradigm applied to an irregular verb does not fail loudly - it
 * produces `*resoldo`, `*cometut`, `*sorprendut`, and the real forms then
 * resolve to nothing. A learner taps `resolt` and gets no entry; a text written
 * to teach `comès` cannot be seen to have taught it. Worse, `verifyEntry` asks
 * whether an example contains the headword "in a form the engine generates", so
 * a wrong paradigm inverts the gate: it accepts `Ha cometut un error` and
 * rejects the correct `Ha comès un error`.
 *
 * Every expected form here is from the IEC conjugation tables reached through
 * DIEC2, central column.
 */

/** infinitive → forms that must exist, and forms that must not. */
const CASES: [string, string[], string[]][] = [
  ["resoldre", ["resolc", "resol", "resolt", "resolta", "resolgui", "resolent"], ["resoldo", "resoldut"]],
  ["sorprendre", ["sorprenc", "sorprèn", "sorprès", "sorpresa", "sorprenent"], ["sorprendo", "sorprendut"]],
  ["reprendre", ["reprenc", "reprèn", "reprès", "represa", "reprenent"], ["reprendo", "reprendut"]],
  ["atendre", ["atenc", "atén", "atès", "atesa", "atenent"], ["atendo", "atendut"]],
  ["suspendre", ["suspenc", "suspèn", "suspès", "suspesa", "suspenent"], ["suspendo", "suspendut"]],
  ["cometre", ["comès", "comesa", "comesos"], ["cometut", "cometuda"]],
  ["inscriure", ["inscric", "inscriu", "inscrit", "inscrivint"], ["inscriuo", "inscriuüt"]],
  ["detenir", ["detinc", "deté", "detingut", "detenint"], ["deteneixo", "deteneix"]],
  ["endur", ["enduc", "endú", "enduu", "endut", "enduent"], ["endus", "endu"]],
];

describe.each(CASES)("%s", (infinitive, required, forbidden) => {
  const spec = verbSpec(infinitive);
  const forms = spec ? conjugationSurfaces(spec) : [];

  it("has a conjugation spec", () => {
    expect(spec, `${infinitive} falls through to the regular paradigm`).not.toBeNull();
  });

  it.each(required)("generates %s", (form) => {
    expect(forms).toContain(form);
  });

  it.each(forbidden)("does not invent %s", (form) => {
    expect(forms).not.toContain(form);
  });
});

describe("the diaeresis is not written in the gerund", () => {
  /**
   * Ortografia catalana (2017) exempts the infinitive, gerund, future and
   * conditional of a verb whose stem ends in a vowel. The participle does take
   * it, so `conduint` and `conduït` are both correct and the engine has to tell
   * them apart - it used to produce `conduïnt` for every one of these.
   */
  const VOWEL_STEM = ["conduir", "construir", "agrair", "reduir", "proveir", "deduir", "induir", "trair"];

  it.each(VOWEL_STEM)("%s", (infinitive) => {
    const spec = verbSpec(infinitive);
    const forms = spec ? conjugationSurfaces(spec) : [];
    const gerund = `${infinitive.slice(0, -2)}int`;
    expect(forms, `expected the gerund ${gerund}`).toContain(gerund);
    expect(
      forms.filter((f) => /ï(nt)$/.test(f)),
      "a gerund must not carry a diaeresis",
    ).toEqual([]);
  });

  it("still writes it on the participle, where it belongs", () => {
    const forms = conjugationSurfaces(verbSpec("conduir")!);
    expect(forms).toContain("conduït");
  });
});
