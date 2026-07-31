import json
import os

jobs_words = [
    ("advocat", "lawyer", "noun", ["advocats"], "L'advocat m'ha recomanat no signar el contracte encara.", "The lawyer advised me not to sign the contract yet."),
    ("arquitecte", "architect", "noun", ["arquitectes"], "L'arquitecte ha dissenyat un edifici molt modern.", "The architect has designed a very modern building."),
    ("fuster", "carpenter", "noun", ["fusters"], "El fuster està fabricant una taula de roure.", "The carpenter is making an oak table."),
    ("metge", "doctor", "noun", ["metges"], "El metge de capçalera em va receptar aquestes pastilles.", "The general practitioner prescribed these pills to me."),
    ("enginyer", "engineer", "noun", ["enginyers"], "Aquest pont va ser calculat per un enginyer reconegut.", "This bridge was calculated by a renowned engineer."),
    ("infermer", "nurse", "noun", ["infermers"], "L'infermer em va prendre la pressió arterial.", "The nurse took my blood pressure."),
    ("policia", "police officer", "noun", ["policies"], "El policia ens va indicar el camí cap a l'estació.", "The police officer pointed us to the way to the station."),
    ("bomber", "firefighter", "noun", ["bombers"], "Un bomber va rescatar el gat de l'arbre.", "A firefighter rescued the cat from the tree."),
    ("periodista", "journalist", "noun", ["periodistes"], "La periodista va fer preguntes molt incòmodes al polític.", "The journalist asked the politician very uncomfortable questions."),
    ("fotògraf", "photographer", "noun", ["fotògrafs"], "El fotògraf de la boda va fer unes fotos precioses.", "The wedding photographer took beautiful photos."),
    ("escriptor", "writer", "noun", ["escriptors"], "El meu escriptor favorit acaba de publicar una nova novel·la.", "My favorite writer has just published a new novel."),
    ("pintor", "painter", "noun", ["pintors"], "Hem contractat un pintor per repintar el menjador.", "We hired a painter to repaint the dining room."),
    ("actor", "actor", "noun", ["actors"], "L'actor principal de la pel·lícula ha guanyat un premi.", "The main actor of the movie has won an award."),
    ("cantant", "singer", "noun", ["cantants"], "La cantant té una veu molt potent.", "The singer has a very powerful voice."),
    ("músic", "musician", "noun", ["músics"], "El músic va afinar l'instrument abans del concert.", "The musician tuned the instrument before the concert."),
    ("mecànic", "mechanic", "noun", ["mecànics"], "El mecànic diu que el cotxe estarà llest demà.", "The mechanic says the car will be ready tomorrow."),
    ("perruquer", "hairdresser", "noun", ["perruquers"], "El perruquer m'ha tallat els cabells massa curts.", "The hairdresser cut my hair too short."),
    ("pastisser", "pastry chef", "noun", ["pastissers"], "El pastisser fa uns pastissos deliciosos.", "The pastry chef makes delicious cakes."),
    ("cuiner", "cook", "noun", ["cuiners"], "El cuiner ha preparat un menú de degustació increïble.", "The cook has prepared an incredible tasting menu."),
    ("cambrer", "waiter", "noun", ["cambrers"], "El cambrer ens va portar el compte de seguida.", "The waiter brought us the bill right away."),
    ("forner", "baker", "noun", ["forners"], "El forner es lleva molt d'hora per fer el pa.", "The baker gets up very early to make the bread."),
    ("dependent", "shop assistant", "noun", ["dependents"], "El dependent em va ajudar a triar la talla.", "The shop assistant helped me choose the size."),
    ("caixer", "cashier", "noun", ["caixers"], "El caixer del supermercat em va donar malament el canvi.", "The supermarket cashier gave me the wrong change."),
    ("botiguer", "shopkeeper", "noun", ["botiguers"], "El botiguer del barri coneix a tots els veïns.", "The neighborhood shopkeeper knows all the neighbors."),
    ("pagès", "farmer", "noun", ["pagesos"], "El pagès treballa la terra de sol a sol.", "The farmer works the land from sunrise to sunset."),
    ("pescador", "fisherman", "noun", ["pescadors"], "El pescador va tornar al port amb la xarxa plena.", "The fisherman returned to the port with a full net."),
    ("professor", "professor", "noun", ["professors"], "El professor de matemàtiques explica molt bé.", "The math professor explains very well."),
    ("mestre", "teacher", "noun", ["mestres"], "El mestre va renyar l'alumne per parlar a classe.", "The teacher scolded the student for talking in class."),
    ("director", "director", "noun", ["directors"], "El director de l'empresa va convocar una reunió urgent.", "The company director called an urgent meeting."),
    ("gerent", "manager", "noun", ["gerents"], "La gerent va presentar els resultats anuals.", "The manager presented the annual results."),
    ("secretari", "secretary", "noun", ["secretaris"], "El secretari va prendre nota de tot el que es va dir.", "The secretary took note of everything that was said."),
    ("comptable", "accountant", "noun", ["comptables"], "El comptable revisa els números de cada trimestre.", "The accountant reviews the numbers for each quarter."),
    ("informàtic", "computer scientist", "noun", ["informàtics"], "L'informàtic ha arreglat el problema de la xarxa.", "The computer scientist has fixed the network issue."),
    ("lampista", "plumber", "noun", ["lampistes"], "El lampista ha vingut a arreglar la fuita d'aigua.", "The plumber came to fix the water leak."),
    ("electricista", "electrician", "noun", ["electricistes"], "L'electricista va canviar els cables vells.", "The electrician changed the old cables."),
    ("carnisser", "butcher", "noun", ["carnissers"], "El carnisser em va tallar la carn molt prima.", "The butcher cut the meat very thin for me."),
    ("peixater", "fishmonger", "noun", ["peixaters"], "La peixatera em va recomanar el salmó fresc.", "The fishmonger recommended the fresh salmon."),
    ("oficinista", "office worker", "noun", ["oficinistes"], "L'oficinista passa vuit hores davant de l'ordinador.", "The office worker spends eight hours in front of the computer."),
    ("empresari", "entrepreneur", "noun", ["empresaris"], "Un jove empresari ha creat aquesta aplicació mòbil.", "A young entrepreneur created this mobile app."),
    ("jubilat", "retiree", "noun", ["jubilats"], "El meu avi és jubilat i viatja molt.", "My grandfather is a retiree and travels a lot."),
    ("desocupat", "unemployed", "noun", ["desocupats"], "Hi ha molts desocupats a la meva ciutat actualment.", "There are many unemployed people in my city currently."),
    ("atur", "unemployment", "noun", ["aturs"], "La taxa d'atur ha baixat aquest mes.", "The unemployment rate has gone down this month."),
    ("cap", "boss", "noun", ["caps"], "El meu cap m'ha demanat un informe per a demà.", "My boss asked me for a report for tomorrow."),
    ("empleat", "employee", "noun", ["empleats"], "Aquesta empresa té més de cent empleats.", "This company has more than a hundred employees."),
    ("treballador", "worker", "noun", ["treballadors"], "És un treballador molt responsable i puntual.", "He is a very responsible and punctual worker."),
    ("sou", "salary", "noun", ["sous"], "He demanat un augment de sou perquè faig més hores.", "I asked for a salary increase because I work more hours."),
    ("contracte", "contract", "noun", ["contractes"], "He signat un contracte indefinit amb l'empresa.", "I have signed a permanent contract with the company."),
    ("horari", "schedule", "noun", ["horaris"], "El meu horari de feina és molt flexible.", "My work schedule is very flexible."),
    ("despatx", "office", "noun", ["despatxos"], "La reunió serà al despatx del director.", "The meeting will be in the director's office."),
    ("empresa", "company", "noun", ["empreses"], "L'empresa s'ha traslladat a un nou edifici.", "The company has moved to a new building.")
]

emotions_words = [
    ("alegria", "joy", "noun", ["alegries"], "L'arribada del seu fill li va causar una gran alegria.", "The arrival of his child caused him great joy."),
    ("tristesa", "sadness", "noun", ["tristeses"], "Va sentir molta tristesa quan es va acomiadar dels seus amics.", "He felt a lot of sadness when he said goodbye to his friends."),
    ("ràbia", "anger", "noun", ["ràbies"], "Va colpejar la paret ple de ràbia.", "He hit the wall full of anger."),
    ("por", "fear", "noun", ["pors"], "Tinc molta por de volar en avió.", "I am very afraid of flying in a plane."),
    ("sorpresa", "surprise", "noun", ["sorpreses"], "Quina sorpresa trobar-te aquí!", "What a surprise to find you here!"),
    ("fàstic", "disgust", "noun", ["fàstics"], "Em fa fàstic el gust de la llet caducada.", "The taste of expired milk disgusts me."),
    ("amor", "love", "noun", ["amors"], "Sent un amor incondicional per la seva família.", "He feels unconditional love for his family."),
    ("odi", "hate", "noun", ["odis"], "L'odi no és un sentiment saludable per a ningú.", "Hate is not a healthy feeling for anyone."),
    ("enveja", "envy", "noun", ["enveges"], "Sentia una mica d'enveja en veure el cotxe nou del seu veí.", "He felt a bit of envy seeing his neighbor's new car."),
    ("gelosia", "jealousy", "noun", ["gelosies"], "La gelosia pot destruir una relació de parella.", "Jealousy can destroy a romantic relationship."),
    ("esperança", "hope", "noun", ["esperances"], "Mai s'ha de perdre l'esperança que les coses milloraran.", "One must never lose hope that things will improve."),
    ("desesperació", "despair", "noun", ["desesperacions"], "En moments de desesperació, és important demanar ajuda.", "In moments of despair, it's important to ask for help."),
    ("culpa", "guilt", "noun", ["culpes"], "No és culpa teva que l'ordinador s'hagi trencat.", "It's not your fault that the computer broke."),
    ("vergonya", "shame", "noun", ["vergonyes"], "Li feia tanta vergonya parlar en públic que es va posar vermell.", "He felt so much shame speaking in public that he turned red."),
    ("orgull", "pride", "noun", ["orgulls"], "La mare mira la seva filla graduar-se amb orgull.", "The mother watches her daughter graduate with pride."),
    ("satisfacció", "satisfaction", "noun", ["satisfaccions"], "Acabar la marató li va donar una gran satisfacció.", "Finishing the marathon gave him great satisfaction."),
    ("decepció", "disappointment", "noun", ["decepcions"], "Va ser una gran decepció no aprovar l'examen final.", "It was a great disappointment not to pass the final exam."),
    ("frustració", "frustration", "noun", ["frustracions"], "La frustració va anar creixent en veure que no avançaven.", "The frustration kept growing seeing that they weren't progressing."),
    ("il·lusió", "excitement", "noun", ["il·lusions"], "Tinc molta il·lusió de començar aquest nou projecte.", "I have a lot of excitement to start this new project."),
    ("avorriment", "boredom", "noun", ["avorriments"], "L'avorriment em fa menjar entre hores.", "Boredom makes me snack between meals."),
    ("ansietat", "anxiety", "noun", ["ansietats"], "Parlarem de tècniques per reduir l'ansietat abans d'un examen.", "We will talk about techniques to reduce anxiety before an exam."),
    ("estrès", "stress", "noun", ["estressos"], "Un alt nivell d'estrès pot ser perjudicial per a la salut.", "A high level of stress can be harmful to health."),
    ("calma", "calm", "noun", ["calmes"], "El mar està en completa calma avui.", "The sea is completely calm today."),
    ("tranquil·litat", "tranquility", "noun", ["tranquil·litats"], "Busco una mica de tranquil·litat al camp durant el cap de setmana.", "I seek some tranquility in the countryside during the weekend."),
    ("felicitat", "happiness", "noun", ["felicitats"], "Els diners no sempre compren la felicitat absoluta.", "Money doesn't always buy absolute happiness."),
    ("melancolia", "melancholy", "noun", ["melancolies"], "Els dies de pluja m'omplen d'una dolça melancolia.", "Rainy days fill me with a sweet melancholy."),
    ("enuig", "annoyance", "noun", ["enuigs"], "El seu enuig era evident en la seva veu tensa.", "His annoyance was evident in his tense voice."),
    ("indignació", "indignation", "noun", ["indignacions"], "La notícia sobre la corrupció va causar indignació pública.", "The news about corruption caused public indignation."),
    ("compassió", "compassion", "noun", ["compassions"], "Va sentir molta compassió pel gos abandonat al carrer.", "He felt great compassion for the abandoned dog on the street."),
    ("empatia", "empathy", "noun", ["empaties"], "Un bon psicòleg ha de tenir una gran empatia amb els pacients.", "A good psychologist must have great empathy with the patients."),
    ("simpatia", "sympathy", "noun", ["simpaties"], "La seva simpatia natural el fa tenir molts amics.", "His natural sympathy makes him have many friends."),
    ("antipatia", "antipathy", "noun", ["antipaties"], "Sempre he sentit una certa antipatia cap a les persones mentideres.", "I've always felt a certain antipathy towards lying people."),
    ("eufòria", "euphoria", "noun", ["eufòries"], "L'equip sencer va esclatar d'eufòria quan van marcar el gol.", "The whole team burst into euphoria when they scored the goal."),
    ("depressió", "depression", "noun", ["depressions"], "Ha passat per una forta depressió després de perdre la feina.", "He has gone through a severe depression after losing his job."),
    ("angoixa", "anguish", "noun", ["angoixes"], "No saber on és el nen m'està provocant una angoixa terrible.", "Not knowing where the child is causing me terrible anguish."),
    ("pànic", "panic", "noun", ["pànics"], "Quan va saltar l'alarma hi va haver moments de pànic.", "When the alarm went off there were moments of panic."),
    ("terror", "terror", "noun", ["terrors"], "M'encanten les pel·lícules de terror, tot i que després no dormo.", "I love terror movies, even though I don't sleep afterwards."),
    ("admiració", "admiration", "noun", ["admiracions"], "Sento una profunda admiració pels metges i infermers.", "I feel deep admiration for doctors and nurses."),
    ("respecte", "respect", "noun", ["respectes"], "El respecte mutu és essencial en qualsevol relació.", "Mutual respect is essential in any relationship."),
    ("menyspreu", "contempt", "noun", ["menyspreus"], "El va mirar amb menyspreu i va girar cua.", "She looked at him with contempt and turned away."),
    ("desig", "desire", "noun", ["desitjos"], "Tenia un fort desig de viatjar pel món un cop jubilada.", "She had a strong desire to travel the world once retired."),
    ("passió", "passion", "noun", ["passions"], "L'art i la pintura són la seva veritable passió.", "Art and painting are his true passion."),
    ("apatia", "apathy", "noun", ["apaties"], "Després del fracàs, va caure en una profunda apatia.", "After the failure, he fell into deep apathy."),
    ("confusió", "confusion", "noun", ["confusions"], "Les noves normes només han creat confusió entre els empleats.", "The new rules have only created confusion among employees."),
    ("certesa", "certainty", "noun", ["certeses"], "Tinc la certesa que tot sortirà bé al final.", "I have the certainty that everything will turn out fine in the end."),
    ("dubte", "doubt", "noun", ["dubtes"], "Em sorgeix el dubte de si ho hem fet correctament.", "The doubt arises as to whether we have done it correctly."),
    ("curiositat", "curiosity", "noun", ["curiositats"], "El nen ho toca tot impulsat per una curiositat infinita.", "The boy touches everything driven by infinite curiosity."),
    ("indiferència", "indifference", "noun", ["indiferències"], "M'ofèn més la teva indiferència que la teva crítica.", "Your indifference offends me more than your criticism."),
    ("entusiasme", "enthusiasm", "noun", ["entusiasmes"], "Els estudiants van acollir la idea amb gran entusiasme.", "The students welcomed the idea with great enthusiasm."),
    ("nostàlgia", "nostalgia", "noun", ["nostàlgies"], "Escoltar aquesta cançó em produeix molta nostàlgia del passat.", "Listening to this song gives me a lot of nostalgia for the past.")
]

def make_json(words, tag):
    entries = []
    for i, (word, gloss, pos, variants, exT, exEn) in enumerate(words):
        entries.append({
            "id": f"lx-TEMP-{tag}-{i+1}",
            "word": word,
            "target": word,
            "targetNormalized": word.lower(),
            "gloss": gloss,
            "glossEn": gloss,
            "pos": pos,
            "freqRank": 999,
            "freqBand": 5,
            "register": "neutral",
            "variants": variants,
            "example": exT,
            "exampleTarget": exT,
            "exampleEn": exEn,
            "tags": [tag]
        })
    return {"entries": entries}

os.makedirs('temp/lexicon_domains', exist_ok=True)
with open('temp/lexicon_domains/b5_jobs.json', 'w', encoding='utf-8') as f:
    json.dump(make_json(jobs_words, 'jobs'), f, ensure_ascii=False, indent=2)

with open('temp/lexicon_domains/b5_emotions.json', 'w', encoding='utf-8') as f:
    json.dump(make_json(emotions_words, 'emotions'), f, ensure_ascii=False, indent=2)

print(len(jobs_words))
print(len(emotions_words))
