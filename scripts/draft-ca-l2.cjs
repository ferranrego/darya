const fs = require('fs');

const texts = [
  {
    slug: "l2-031",
    ca: "El membre del partit demana la paraula.\\nEll camina cap a l'est.",
    en: "The party member asks for the word.\\nHe walks towards the east."
  },
  {
    slug: "l2-032",
    ca: "El pla suposa que la població vol casar-se.\\nFalta una mica d'aigua.",
    en: "The plan supposes that the population wants to marry.\\nA little water is missing."
  },
  {
    slug: "l2-033",
    ca: "Ells decideixen estimar els quals són de l'exèrcit.\\nJo tinc un dit aquí.",
    en: "They decide to love those who are from the army.\\nI have a finger here."
  },
  {
    slug: "l2-034",
    ca: "La causa de l'ordre és l'alemany.\\nLa línia va cap a l'illa.",
    en: "The cause of the order is the German.\\nThe line goes towards the island."
  },
  {
    slug: "l2-035",
    ca: "És possible que la veu tingui la raó.\\nL'església té molta edat.",
    en: "It is possible that the voice is right.\\nThe church is very old (has a lot of age)."
  },
  {
    slug: "l2-036",
    ca: "El mitjà de prova toca el terme.\\nEl color és blau o verd.",
    en: "The evidence medium touches the term.\\nThe color is blue or green."
  },
  {
    slug: "l2-037",
    ca: "La policia parteix de l'estudi del consell.\\nElls representen el grup fort.",
    en: "The police depart from the council's study.\\nThey represent the strong group."
  },
  {
    slug: "l2-038",
    ca: "L'art lliure és un actiu per al president.\\nNo hi ha cap arma.",
    en: "Free art is an asset for the president.\\nThere is no weapon."
  },
  {
    slug: "l2-039",
    ca: "La universitat nacional produeix la base de l'habitatge.",
    en: "The national university produces the basis of housing."
  },
  {
    slug: "l2-040",
    ca: "El següent nivell de la sèrie és segur.\\nEll dirigeix l'obra nova.",
    en: "The next level of the series is safe.\\nHe directs the new work."
  },
  {
    slug: "l2-041",
    ca: "L'oficial dona informació sobre la llei.\\nEl càrrec té una cara nova.",
    en: "The officer gives information about the law.\\nThe position has a new face."
  },
  {
    slug: "l2-042",
    ca: "El castell existeix i interessa a la gent.\\nEl nombre significa alguna cosa.",
    en: "The castle exists and interests the people.\\nThe number means something."
  },
  {
    slug: "l2-043",
    ca: "Aleshores preparen la nau per tenir un control total.",
    en: "Then they prepare the ship to have total control."
  },
  {
    slug: "l2-044",
    ca: "L'objectiu dona suport i la baixa és un exemple del número.",
    en: "The objective gives support and the sick leave is an example of the number."
  },
  {
    slug: "l2-045",
    ca: "El públic humà és igual que el regne conegut.",
    en: "The human audience is the same as the known kingdom."
  },
  {
    slug: "l2-046",
    ca: "Al principi del segle neix el moviment del vaixell.",
    en: "At the beginning of the century the boat's movement is born."
  },
  {
    slug: "l2-047",
    ca: "Construïm la pau després de l'atac.\\nEl compte es paga finalment.",
    en: "We build peace after the attack.\\nThe bill is finally paid."
  },
  {
    slug: "l2-048",
    ca: "La veritat de l'assassinat en aquella època.\\nElls accepten la imatge.",
    en: "The truth of the murder in that epoch.\\nThey accept the image."
  },
  {
    slug: "l2-049",
    ca: "El director del club pateix la situació amb èxit.",
    en: "The director of the club suffers the situation with success."
  },
  {
    slug: "l2-050",
    ca: "La meitat abandona la política justa.\\nEl títol és al mig del paper.",
    en: "Half abandons fair politics.\\nThe title is in the middle of the paper."
  },
  {
    slug: "l2-051",
    ca: "La sala especial estableix una posició de seguretat.",
    en: "The special room establishes a position of security."
  },
  {
    slug: "l2-052",
    ca: "Ens protegeixen la sang a l'interior.\\nRealitzen el treball usant l'eina.",
    en: "They protect our blood on the inside.\\nThey carry out the work using the tool."
  },
  {
    slug: "l2-053",
    ca: "Obtenen el premi central per la cançó greu.",
    en: "They obtain the central prize for the serious song."
  },
  {
    slug: "l2-054",
    ca: "En la realitat el mestre fa funcionar i moure el ferro per soldar.",
    en: "In reality the teacher makes the iron work and move to weld."
  },
  {
    slug: "l2-055",
    ca: "La llista del programa conté la font real.",
    en: "The program list contains the real source."
  },
  {
    slug: "l2-056",
    ca: "El militar superior ataca i mostra la fi del camí.",
    en: "The superior military attacks and shows the end of the path."
  },
  {
    slug: "l2-057",
    ca: "El company salva el local.\\nEl resultat és a favor seu.",
    en: "The colleague saves the local.\\nThe result is in his favor."
  },
  {
    slug: "l2-058",
    ca: "La noia fa l'acció anterior a la construcció de la batalla.",
    en: "The young woman does the previous action to the battle's construction."
  },
  {
    slug: "l2-059",
    ca: "Probablement trien el motiu del fons de la cambra.",
    en: "They probably choose the reason from the back of the room."
  },
  {
    slug: "l2-060",
    ca: "L'agent i el capità fan el projecte bonic.",
    en: "The officer and the captain make the beautiful project."
  }
];

fs.writeFileSync('scripts/data/ca-l2-batch-02.json', JSON.stringify(texts, null, 2));
console.log("Written 30 texts for CA L2");
