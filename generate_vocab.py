import json
import os

hobbies_words = [
    ("afició", "noun", "hobby", "La seva principal afició és la fotografia de natura.", "His main hobby is nature photography.", ["aficions"]),
    ("aficionat", "noun", "amateur / fan", "Sóc un gran aficionat al cinema clàssic.", "I am a big fan of classic cinema.", ["aficionats", "aficionada", "aficionades"]),
    ("amant", "noun", "lover / fan of", "És un amant de la música jazz en directe.", "He is a lover of live jazz music.", ["amants"]),
    ("apuntar-se", "verb", "to sign up / to enroll", "Ha decidit apuntar-se a un curs de ceràmica.", "He has decided to sign up for a pottery course.", ["apuntar", "m'apunto", "s'apunta"]),
    ("assajar", "verb", "to rehearse", "El grup de teatre necessita assajar dues hores més.", "The theater group needs to rehearse two more hours.", ["assaja", "assagem", "assajant"]),
    ("billar", "noun", "billiards / pool", "Els divendres anem al bar a jugar al billar.", "On Fridays we go to the bar to play pool.", ["billars"]),
    ("dansa", "noun", "dance", "La dansa contemporània requereix molta flexibilitat.", "Contemporary dance requires a lot of flexibility.", ["danses"]),
    ("bricolatge", "noun", "DIY (do it yourself)", "Fer bricolatge és ideal per arreglar els mobles de casa.", "Doing DIY is ideal for fixing the furniture at home.", ["bricolatges"]),
    ("bussejar", "verb", "to scuba dive", "A l'estiu li encanta bussejar a la Costa Brava.", "In the summer he loves to scuba dive on the Costa Brava.", ["busseja", "bussegem", "bussejant"]),
    ("campament", "noun", "camp", "El nen anirà a un campament d'estiu a la muntanya.", "The child will go to a summer camp in the mountains.", ["campaments"]),
    ("ceràmica", "noun", "pottery / ceramics", "Va fer un gerro preciós a la classe de ceràmica.", "She made a beautiful vase in pottery class.", ["ceràmiques"]),
    ("col·leccionar", "verb", "to collect", "Li agrada col·leccionar monedes antigues des de petit.", "He likes to collect old coins since he was little.", ["col·lecciona", "col·leccionem", "col·leccionat"]),
    ("competició", "noun", "competition", "Va guanyar la competició de natació del barri.", "He won the neighborhood swimming competition.", ["competicions"]),
    ("costura", "noun", "sewing", "Dedica el seu temps lliure a la costura.", "She dedicates her free time to sewing.", ["costures"]),
    ("pintura", "noun", "painting", "La pintura a l'oli és una tècnica que m'agrada molt.", "Oil painting is a technique I like very much.", ["pintures"]),
    ("dibuixar", "verb", "to draw", "Des de petit li agrada dibuixar paisatges.", "Since he was little he likes to draw landscapes.", ["dibuixa", "dibuixem", "dibuixant"]),
    ("distreure's", "verb", "to get distracted / to entertain oneself", "Llegir una novel·la és la millor manera de distreure's.", "Reading a novel is the best way to entertain oneself.", ["distreure", "es distreu", "em distrec"]),
    ("entretenir", "verb", "to entertain", "La música ajuda a entretenir el públic durant l'espera.", "The music helps to entertain the audience while waiting.", ["entretenim", "entretenen", "entretingut"]),
    ("entreteniment", "noun", "entertainment", "Aquest joc de taula és un gran entreteniment familiar.", "This board game is great family entertainment.", ["entreteniments"]),
    ("esbargir-se", "verb", "to recreate oneself / to relax", "L'objectiu principal de les vacances és esbargir-se una mica.", "The main goal of the holidays is to relax a bit.", ["esbargir", "m'esbargeixo", "s'esbargeix"]),
    ("escultura", "noun", "sculpture", "A les tardes assisteix a un taller d'escultura de fang.", "In the afternoons he attends a clay sculpture workshop.", ["escultures"]),
    ("escalada", "noun", "climbing", "L'escalada en roca és un esport molt exigent.", "Rock climbing is a very demanding sport.", ["escalades"]),
    ("escenari", "noun", "stage", "Té pànic de pujar a l'escenari davant de tanta gent.", "He is terrified of going on stage in front of so many people.", ["escenaris"]),
    ("excursionisme", "noun", "hiking / excursionism", "L'excursionisme és ideal per descobrir nous pobles.", "Hiking is ideal for discovering new towns.", ["excursionismes"]),
    ("exposició", "noun", "exhibition", "Aquesta tarda anirem a veure una exposició d'art contemporani.", "This afternoon we will go to see a contemporary art exhibition.", ["exposicions"]),
    ("gaudir", "verb", "to enjoy", "Vull gaudir del cap de setmana sense pensar en la feina.", "I want to enjoy the weekend without thinking about work.", ["gaudeix", "gaudeixo", "gaudint"]),
    ("ioga", "noun", "yoga", "Practicar ioga cada matí ajuda a relaxar els músculs.", "Practicing yoga every morning helps relax the muscles.", ["iogues"]),
    ("jardineria", "noun", "gardening", "La jardineria és perfecta per desconnectar de l'estrès.", "Gardening is perfect for disconnecting from stress.", ["jardineries"]),
    ("lleure", "noun", "leisure", "El sector del lleure és important per a la salut mental.", "The leisure sector is important for mental health.", ["lleures"]),
    ("manualitat", "noun", "craft", "A l'escola va fer una manualitat amb paper reciclat.", "At school he made a craft with recycled paper.", ["manualitats"]),
    ("meditar", "verb", "to meditate", "Sempre intenta meditar almenys deu minuts abans d'anar a dormir.", "He always tries to meditate at least ten minutes before going to sleep.", ["medita", "meditem", "meditant"]),
    ("oci", "noun", "leisure", "El sector de l'oci nocturn s'està recuperant a poc a poc.", "The nightlife leisure sector is slowly recovering.", ["ocis"]),
    ("passatemps", "noun", "pastime / hobby", "Fer puzles és un passatemps molt popular a l'hivern.", "Doing puzzles is a very popular pastime in winter.", ["passatemps"]),
    ("passejar", "verb", "to stroll / to walk", "Els diumenges acostumo a passejar pel parc amb el gos.", "On Sundays I usually walk in the park with the dog.", ["passeja", "passegem", "passejant"]),
    ("patinar", "verb", "to skate", "Anirem a patinar sobre gel aquest hivern amb els amics.", "We will go ice skating this winter with friends.", ["patina", "patinem", "patinant"]),
    ("pescar", "verb", "to fish", "El meu oncle sol pescar a la vora del riu.", "My uncle usually fishes by the river bank.", ["pesca", "pesquem", "pescant"]),
    ("pintar", "verb", "to paint", "L'artista va pintar un quadre de la muntanya de Montserrat.", "The artist painted a picture of the Montserrat mountain.", ["pinta", "pintem", "pintant"]),
    ("relaxar-se", "verb", "to relax", "Després d'entrenar, la millor opció és relaxar-se a la sauna.", "After training, the best option is to relax in the sauna.", ["relaxar", "em relaxo", "es relaxa"]),
    ("senderisme", "noun", "hiking", "El senderisme et permet estar en contacte amb la natura.", "Hiking allows you to be in contact with nature.", ["senderismes"]),
    ("taulell", "noun", "board (game)", "Hem comprat un joc de taulell molt divertit per a les festes.", "We bought a very fun board game for the holidays.", ["taulells"]),
    ("teixir", "verb", "to knit", "La meva àvia vol teixir un jersei de llana per al meu aniversari.", "My grandmother wants to knit a wool sweater for my birthday.", ["teixeix", "teixeixo", "teixint"]),
    ("torneig", "noun", "tournament", "L'equip participarà en un torneig de tennis la setmana vinent.", "The team will participate in a tennis tournament next week.", ["tornejos"]),
    ("xalar", "verb", "to have fun / to enjoy greatly", "Anem a la festa major amb ganes de xalar molt.", "We are going to the main festival wanting to have a lot of fun.", ["xala", "xalem", "xalant"]),
    ("xerrar", "verb", "to chat", "Ens agrada asseure'ns a la terrassa i xerrar tota la tarda.", "We like to sit on the terrace and chat all afternoon.", ["xerra", "xerrem", "xerrant"]),
    ("fotografia", "noun", "photography", "La fotografia analògica ha tornat a posar-se de moda recentment.", "Analog photography has recently become fashionable again.", ["fotografies"]),
    ("coral", "noun", "choir", "El meu germà canta a la coral de la universitat des de fa tres anys.", "My brother has been singing in the university choir for three years.", ["corals"]),
    ("acampar", "verb", "to camp", "Van decidir acampar prop del llac de Banyoles.", "They decided to camp near the lake of Banyoles.", ["acampa", "acampem", "acampant"]),
    ("apostar", "verb", "to bet", "No m'agrada apostar diners en cap mena de joc.", "I don't like to bet money in any kind of game.", ["aposta", "apostem", "apostant"]),
    ("entrenament", "noun", "training", "El seu entrenament per a la marató és molt exigent.", "His training for the marathon is very demanding.", ["entrenaments"]),
    ("col·leccionisme", "noun", "collecting", "El col·leccionisme de monedes requereix molta paciència i dedicació.", "Coin collecting requires a lot of patience and dedication.", ["col·leccionismes"])
]

relationships_words = [
    ("amistat", "noun", "friendship", "La nostra amistat va començar a la universitat fa deu anys.", "Our friendship started at university ten years ago.", ["amistats"]),
    ("parella", "noun", "couple / partner", "La seva parella treballa com a metge a l'hospital comarcal.", "His partner works as a doctor at the regional hospital.", ["parelles"]),
    ("enamorar-se", "verb", "to fall in love", "És molt fàcil enamorar-se quan coneixes algú tan especial.", "It's very easy to fall in love when you meet someone so special.", ["enamorar", "m'enamoro", "s'enamora"]),
    ("lligar", "verb", "to flirt / hook up", "Va intentar lligar amb ella a la discoteca però no va tenir sort.", "He tried to flirt with her at the club but had no luck.", ["lliga", "lliguem", "lligant"]),
    ("casar-se", "verb", "to get married", "Han decidit casar-se l'any que ve en una petita ermita.", "They have decided to get married next year in a small chapel.", ["casar", "es casen", "em caso"]),
    ("divorci", "noun", "divorce", "El seu divorci va ser un procés llarg i molt complicat.", "Their divorce was a long and very complicated process.", ["divorcis"]),
    ("separar-se", "verb", "to separate", "Després de moltes discussions, van decidir separar-se temporalment.", "After many arguments, they decided to separate temporarily.", ["separar", "es separen", "em separo"]),
    ("relació", "noun", "relationship", "Mantenir una relació a distància requereix molt d'esforç.", "Maintaining a long-distance relationship requires a lot of effort.", ["relacions"]),
    ("fidelitat", "noun", "fidelity", "La fidelitat és un valor fonamental en el seu matrimoni feliç.", "Fidelity is a fundamental value in their happy marriage.", ["fidelitats"]),
    ("infidel", "adj", "unfaithful", "Va descobrir amb tristesa que el seu marit havia estat infidel.", "She discovered with sadness that her husband had been unfaithful.", ["infidels"]),
    ("confiança", "noun", "trust", "Hem de construir la nostra unió basada en la confiança mútua.", "We must build our union based on mutual trust.", ["confiances"]),
    ("respecte", "noun", "respect", "El respecte és completament necessari per tenir una bona convivència.", "Respect is completely necessary to have a good cohabitation.", ["respectes"]),
    ("romàntic", "adj", "romantic", "Em va preparar un sopar romàntic amb espelmes al balcó de casa.", "He prepared a romantic candlelit dinner for me on the balcony at home.", ["romàntics", "romàntica", "romàntiques"]),
    ("cita", "noun", "date", "Demà tinc una cita amb un noi que vaig conèixer per internet.", "Tomorrow I have a date with a guy I met online.", ["cites"]),
    ("estimar", "verb", "to love", "Sempre et vaig estimar des del primer dia que ens vam veure.", "I always loved you from the first day we saw each other.", ["estima", "estimo", "estimant"]),
    ("abraçar", "verb", "to hug", "Després d'un dia dur, només volia abraçar la seva mare.", "After a hard day, she just wanted to hug her mother.", ["abraça", "abracem", "abraçant"]),
    ("petó", "noun", "kiss", "Em va fer un petó a la galta abans de marxar cap a la feina.", "He gave me a kiss on the cheek before leaving for work.", ["petons"]),
    ("besar", "verb", "to kiss", "Es volien besar sota la pluja com en una escena de pel·lícula.", "They wanted to kiss in the rain like in a movie scene.", ["besa", "besem", "besant"]),
    ("discutir", "verb", "to argue", "No m'agrada discutir amb els amics per temes de política.", "I don't like to argue with friends about politics.", ["discuteix", "discutim", "discutint"]),
    ("reconciliar-se", "verb", "to reconcile", "Van haver de parlar molt per reconciliar-se després de la baralla.", "They had to talk a lot to reconcile after the fight.", ["reconciliar", "es reconcilien", "em reconcilio"]),
    ("prometatge", "noun", "engagement", "Van celebrar el seu prometatge amb una gran festa al poble.", "They celebrated their engagement with a big party in the town.", ["prometatges"]),
    ("promès", "noun", "fiancé / engaged", "El meu promès viu a Barcelona per motius de feina actualment.", "My fiancé lives in Barcelona for work reasons currently.", ["promesos", "promesa", "promeses"]),
    ("casament", "noun", "wedding", "Al seu casament hi haurà més de dos-cents convidats de tot arreu.", "There will be more than two hundred guests from all over at their wedding.", ["casaments"]),
    ("nuvi", "noun", "groom / boyfriend", "El nuvi anava vestit amb un elegant vestit blau fosc.", "The groom was dressed in an elegant dark blue suit.", ["nuvis", "núvia", "núvies"]),
    ("convidar", "verb", "to invite", "Vull convidar tots els meus amics a sopar per al meu aniversari.", "I want to invite all my friends to dinner for my birthday.", ["convida", "convidem", "convidant"]),
    ("conegut", "noun", "acquaintance", "No som amics íntims, només és un conegut de la feina.", "We are not close friends, he is just an acquaintance from work.", ["coneguts", "coneguda", "conegudes"]),
    ("company", "noun", "companion / colleague", "El meu company de pis és molt ordenat i sempre està tranquil.", "My flatmate is very tidy and is always calm.", ["companys", "companya", "companyes"]),
    ("amistós", "adj", "friendly", "Sempre té un tracte amistós amb tothom qui coneix pel carrer.", "He always has a friendly demeanor with everyone he meets on the street.", ["amistosos", "amistosa", "amistoses"]),
    ("gelosia", "noun", "jealousy", "La gelosia malauradament va acabar destruint la seva llarga relació.", "Jealousy unfortunately ended up destroying their long relationship.", ["gelosies"]),
    ("gelós", "adj", "jealous", "Ell és massa gelós i no li agrada que surti sola de nit.", "He is too jealous and doesn't like her going out alone at night.", ["gelosos", "gelosa", "geloses"]),
    ("sinceritat", "noun", "sincerity", "Agraeixo la teva sinceritat tot i que la veritat faci una mica de mal.", "I appreciate your sincerity even though the truth hurts a bit.", ["sinceritats"]),
    ("sincer", "adj", "sincere", "Has de ser sincer amb ella i explicar-li què sents exactament.", "You must be sincere with her and explain exactly what you feel.", ["sincers", "sincera", "sinceres"]),
    ("mentir", "verb", "to lie", "Mai no has de mentir si vols mantenir la meva confiança sempre.", "You must never lie if you want to always keep my trust.", ["menteix", "mentim", "mentint"]),
    ("enganyar", "verb", "to deceive / cheat", "És molt trist descobrir que algú en qui confies t'ha intentat enganyar.", "It is very sad to discover that someone you trust has tried to deceive you.", ["enganya", "enganyem", "enganyant"]),
    ("perdonar", "verb", "to forgive", "No sé si algun dia seré capaç de perdonar el que em va fer.", "I don't know if I will ever be able to forgive what he did to me.", ["perdona", "perdonem", "perdonant"]),
    ("compartir", "verb", "to share", "M'agrada compartir el meu temps lliure amb la gent que estimo de debò.", "I like to share my free time with the people I truly love.", ["comparteix", "compartim", "compartint"]),
    ("trencar", "verb", "to break up", "Després de cinc anys junts, han decidit trencar definitivament la relació.", "After five years together, they have decided to definitively break up their relationship.", ["trenca", "trenquem", "trencant"]),
    ("admirar", "verb", "to admire", "No puc evitar admirar la seva immensa paciència i dedicació diària.", "I can't help but admire her immense patience and daily dedication.", ["admira", "admirem", "admirant"]),
    ("carinyós", "adj", "affectionate", "El meu gos és molt carinyós amb tots els nens petits del parc.", "My dog is very affectionate with all the small children in the park.", ["carinyosos", "carinyosa", "carinyoses"]),
    ("tendre", "adj", "tender", "Em va dedicar un somriure molt tendre abans de pujar al tren.", "He gave me a very tender smile before getting on the train.", ["tendres", "tendra"]),
    ("apassionat", "adj", "passionate", "L'escriptor va viure un amor apassionat durant les vacances d'estiu a Itàlia.", "The writer lived a passionate love during the summer holidays in Italy.", ["apassionats", "apassionada", "apassionades"]),
    ("solter", "adj", "single", "El seu germà gran continua solter perquè gaudeix de la seva independència.", "His older brother remains single because he enjoys his independence.", ["solters", "soltera", "solteres"]),
    ("casat", "adj", "married", "El meu cap està casat i té dos fills meravellosos a l'escola.", "My boss is married and has two wonderful children at school.", ["casats", "casada", "casades"]),
    ("vidu", "adj", "widower", "El senyor Joan és vidu des que va morir la seva dona l'any passat.", "Mr. Joan is a widower since his wife died last year.", ["vidus", "vídua", "vídues"]),
    ("atracció", "noun", "attraction", "Hi havia una forta atracció física entre ells des del primer moment que es van veure.", "There was a strong physical attraction between them from the first moment they saw each other.", ["atraccions"]),
    ("enamorament", "noun", "infatuation / falling in love", "L'enamorament inicial pot durar uns quants mesos abans de la rutina.", "The initial infatuation can last a few months before the routine.", ["enamoraments"]),
    ("lligam", "noun", "bond / tie", "Tenen un lligam molt estret des de la seva tendra infància junts.", "They have a very close bond since their tender childhood together.", ["lligams"]),
    ("conviure", "verb", "to live together", "Van decidir conviure un temps abans de fer el gran pas de casar-se.", "They decided to live together for a while before taking the big step of getting married.", ["conviu", "conviuen", "convivint"]),
    ("convivència", "noun", "cohabitation / living together", "La convivència diària a vegades provoca petits conflictes domèstics.", "Daily cohabitation sometimes causes small domestic conflicts.", ["convivències"]),
    ("seduir", "verb", "to seduce", "Va utilitzar el seu fantàstic sentit de l'humor per seduir el noi de la barra.", "She used her fantastic sense of humor to seduce the guy at the bar.", ["sedueix", "sedueixo", "seduint"])
]

def create_entries(words, prefix, tag):
    entries = []
    for idx, w in enumerate(words):
        entries.append({
            "id": f"lx-{prefix}-{idx+1}",
            "target": w[0],
            "targetNormalized": w[0],
            "word": w[0],
            "glossEn": w[2],
            "gloss": w[2],
            "pos": w[1],
            "freqRank": 999,
            "freqBand": 5,
            "register": "neutral",
            "variants": w[5],
            "exampleTarget": w[3],
            "example": w[3],
            "exampleEn": w[4],
            "tags": [tag, "CEFR B1"]
        })
    return entries

os.makedirs("/Users/ferran/repositories/dariapp/temp/lexicon_domains", exist_ok=True)
with open("/Users/ferran/repositories/dariapp/temp/lexicon_domains/b5_hobbies.json", "w", encoding="utf-8") as f:
    json.dump(create_entries(hobbies_words, "hobbies", "hobbies"), f, indent=2, ensure_ascii=False)

with open("/Users/ferran/repositories/dariapp/temp/lexicon_domains/b5_relationships.json", "w", encoding="utf-8") as f:
    json.dump(create_entries(relationships_words, "rel", "relationships"), f, indent=2, ensure_ascii=False)

print("Files generated.")
