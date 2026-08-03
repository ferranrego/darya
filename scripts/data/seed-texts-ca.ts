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
  {
    slug: "l2-001",
    level: "L2",
    titleTarget: "La meva família",
    titleEn: "My family",
    sentences: [
      { target: "La meva família és gran.", en: "My family is big." },
      { target: "El meu pare treballa molt.", en: "My father works a lot." },
      { target: "La meva mare sap cuinar molt bé.", en: "My mother knows how to cook very well." },
      { target: "Tinc dos germans i una germana.", en: "I have two brothers and one sister." },
      { target: "Els diumenges anem junts a la platja.", en: "On Sundays we go to the beach together." },
    ],
  },
  {
    slug: "l2-002",
    level: "L2",
    titleTarget: "Al mercat",
    titleEn: "At the market",
    sentences: [
      { target: "Vaig al mercat cada dissabte.", en: "I go to the market every Saturday." },
      { target: "Vull comprar peix i fruita fresca.", en: "I want to buy fish and fresh fruit." },
      { target: "El venedor és molt ràpid i amable.", en: "The seller is very quick and friendly." },
      { target: "Prefereixo la fruita a la carn.", en: "I prefer fruit to meat." },
      { target: "Pago amb diners i torno a casa.", en: "I pay with cash and go home." },
    ],
  },
  {
    slug: "l2-003",
    level: "L2",
    titleTarget: "El meu poble",
    titleEn: "My town",
    sentences: [
      { target: "Visc en un poble petit.", en: "I live in a small town." },
      { target: "Fa sol gairebé cada dia.", en: "It's sunny almost every day." },
      { target: "A la tarda de vegades plou.", en: "In the afternoon it sometimes rains." },
      { target: "El veí és molt amable.", en: "The neighbor is very kind." },
      { target: "Sé el nom de tothom.", en: "I know everyone's name." },
      { target: "Puc caminar fins a la plaça.", en: "I can walk to the square." },
    ],
  },
  {
    slug: "l3-001",
    level: "L3",
    titleTarget: "Quan era petit",
    titleEn: "When I was little",
    sentences: [
      {
        target: "Quan era petit, vivia a la muntanya amb els avis.",
        en: "When I was little, I lived in the mountains with my grandparents.",
      },
      { target: "Cada estiu anàvem junts a la platja.", en: "Every summer we went to the beach together." },
      { target: "L'estiu passat vam anar a una ciutat nova.", en: "Last summer we went to a new city." },
      { target: "Vam visitar un museu molt bonic.", en: "We visited a very beautiful museum." },
      {
        target: "Aquest matí he trucat als avis per explicar el viatge.",
        en: "This morning I called my grandparents to tell them about the trip.",
      },
    ],
  },
  {
    slug: "l3-002",
    level: "L3",
    titleTarget: "Un dia de feina",
    titleEn: "A workday",
    sentences: [
      {
        target: "Abans treballava en una oficina petita al costat de casa.",
        en: "Before, I used to work in a small office next to home.",
      },
      {
        target: "Cada dia agafava el tren de les vuit per anar a la feina.",
        en: "Every day I used to take the eight o'clock train to go to work.",
      },
      {
        target: "Ahir vaig arribar tard perquè el tren no va sortir a temps.",
        en: "Yesterday I arrived late because the train didn't leave on time.",
      },
      { target: "El meu cap es va enfadar molt amb tothom.", en: "My boss got very angry with everyone." },
      {
        target: "Avui, en canvi, he acabat la feina molt més d'hora.",
        en: "Today, however, I finished work much earlier.",
      },
    ],
  },
  {
    slug: "l3-003",
    level: "L3",
    titleTarget: "La meva amiga",
    titleEn: "My friend",
    sentences: [
      {
        target: "La meva amiga vivia al costat de casa quan érem petites.",
        en: "My friend used to live next to my house when we were little girls.",
      },
      {
        target: "Quan érem petites, jugàvem juntes al carrer cada tarda.",
        en: "When we were little, we used to play together in the street every afternoon.",
      },
      {
        target: "L'any passat es va casar amb un home molt simpàtic.",
        en: "Last year she married a very nice man.",
      },
      {
        target: "Vam anar totes juntes a la festa i vam ballar molt.",
        en: "We all went to the party together and danced a lot.",
      },
      {
        target: "Aquesta setmana li he trucat per telèfon per parlar una estona.",
        en: "This week I called her on the phone to talk for a while.",
      },
    ],
  },
  {
    slug: "l4-001",
    level: "L4",
    titleTarget: "El meu somni de viatjar",
    titleEn: "My dream of traveling",
    sentences: [
      {
        target: "M'agradaria viatjar més i conèixer llocs nous cada any.",
        en: "I would like to travel more and get to know new places every year.",
      },
      {
        target: "Vull que la meva família vingui amb mi al viatge que ve.",
        en: "I want my family to come with me on the next trip.",
      },
      {
        target: "Caldria estalviar una mica de diners cada mes per fer-ho.",
        en: "I would need to save a bit of money each month to do it.",
      },
      {
        target: "El meu fill espera que arribin aviat les vacances d'estiu.",
        en: "My son hopes the summer holidays arrive soon.",
      },
      {
        target: "Tot caminant per la platja, penso en tots els llocs que voldria veure.",
        en: "While walking along the beach, I think about all the places I would like to see.",
      },
      {
        target: "Voldria conèixer una ciutat nova l'any que ve.",
        en: "I would like to get to know a new city next year.",
      },
    ],
  },
  {
    slug: "l4-002",
    level: "L4",
    titleTarget: "A la feina",
    titleEn: "At work",
    sentences: [
      {
        target: "Aquest any vull que em pugin una mica el sou a la feina.",
        en: "This year I want them to raise my salary a bit at work.",
      },
      {
        target: "El meu cap espera que acabem el projecte abans que arribi l'estiu.",
        en: "My boss hopes we finish the project before summer arrives.",
      },
      {
        target: "Caldria organitzar una reunió amb tot l'equip abans de dinar.",
        en: "We should organize a meeting with the whole team before lunch.",
      },
      {
        target: "Hem d'enviar el correu al client abans que se'n vagi.",
        en: "We have to send the email to the client before he leaves.",
      },
      {
        target: "Torno a revisar el document que hem escrit tots junts.",
        en: "I'm reviewing the document we all wrote together again.",
      },
      {
        target: "Acabo de parlar amb un client que sembla molt content.",
        en: "I've just spoken with a client who seems very happy.",
      },
    ],
  },
  {
    slug: "l4-003",
    level: "L4",
    titleTarget: "Un viatge en tren",
    titleEn: "A train journey",
    sentences: [
      {
        target: "Vull agafar el tren que surt a les nou del matí cap a la muntanya.",
        en: "I want to catch the train that leaves at nine in the morning towards the mountains.",
      },
      {
        target: "És una ciutat petita on viuen els meus cosins des de sempre.",
        en: "It's a small city where my cousins have always lived.",
      },
      {
        target: "Aquí es parla una llengua que és una mica diferent de la meva.",
        en: "Here they speak a language that's a bit different from mine.",
      },
      {
        target: "Caldria comprar el bitllet amb temps per no perdre'l al darrer moment.",
        en: "We should buy the ticket in advance so as not to miss it at the last moment.",
      },
      {
        target: "Tot mirant per la finestra, veig les muntanyes que queden molt lluny.",
        en: "While looking out the window, I see the mountains that are far away.",
      },
      {
        target: "M'agradaria tornar-hi l'any que ve amb tota la meva família.",
        en: "I would like to go back there next year with all my family.",
      },
    ],
  },
  {
    slug: "l5-001",
    level: "L5",
    titleTarget: "Si tingués més temps",
    titleEn: "If I had more time",
    sentences: [
      {
        target: "Si tingués més temps, aquest estiu viatjaria per tot el país sense cap pressa.",
        en: "If I had more time, this summer I would travel around the whole country without any hurry.",
      },
      {
        target: "M'agradaria conèixer gent nova, aprendre coses diferents i veure llocs que no conec.",
        en: "I would like to meet new people, learn different things and see places I don't know.",
      },
      {
        target: "Quan era jove, no tenia prou diners per viatjar gaire lluny de casa.",
        en: "When I was young, I didn't have enough money to travel very far from home.",
      },
      {
        target: "L'any passat, per fi, vaig estalviar prou per anar una setmana llarga a la muntanya.",
        en: "Last year, at last, I saved enough to go to the mountains for a long week.",
      },
      {
        target: "Si pogués decidir el lloc jo mateix, aniria a un poble tranquil molt a prop del mar.",
        en: "If I could decide the place myself, I would go to a quiet town very close to the sea.",
      },
      {
        target: "Espero que l'any que ve, si tot va bé, pugui fer per fi aquest viatge tan esperat.",
        en: "I hope that next year, if all goes well, I can finally take this long-awaited trip.",
      },
      {
        target: "Quan hi vagi, penso quedar-m'hi més d'una setmana per descansar bé.",
        en: "When I go there, I plan to stay more than a week to rest well.",
      },
    ],
  },
  {
    slug: "l5-002",
    level: "L5",
    titleTarget: "Una amistat de tota la vida",
    titleEn: "A lifelong friendship",
    sentences: [
      {
        target: "Fa més de vint anys que conec la meva millor amiga.",
        en: "I've known my best friend for more than twenty years.",
      },
      {
        target: "Quan érem petites, vivíem al mateix carrer i jugàvem juntes cada tarda després de l'escola.",
        en: "When we were little, we lived on the same street and played together every afternoon after school.",
      },
      {
        target: "Si ens veiéssim més sovint, la nostra amistat seria encara més forta.",
        en: "If we saw each other more often, our friendship would be even stronger.",
      },
      {
        target: "Ella sempre deia que volia viure a la ciutat, i finalment, fa uns anys, ho va fer.",
        en: "She always said she wanted to live in the city, and finally, a few years ago, she did it.",
      },
      {
        target: "Ara, si tinguéssim algun problema greu, sé que em trucaria de seguida.",
        en: "Now, if we had any serious problem, I know she would call me right away.",
      },
      {
        target: "M'agradaria que passéssim més temps juntes, com quan totes dues érem joves.",
        en: "I would like us to spend more time together, like when we were both young.",
      },
      {
        target: "L'estiu que ve, espero que vinguem juntes a la muntanya com cada any.",
        en: "Next summer, I hope we come together to the mountains like every year.",
      },
    ],
  },
  {
    slug: "l5-003",
    level: "L5",
    titleTarget: "La feina que voldria tenir",
    titleEn: "The job I would like to have",
    sentences: [
      {
        target: "Si pogués decidir la meva feina, treballaria en un lloc tranquil vora el mar.",
        en: "If I could choose my job, I would work in a quiet place by the sea.",
      },
      {
        target: "M'agradaria tenir un cap que escoltés les idees de tothom a l'equip.",
        en: "I would like to have a boss who listened to everyone's ideas on the team.",
      },
      {
        target: "Quan era estudiant, pensava que seria fàcil trobar una feina bona.",
        en: "When I was a student, I thought it would be easy to find a good job.",
      },
      {
        target: "Ara sé que cal treballar molt per aconseguir els somnis que tenim.",
        en: "Now I know you have to work hard to achieve the dreams you have.",
      },
      {
        target: "Si tingués una altra opció, canviaria de feina l'any que ve.",
        en: "If I had another option, I would change jobs next year.",
      },
      {
        target: "Espero que la feina següent sigui millor que aquesta i que arribi aviat.",
        en: "I hope the next job is better than this one and that it comes soon.",
      },
    ],
  },
  {
    slug: "l6-001",
    level: "L6",
    titleTarget: "Un poble que canvia",
    titleEn: "A town that is changing",
    sentences: [
      {
        target: "Fa deu anys, aquest poble era molt més tranquil que ara, quan gairebé no hi havia turistes.",
        en: "Ten years ago, this town was much quieter than now, when there were almost no tourists.",
      },
      {
        target: "Moltes cases velles s'han venut a gent que ve de la ciutat i hi passa només l'estiu.",
        en: "Many old houses have been sold to people who come from the city and only spend the summer there.",
      },
      {
        target: "Al veí de sempre li sap greu que el poble hagi canviat tant en tan poc temps.",
        en: "The longtime neighbor is sorry that the town has changed so much in such a short time.",
      },
      {
        target: "Si els preus no haguessin pujat tant, potser més joves s'hi haurien quedat a viure.",
        en: "If prices hadn't risen so much, perhaps more young people would have stayed to live there.",
      },
      {
        target: "Ara, quan es ven una casa vella al poble, algú que no és d'aquí sempre acaba comprant-la.",
        en: "Now, when an old house is sold in the town, someone who isn't from here always ends up buying it.",
      },
      {
        target: "M'agradaria que el poble no perdés mai el que sempre l'ha fet diferent dels altres.",
        en: "I would like the town to never lose what has always made it different from the others.",
      },
      {
        target: "Si ho pogués decidir ara mateix, hi tornaria a viure demà, sense pensar-m'ho dues vegades.",
        en: "If I could decide right now, I would move back there tomorrow, without thinking twice.",
      },
    ],
  },
  {
    slug: "l6-002",
    level: "L6",
    titleTarget: "Una decisió difícil",
    titleEn: "A difficult decision",
    sentences: [
      {
        target: "Al meu cap li fa por que jo deixi la feina abans que acabi el projecte que estem fent junts.",
        en: "My boss is afraid that I'll leave the job before finishing the project we're working on together.",
      },
      {
        target:
          "Als meus pares els fa il·lusió que torni a viure a prop d'ells, però jo encara no ho tinc clar del tot.",
        en: "My parents are excited that I'm moving back near them, but I still haven't fully made up my mind.",
      },
      {
        target: "Si no hagués trobat aquesta nova feina, ara mateix encara viuria a l'altra ciutat, lluny de tots ells.",
        en: "If I hadn't found this new job, right now I would still be living in the other city, far from all of them.",
      },
      {
        target: "La decisió no és fàcil, però crec que, al final, serà la millor per a tots.",
        en: "The decision isn't easy, but I believe that, in the end, it will be the best one for everyone.",
      },
      {
        target: "Als amics els explico la notícia; els sap greu, però m'entenen i em donen tot el seu suport.",
        en: "I tell my friends the news; they're sorry, but they understand me and give me all their support.",
      },
      {
        target: "Si pogués, els portaria a tots amb mi, perquè si hi vaig sol, sé que els trobaré molt a faltar.",
        en: "If I could, I would take them all with me, because if I go there alone, I know I will miss them a lot.",
      },
      {
        target: "Espero que, quan hi vagi, tot els vagi tan bé com fins ara.",
        en: "I hope that, when I go, everything goes as well for them as it has until now.",
      },
    ],
  },
  {
    slug: "l6-003",
    level: "L6",
    titleTarget: "Un regal per a tothom",
    titleEn: "A gift for everyone",
    sentences: [
      {
        target: "Cada any, quan arriba l'aniversari del meu avi, tota la família es reuneix per passar el dia junts.",
        en: "Every year, when my grandfather's birthday arrives, the whole family gets together to spend the day together.",
      },
      {
        target: "Aquest any he comprat un llibre per al meu avi, i l'hi donaré abans de dinar.",
        en: "This year I've bought a book for my grandfather, and I'll give it to him before lunch.",
      },
      {
        target: "A les meves cosines els he comprat unes sabates noves, i els les donaré aquesta tarda.",
        en: "For my cousins I've bought some new shoes, and I'll give them to them this afternoon.",
      },
      {
        target: "Al poble no hi ha gaires botigues, però n'hi ha una que sempre té coses boniques.",
        en: "There aren't many shops in the town, but there is one that always has nice things.",
      },
      {
        target: "Si el meu avi no hagués après a cuinar de jove, avui no podríem fer aquest plat tan bo.",
        en: "If my grandfather hadn't learned to cook when he was young, today we wouldn't be able to make this dish so good.",
      },
      {
        target: "Als meus cosins els agradaria que, quan siguem grans, encara ens hi trobem tots junts cada any.",
        en: "My cousins would like it if, when we're grown up, we still meet all together there every year.",
      },
      {
        target: "Si tot surt bé, l'any que ve tornarem a fer la mateixa festa, però en un lloc més gran.",
        en: "If all goes well, next year we'll have the same celebration again, but in a bigger place.",
      },
    ],
  },
];
