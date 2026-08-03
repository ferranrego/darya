import type { CatalanVerbStems } from "./conjugate.ts";

/**
 * Irregular Catalan verbs, by infinitive.
 *
 * Every entry lists the slots that cannot be derived; anything omitted falls
 * back to the regular paradigm. Slots are in the fixed person order
 * jo / tu / ell / nosaltres / vosaltres / ells, and participles are
 * masc.sg, fem.sg, masc.pl, fem.pl.
 *
 * This covers the verbs a beginner meets in almost every sentence. They are
 * also the ones a rule-based generator gets *confidently wrong*: `ser` and
 * `anar` are suppletive, and the velar-insertion verbs (tenir -> tinc, venir ->
 * vinc, prendre -> prenc) build their whole subjunctive on a stem that never
 * appears in the infinitive.
 *
 * Central Catalan is used throughout, with the accepted `soc`/`sóc` style
 * variants both listed so either spelling resolves.
 */
export const IRREGULAR_VERBS: Record<string, CatalanVerbStems> = {
  ser: {
    infinitive: "ser",
    conjugation: 2,
    overrides: {
      present: ["soc", "sóc", "ets", "és", "som", "sou", "són"],
      imperfect: ["era", "eres", "era", "érem", "éreu", "eren"],
      future: ["seré", "seràs", "serà", "serem", "sereu", "seran"],
      conditional: ["seria", "series", "seríem", "seríeu", "serien"],
      presentSubjunctive: ["sigui", "siguis", "siguem", "sigueu", "siguin"],
      imperfectSubjunctive: ["fos", "fossis", "fóssim", "fóssiu", "fossin"],
      participle: ["estat", "estada", "estats", "estades", "sigut", "siguda"],
      gerund: ["sent"],
      imperative: ["sigues", "sigui", "siguem", "sigueu", "siguin"],
    },
  },
  estar: {
    infinitive: "estar",
    conjugation: 1,
    overrides: {
      present: ["estic", "estàs", "està", "estem", "esteu", "estan"],
      presentSubjunctive: ["estigui", "estiguis", "estiguem", "estigueu", "estiguin"],
      imperfectSubjunctive: ["estigués", "estiguessis", "estiguéssim", "estiguéssiu", "estiguessin"],
      imperative: ["estigues", "estigui", "estiguem", "estigueu", "estiguin"],
    },
  },
  haver: {
    infinitive: "haver",
    conjugation: 2,
    overrides: {
      present: ["he", "has", "ha", "hem", "heu", "han"],
      imperfect: ["havia", "havies", "havíem", "havíeu", "havien"],
      future: ["hauré", "hauràs", "haurà", "haurem", "haureu", "hauran"],
      conditional: ["hauria", "hauries", "hauríem", "hauríeu", "haurien"],
      presentSubjunctive: ["hagi", "hagis", "hàgim", "hàgiu", "hagin"],
      imperfectSubjunctive: ["hagués", "haguessis", "haguéssim", "haguéssiu", "haguessin"],
      participle: ["hagut", "haguda", "haguts", "hagudes"],
      gerund: ["havent"],
    },
  },
  anar: {
    infinitive: "anar",
    conjugation: 1,
    overrides: {
      // Suppletive present (vaig/vas/va) - also the auxiliary of the
      // periphrastic past, which is how Catalan normally expresses "I went".
      // The past auxiliary has its own 1pl/2pl (vam/vau, or the fuller
      // vàrem/vàreu), which differ from the plain present anem/aneu: "vam anar"
      // is "we went", "anem" is "we go". Both sets must resolve.
      present: [
        "vaig", "vas", "vares", "va", "anem", "aneu", "van",
        "vam", "vau", "vàrem", "vàreu", "varen",
      ],
      future: ["aniré", "aniràs", "anirà", "anirem", "anireu", "aniran"],
      conditional: ["aniria", "aniries", "aniríem", "aniríeu", "anirien"],
      presentSubjunctive: ["vagi", "vagis", "anem", "aneu", "vagin"],
      imperative: ["ves", "vagi", "anem", "aneu", "vagin"],
    },
  },
  fer: {
    infinitive: "fer",
    conjugation: 2,
    overrides: {
      present: ["faig", "fas", "fa", "fem", "feu", "fan"],
      imperfect: ["feia", "feies", "fèiem", "fèieu", "feien"],
      future: ["faré", "faràs", "farà", "farem", "fareu", "faran"],
      conditional: ["faria", "faries", "faríem", "faríeu", "farien"],
      presentSubjunctive: ["faci", "facis", "fem", "feu", "facin"],
      imperfectSubjunctive: ["fes", "fessis", "féssim", "féssiu", "fessin"],
      participle: ["fet", "feta", "fets", "fetes"],
      gerund: ["fent"],
      imperative: ["fes", "faci", "fem", "feu", "facin"],
    },
  },
  dir: {
    infinitive: "dir",
    conjugation: 3,
    overrides: {
      present: ["dic", "dius", "diu", "diem", "dieu", "diuen"],
      imperfect: ["deia", "deies", "dèiem", "dèieu", "deien"],
      future: ["diré", "diràs", "dirà", "direm", "direu", "diran"],
      presentSubjunctive: ["digui", "diguis", "diguem", "digueu", "diguin"],
      imperfectSubjunctive: ["digués", "diguessis", "diguéssim", "diguéssiu", "diguessin"],
      participle: ["dit", "dita", "dits", "dites"],
      gerund: ["dient"],
      imperative: ["digues", "digui", "diguem", "digueu", "diguin"],
    },
  },
  poder: {
    infinitive: "poder",
    conjugation: 2,
    overrides: {
      present: ["puc", "pots", "pot", "podem", "podeu", "poden"],
      future: ["podré", "podràs", "podrà", "podrem", "podreu", "podran"],
      conditional: ["podria", "podries", "podríem", "podríeu", "podrien"],
      presentSubjunctive: ["pugui", "puguis", "puguem", "pugueu", "puguin"],
      imperfectSubjunctive: ["pogués", "poguessis", "poguéssim", "poguéssiu", "poguessin"],
      participle: ["pogut", "poguda", "poguts", "pogudes"],
    },
  },
  voler: {
    infinitive: "voler",
    conjugation: 2,
    overrides: {
      present: ["vull", "vols", "vol", "volem", "voleu", "volen"],
      future: ["voldré", "voldràs", "voldrà", "voldrem", "voldreu", "voldran"],
      conditional: ["voldria", "voldries", "voldríem", "voldríeu", "voldrien"],
      presentSubjunctive: ["vulgui", "vulguis", "vulguem", "vulgueu", "vulguin"],
      imperfectSubjunctive: ["volgués", "volguessis", "volguéssim", "volguéssiu", "volguessin"],
      participle: ["volgut", "volguda", "volguts", "volgudes"],
    },
  },
  saber: {
    infinitive: "saber",
    conjugation: 2,
    overrides: {
      present: ["sé", "saps", "sap", "sabem", "sabeu", "saben"],
      future: ["sabré", "sabràs", "sabrà", "sabrem", "sabreu", "sabran"],
      presentSubjunctive: ["sàpiga", "sàpigues", "sapiguem", "sapigueu", "sàpiguen"],
      imperfectSubjunctive: ["sabés", "sabessis", "sabéssim", "sabéssiu", "sabessin"],
      participle: ["sabut", "sabuda", "sabuts", "sabudes"],
    },
  },
  rebre: {
    infinitive: "rebre",
    conjugation: 2,
    overrides: {
      // Everything except the present is fully regular (future rebré,
      // participle rebut...). The present alone needs the same b->p
      // devoicing as saber (saps/sap, not sabs/sab): without this override
      // the generic conjugator produced "reb" for the bare 3rd-singular
      // form, which is not a word, and it silently outranked the real form
      // "rep" - a B2 batch's own example sentence needed "rep" and it did
      // not resolve. Found the same way venir's missing imperative was:
      // by trying to use the word in a sentence.
      present: ["rebo", "reps", "rep", "rebem", "rebeu", "reben"],
    },
  },
  tenir: {
    infinitive: "tenir",
    conjugation: 3,
    overrides: {
      present: ["tinc", "tens", "té", "tenim", "teniu", "tenen"],
      future: ["tindré", "tindràs", "tindrà", "tindrem", "tindreu", "tindran"],
      conditional: ["tindria", "tindries", "tindríem", "tindríeu", "tindrien"],
      presentSubjunctive: ["tingui", "tinguis", "tinguem", "tingueu", "tinguin"],
      imperfectSubjunctive: ["tingués", "tinguessis", "tinguéssim", "tinguéssiu", "tinguessin"],
      participle: ["tingut", "tinguda", "tinguts", "tingudes"],
      gerund: ["tenint"],
      imperative: ["té", "tingues", "tingui", "tinguem", "tingueu", "tinguin"],
    },
  },
  venir: {
    infinitive: "venir",
    conjugation: 3,
    overrides: {
      present: ["vinc", "véns", "vens", "ve", "venim", "veniu", "vénen", "venen"],
      future: ["vindré", "vindràs", "vindrà", "vindrem", "vindreu", "vindran"],
      conditional: ["vindria", "vindries", "vindríem", "vindríeu", "vindrien"],
      presentSubjunctive: ["vingui", "vinguis", "vinguem", "vingueu", "vinguin"],
      imperfectSubjunctive: ["vingués", "vinguessis", "vinguéssim", "vinguéssiu", "vinguessin"],
      participle: ["vingut", "vinguda", "vinguts", "vingudes"],
      gerund: ["venint"],
      // Without this override the generator falls back to the *regular*
      // 3rd-conjugation imperative, computed from the bare stem "ven-" as if
      // venir conjugated normally. That produced the non-word "ven" as
      // venir's imperative - which is also vendre's genuine 3rd-person
      // present ("es ven una casa" = "a house is sold") - so every text
      // using that form of vendre got glossed as venir instead. Two shipped
      // B1/B2 seed texts hit this before it was caught.
      imperative: ["vine", "vingui", "vinguem", "veniu", "vinguin"],
    },
  },
  veure: {
    infinitive: "veure",
    conjugation: 2,
    overrides: {
      present: ["veig", "veus", "veu", "veiem", "veieu", "veuen"],
      imperfect: ["veia", "veies", "vèiem", "vèieu", "veien"],
      future: ["veuré", "veuràs", "veurà", "veurem", "veureu", "veuran"],
      presentSubjunctive: ["vegi", "vegis", "vegem", "vegeu", "vegin"],
      imperfectSubjunctive: ["veiés", "veiessis", "veiéssim", "veiéssiu", "veiessin"],
      participle: ["vist", "vista", "vistos", "vistes"],
      gerund: ["veient"],
    },
  },
  prendre: {
    infinitive: "prendre",
    conjugation: 2,
    overrides: {
      present: ["prenc", "prens", "pren", "prenem", "preneu", "prenen"],
      presentSubjunctive: ["prengui", "prenguis", "prenguem", "prengueu", "prenguin"],
      imperfectSubjunctive: ["prengués", "prenguessis", "prenguéssim", "prenguéssiu", "prenguessin"],
      participle: ["pres", "presa", "presos", "preses"],
      gerund: ["prenent"],
    },
  },
  aprendre: {
    infinitive: "aprendre",
    conjugation: 2,
    overrides: {
      present: ["aprenc", "aprens", "aprèn", "aprenem", "apreneu", "aprenen"],
      presentSubjunctive: ["aprengui", "aprenguis", "aprenguem", "aprengueu", "aprenguin"],
      imperfectSubjunctive: ["aprengués", "aprenguessis", "aprenguéssim", "aprenguéssiu", "aprenguessin"],
      participle: ["après", "apresa", "apresos", "apreses"],
      gerund: ["aprenent"],
    },
  },
  comprendre: {
    infinitive: "comprendre",
    conjugation: 2,
    overrides: {
      present: ["comprenc", "comprens", "comprèn", "comprenem", "compreneu", "comprenen"],
      presentSubjunctive: ["comprengui", "comprenguis", "comprenguem", "comprengueu", "comprenguin"],
      participle: ["comprès", "compresa", "compresos", "compreses"],
      gerund: ["comprenent"],
    },
  },
  entendre: {
    infinitive: "entendre",
    conjugation: 2,
    overrides: {
      present: ["entenc", "entens", "entén", "entenem", "enteneu", "entenen"],
      presentSubjunctive: ["entengui", "entenguis", "entenguem", "entengueu", "entenguin"],
      participle: ["entès", "entesa", "entesos", "enteses"],
      gerund: ["entenent"],
    },
  },
  respondre: {
    infinitive: "respondre",
    conjugation: 2,
    overrides: {
      present: ["responc", "respons", "respon", "responem", "responeu", "responen"],
      presentSubjunctive: ["respongui", "responguis", "responguem", "respongueu", "responguin"],
      participle: ["respost", "resposta", "respostos", "respostes"],
      gerund: ["responent"],
    },
  },
  vendre: {
    infinitive: "vendre",
    conjugation: 2,
    // -ndre verbs take a velar stem in the 1sg and the whole subjunctive
    // (venc, vengui), which nothing in the infinitive predicts.
    overrides: {
      present: ["venc", "vens", "ven", "venem", "veneu", "venen"],
      presentSubjunctive: ["vengui", "venguis", "venguem", "vengueu", "venguin"],
      imperfectSubjunctive: ["vengués", "venguessis", "venguéssim", "venguéssiu", "venguessin"],
      participle: ["venut", "venuda", "venuts", "venudes"],
      gerund: ["venent"],
    },
  },
  riure: {
    infinitive: "riure",
    conjugation: 2,
    overrides: {
      present: ["ric", "rius", "riu", "riem", "rieu", "riuen"],
      imperfect: ["reia", "reies", "rèiem", "rèieu", "reien"],
      presentSubjunctive: ["rigui", "riguis", "riguem", "rigueu", "riguin"],
      imperfectSubjunctive: ["rigués", "riguessis", "riguéssim", "riguéssiu", "riguessin"],
      participle: ["rigut", "riguda", "riguts", "rigudes"],
      gerund: ["rient"],
    },
  },
  somriure: {
    infinitive: "somriure",
    conjugation: 2,
    // Prefixed riure: same paradigm throughout.
    overrides: {
      present: ["somric", "somrius", "somriu", "somriem", "somrieu", "somriuen"],
      imperfect: ["somreia", "somreies", "somrèiem", "somrèieu", "somreien"],
      presentSubjunctive: ["somrigui", "somriguis", "somriguem", "somrigueu", "somriguin"],
      participle: ["somrigut", "somriguda", "somriguts", "somrigudes"],
      gerund: ["somrient"],
    },
  },
  viure: {
    infinitive: "viure",
    conjugation: 2,
    overrides: {
      present: ["visc", "vius", "viu", "vivim", "viviu", "viuen"],
      imperfect: ["vivia", "vivies", "vivíem", "vivíeu", "vivien"],
      presentSubjunctive: ["visqui", "visquis", "visquem", "visqueu", "visquin"],
      imperfectSubjunctive: ["visqués", "visquessis", "visquéssim", "visquéssiu", "visquessin"],
      participle: ["viscut", "viscuda", "viscuts", "viscudes"],
      gerund: ["vivint"],
    },
  },
  beure: {
    infinitive: "beure",
    conjugation: 2,
    overrides: {
      present: ["bec", "beus", "beu", "bevem", "beveu", "beuen"],
      imperfect: ["bevia", "bevies", "bevíem", "bevíeu", "bevien"],
      presentSubjunctive: ["begui", "beguis", "beguem", "begueu", "beguin"],
      imperfectSubjunctive: ["begués", "beguessis", "beguéssim", "beguéssiu", "beguessin"],
      participle: ["begut", "beguda", "beguts", "begudes"],
      gerund: ["bevent"],
    },
  },
  creure: {
    infinitive: "creure",
    conjugation: 2,
    overrides: {
      present: ["crec", "creus", "creu", "creiem", "creieu", "creuen"],
      imperfect: ["creia", "creies", "crèiem", "crèieu", "creien"],
      presentSubjunctive: ["cregui", "creguis", "creguem", "cregueu", "creguin"],
      // Same velar-insertion stem ("cregu-") as the present subjunctive,
      // parallel to voler's volgués/volguessis... Missing here meant the
      // generic conjugator fell back to a wrong regular guess ("creués"),
      // caught when a batch's own ruled-out entry cited "cregués" as a form
      // creure generates and verify-ca-drops.ts actually executed the claim.
      imperfectSubjunctive: ["cregués", "creguessis", "creguéssim", "creguéssiu", "creguessin"],
      participle: ["cregut", "creguda", "creguts", "cregudes"],
      gerund: ["creient"],
    },
  },
  sortir: {
    infinitive: "sortir",
    conjugation: 3,
    // Stressed forms raise the stem vowel o -> u (surto, surts, surt, surten)
    // while the unstressed 1pl/2pl keep it (sortim, sortiu).
    overrides: {
      present: ["surto", "surts", "surt", "sortim", "sortiu", "surten"],
      presentSubjunctive: ["surti", "surtis", "sortim", "sortiu", "surtin"],
      imperative: ["surt", "surti", "sortim", "sortiu", "surtin"],
    },
  },
  escriure: {
    infinitive: "escriure",
    conjugation: 2,
    overrides: {
      present: ["escric", "escrius", "escriu", "escrivim", "escriviu", "escriuen"],
      imperfect: ["escrivia", "escrivies", "escrivíem", "escrivíeu", "escrivien"],
      presentSubjunctive: ["escrigui", "escriguis", "escriguem", "escrigueu", "escriguin"],
      participle: ["escrit", "escrita", "escrits", "escrites"],
      gerund: ["escrivint"],
    },
  },
  conèixer: {
    infinitive: "conèixer",
    conjugation: 2,
    overrides: {
      present: ["conec", "coneixes", "coneix", "coneixem", "coneixeu", "coneixen"],
      imperfect: ["coneixia", "coneixies", "coneixíem", "coneixíeu", "coneixien"],
      presentSubjunctive: ["conegui", "coneguis", "coneguem", "conegueu", "coneguin"],
      participle: ["conegut", "coneguda", "coneguts", "conegudes"],
      gerund: ["coneixent"],
    },
  },
  obrir: {
    infinitive: "obrir",
    conjugation: 3,
    overrides: { participle: ["obert", "oberta", "oberts", "obertes"] },
  },
  morir: {
    infinitive: "morir",
    conjugation: 3,
    overrides: { participle: ["mort", "morta", "morts", "mortes"] },
  },
  córrer: {
    infinitive: "córrer",
    conjugation: 2,
    overrides: {
      present: ["corro", "corres", "corre", "correm", "correu", "corren"],
      participle: ["corregut", "correguda", "correguts", "corregudes"],
    },
  },
  caure: {
    infinitive: "caure",
    conjugation: 2,
    overrides: {
      present: ["caic", "caus", "cau", "caiem", "caieu", "cauen"],
      imperfect: ["queia", "queies", "quèiem", "quèieu", "queien"],
      future: ["cauré", "cauràs", "caurà", "caurem", "caureu", "cauran"],
      conditional: ["cauria", "cauries", "cauríem", "cauríeu", "caurien"],
      presentSubjunctive: ["caigui", "caiguis", "caiguem", "caigueu", "caiguin"],
      imperfectSubjunctive: ["caigués", "caiguessis", "caiguéssim", "caiguéssiu", "caiguessin"],
      participle: ["caigut", "caiguda", "caiguts", "caigudes"],
      gerund: ["caient"],
    },
  },
  treure: {
    infinitive: "treure",
    conjugation: 2,
    // Two stems that alternate with stress: tre- when stressed (trec, treu),
    // tra- when not (traiem, traguem, trauré).
    overrides: {
      present: ["trec", "treus", "treu", "traiem", "traieu", "treuen"],
      imperfect: ["treia", "treies", "trèiem", "trèieu", "treien"],
      future: ["trauré", "trauràs", "traurà", "traurem", "traureu", "trauran"],
      conditional: ["trauria", "trauries", "trauríem", "trauríeu", "traurien"],
      presentSubjunctive: ["tregui", "treguis", "traguem", "tragueu", "treguin"],
      imperfectSubjunctive: ["tragués", "traguessis", "traguéssim", "traguéssiu", "traguessin"],
      participle: ["tret", "treta", "trets", "tretes"],
      gerund: ["traient"],
      imperative: ["treu", "tregui", "traguem", "tragueu", "treguin"],
    },
  },
  seure: {
    infinitive: "seure",
    conjugation: 2,
    overrides: {
      present: ["sec", "seus", "seu", "seiem", "seieu", "seuen"],
      imperfect: ["seia", "seies", "sèiem", "sèieu", "seien"],
      presentSubjunctive: ["segui", "seguis", "seguem", "segueu", "seguin"],
      imperfectSubjunctive: ["segués", "seguessis", "seguéssim", "seguéssiu", "seguessin"],
      participle: ["segut", "seguda", "seguts", "segudes"],
      gerund: ["seient"],
      imperative: ["seu", "segui", "seguem", "segueu", "seguin"],
    },
  },
  moure: {
    infinitive: "moure",
    conjugation: 2,
    overrides: {
      present: ["moc", "mous", "mou", "movem", "moveu", "mouen"],
      imperfect: ["movia", "movies", "movíem", "movíeu", "movien"],
      presentSubjunctive: ["mogui", "moguis", "moguem", "mogueu", "moguin"],
      imperfectSubjunctive: ["mogués", "moguessis", "moguéssim", "moguéssiu", "moguessin"],
      participle: ["mogut", "moguda", "moguts", "mogudes"],
      gerund: ["movent"],
    },
  },
  néixer: {
    infinitive: "néixer",
    conjugation: 2,
    // Stressed forms keep nei-, unstressed ones lower it to nai-; the
    // participle is suppletive (nascut), which is the form learners meet first
    // in "vaig néixer" / "he nascut".
    overrides: {
      present: ["neixo", "neixes", "neix", "naixem", "naixeu", "neixen"],
      imperfect: ["naixia", "naixies", "naixíem", "naixíeu", "naixien"],
      future: ["naixeré", "naixeràs", "naixerà", "naixerem", "naixereu", "naixeran"],
      conditional: ["naixeria", "naixeries", "naixeríem", "naixeríeu", "naixerien"],
      presentSubjunctive: ["neixi", "neixis", "naixem", "naixeu", "neixin"],
      participle: ["nascut", "nascuda", "nascuts", "nascudes"],
      gerund: ["naixent"],
    },
  },
  caldre: {
    infinitive: "caldre",
    conjugation: 2,
    // Defective: only the third person exists ("cal estudiar", "calen diners").
    // Listing just those forms is deliberate - generating *calc/*cals would
    // teach a form no Catalan speaker uses.
    overrides: {
      present: ["cal", "calen"],
      imperfect: ["calia", "calien"],
      future: ["caldrà", "caldran"],
      conditional: ["caldria", "caldrien"],
      presentSubjunctive: ["calgui", "calguin"],
      imperfectSubjunctive: ["calgués", "calguessin"],
      participle: ["calgut", "calguda", "calguts", "calgudes"],
      gerund: ["calent"],
    },
  },
  ploure: {
    infinitive: "ploure",
    conjugation: 2,
    // Impersonal: third person singular only.
    overrides: {
      present: ["plou"],
      imperfect: ["plovia"],
      future: ["plourà"],
      conditional: ["plouria"],
      presentSubjunctive: ["plogui"],
      imperfectSubjunctive: ["plogués"],
      participle: ["plogut", "ploguda"],
      gerund: ["plovent"],
    },
  },
  dur: {
    infinitive: "dur",
    conjugation: 2,
    overrides: {
      present: ["duc", "dus", "du", "duem", "dueu", "duen"],
      imperfect: ["duia", "duies", "dúiem", "dúieu", "duien"],
      presentSubjunctive: ["dugui", "duguis", "duguem", "dugueu", "duguin"],
      participle: ["dut", "duta", "duts", "dutes"],
      gerund: ["duent"],
    },
  },
  /**
   * The -endre / -oldre / -etre / -iure families.
   *
   * `prendre`, `aprendre`, `comprendre`, `entendre`, `respondre` and `escriure`
   * were already here; their morphological siblings were not, so the engine
   * treated them as regular and invented whole paradigms - `*resoldo`,
   * `*sorprendut`, `*cometut`, `*inscriuüt`. Nothing displayed those, but the
   * real forms (`resolt`, `comès`, `sorprèn`, `atès`, `suspès`, `inscrit`) then
   * resolved to nothing, so a learner tapping them got no entry and a text
   * teaching them could not be seen to have taught them. Worse, verifyEntry's
   * "the example contains the headword" check inverts: it would accept
   * "Ha cometut un error" and reject the correct "Ha comès un error".
   *
   * Forms from the IEC conjugation tables reached through DIEC2, central column.
   */
  resoldre: {
    infinitive: "resoldre",
    conjugation: 2,
    overrides: {
      present: ["resolc", "resols", "resol", "resolem", "resoleu", "resolen"],
      presentSubjunctive: ["resolgui", "resolguis", "resolguem", "resolgueu", "resolguin"],
      imperfectSubjunctive: ["resolgués", "resolguessis", "resolguéssim", "resolguéssiu", "resolguessin"],
      participle: ["resolt", "resolta", "resolts", "resoltes"],
      gerund: ["resolent"],
    },
  },
  sorprendre: {
    infinitive: "sorprendre",
    conjugation: 2,
    overrides: {
      present: ["sorprenc", "sorprens", "sorprèn", "sorprenem", "sorpreneu", "sorprenen"],
      presentSubjunctive: ["sorprengui", "sorprenguis", "sorprenguem", "sorprengueu", "sorprenguin"],
      imperfectSubjunctive: ["sorprengués", "sorprenguessis", "sorprenguéssim", "sorprenguéssiu", "sorprenguessin"],
      participle: ["sorprès", "sorpresa", "sorpresos", "sorpreses"],
      gerund: ["sorprenent"],
    },
  },
  reprendre: {
    infinitive: "reprendre",
    conjugation: 2,
    overrides: {
      present: ["reprenc", "reprens", "reprèn", "reprenem", "repreneu", "reprenen"],
      presentSubjunctive: ["reprengui", "reprenguis", "reprenguem", "reprengueu", "reprenguin"],
      imperfectSubjunctive: ["reprengués", "reprenguessis", "reprenguéssim", "reprenguéssiu", "reprenguessin"],
      participle: ["reprès", "represa", "represos", "represes"],
      gerund: ["reprenent"],
    },
  },
  atendre: {
    infinitive: "atendre",
    conjugation: 2,
    overrides: {
      present: ["atenc", "atens", "atén", "atenem", "ateneu", "atenen"],
      presentSubjunctive: ["atengui", "atenguis", "atenguem", "atengueu", "atenguin"],
      imperfectSubjunctive: ["atengués", "atenguessis", "atenguéssim", "atenguéssiu", "atenguessin"],
      participle: ["atès", "atesa", "atesos", "ateses"],
      gerund: ["atenent"],
    },
  },
  suspendre: {
    infinitive: "suspendre",
    conjugation: 2,
    overrides: {
      present: ["suspenc", "suspens", "suspèn", "suspenem", "suspeneu", "suspenen"],
      presentSubjunctive: ["suspengui", "suspenguis", "suspenguem", "suspengueu", "suspenguin"],
      imperfectSubjunctive: ["suspengués", "suspenguessis", "suspenguéssim", "suspenguéssiu", "suspenguessin"],
      participle: ["suspès", "suspesa", "suspesos", "suspeses"],
      gerund: ["suspenent"],
    },
  },
  cometre: {
    infinitive: "cometre",
    conjugation: 2,
    overrides: {
      participle: ["comès", "comesa", "comesos", "comeses"],
    },
  },
  inscriure: {
    infinitive: "inscriure",
    conjugation: 2,
    overrides: {
      present: ["inscric", "inscrius", "inscriu", "inscrivim", "inscriviu", "inscriuen"],
      presentSubjunctive: ["inscrigui", "inscriguis", "inscriguem", "inscrigueu", "inscriguin"],
      imperfectSubjunctive: ["inscrigués", "inscriguessis", "inscriguéssim", "inscriguéssiu", "inscriguessin"],
      participle: ["inscrit", "inscrita", "inscrits", "inscrites"],
      gerund: ["inscrivint"],
    },
  },
  detenir: {
    infinitive: "detenir",
    conjugation: 3,
    overrides: {
      present: ["detinc", "detens", "deté", "detenim", "deteniu", "detenen"],
      presentSubjunctive: ["detingui", "detinguis", "detinguem", "detingueu", "detinguin"],
      imperfectSubjunctive: ["detingués", "detinguessis", "detinguéssim", "detinguéssiu", "detinguessin"],
      participle: ["detingut", "detinguda", "detinguts", "detingudes"],
      gerund: ["detenint"],
    },
  },
  /**
   * `establir` has an irregular participle (`establert`, not *establit*), and
   * `créixer` and `recaure` are irregular throughout. All three were being
   * inflected as regular, so their commonest forms resolved to nothing.
   */
  establir: {
    infinitive: "establir",
    conjugation: 3,
    incoative: true,
    overrides: {
      participle: ["establert", "establerta", "establerts", "establertes"],
    },
  },
  créixer: {
    infinitive: "créixer",
    conjugation: 2,
    overrides: {
      present: ["creixo", "creixes", "creix", "creixem", "creixeu", "creixen"],
      presentSubjunctive: ["creixi", "creixis", "creixem", "creixeu", "creixin"],
      imperfectSubjunctive: ["cresqués", "cresquessis", "cresquéssim", "cresquéssiu", "cresquessin"],
      participle: ["crescut", "crescuda", "crescuts", "crescudes"],
      gerund: ["creixent"],
    },
  },
  recaure: {
    infinitive: "recaure",
    conjugation: 2,
    overrides: {
      present: ["recaic", "recaus", "recau", "recaiem", "recaieu", "recauen"],
      presentSubjunctive: ["recaigui", "recaiguis", "recaiguem", "recaigueu", "recaiguin"],
      imperfectSubjunctive: ["recaigués", "recaiguessis", "recaiguéssim", "recaiguéssiu", "recaiguessin"],
      participle: ["recaigut", "recaiguda", "recaiguts", "recaigudes"],
      gerund: ["recaient"],
    },
  },
  /**
   * The `tenir` family. All are irregular in the same way and none were
   * covered, so `conté`, `manté`, `obté` and `reté` - the forms a learner
   * actually meets - resolved to nothing while the engine offered
   * *conteneix.
   */
  contenir: {
    infinitive: "contenir",
    conjugation: 3,
    overrides: {
      present: ["continc", "contens", "conté", "contenim", "conteniu", "contenen"],
      presentSubjunctive: ["contingui", "continguis", "continguem", "contingueu", "continguin"],
      imperfectSubjunctive: ["contingués", "continguessis", "continguéssim", "continguéssiu", "continguessin"],
      participle: ["contingut", "continguda", "continguts", "contingudes"],
      gerund: ["contenint"],
    },
  },
  mantenir: {
    infinitive: "mantenir",
    conjugation: 3,
    overrides: {
      present: ["mantinc", "mantens", "manté", "mantenim", "manteniu", "mantenen"],
      presentSubjunctive: ["mantingui", "mantinguis", "mantinguem", "mantingueu", "mantinguin"],
      imperfectSubjunctive: ["mantingués", "mantinguessis", "mantinguéssim", "mantinguéssiu", "mantinguessin"],
      participle: ["mantingut", "mantinguda", "mantinguts", "mantingudes"],
      gerund: ["mantenint"],
    },
  },
  obtenir: {
    infinitive: "obtenir",
    conjugation: 3,
    overrides: {
      present: ["obtinc", "obtens", "obté", "obtenim", "obteniu", "obtenen"],
      presentSubjunctive: ["obtingui", "obtinguis", "obtinguem", "obtingueu", "obtinguin"],
      imperfectSubjunctive: ["obtingués", "obtinguessis", "obtinguéssim", "obtinguéssiu", "obtinguessin"],
      participle: ["obtingut", "obtinguda", "obtinguts", "obtingudes"],
      gerund: ["obtenint"],
    },
  },
  retenir: {
    infinitive: "retenir",
    conjugation: 3,
    overrides: {
      present: ["retinc", "retens", "reté", "retenim", "reteniu", "retenen"],
      presentSubjunctive: ["retingui", "retinguis", "retinguem", "retingueu", "retinguin"],
      imperfectSubjunctive: ["retingués", "retinguessis", "retinguéssim", "retinguéssiu", "retinguessin"],
      participle: ["retingut", "retinguda", "retinguts", "retingudes"],
      gerund: ["retenint"],
    },
  },
  // `endur-se` is `dur` with a prefix and inflects identically. It is far more
  // common than the bare verb in everyday Catalan ("emporta-t'ho" aside,
  // "endur-se" is what a learner meets), and without a spec here the engine
  // generates none of its forms, so `se'n va endur` resolves to nothing.
  endur: {
    infinitive: "endur",
    conjugation: 2,
    overrides: {
      // IEC gives "enduus o endús" and "enduu o endú"; `s'endú` is the everyday
      // central form, so the unaccented *endus / *endu were the wrong pick.
      present: ["enduc", "endús", "enduus", "endú", "enduu", "enduem", "endueu", "enduen"],
      imperfect: ["enduia", "enduies", "endúiem", "endúieu", "enduien"],
      presentSubjunctive: ["endugui", "enduguis", "enduguem", "endugueu", "enduguin"],
      participle: ["endut", "enduta", "enduts", "endutes"],
      gerund: ["enduent"],
    },
  },
};

/**
 * Verbs whose infinitive ends in -ir but take the *pure* present (dormo, not
 * *dormeixo*). The incoative -eix- type is the large majority, so this is the
 * exception list rather than the rule.
 */
export const PURE_IR_VERBS = new Set([
  "dormir", "obrir", "morir", "sortir", "collir", "cosir", "tossir",
  "omplir", "sentir", "consentir", "mentir", "bullir", "escopir",
  "fugir", "pudir", "acudir", "ajupir", "esmunyir", "grunyir",
]);
