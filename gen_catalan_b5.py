import json
import os

education_words = [
    ("qualificació", "noun", "grade or mark", "He obtingut una bona qualificació a l'examen.", "I got a good grade on the exam.", ["qualificacions"]),
    ("matricular", "verb", "to enroll", "Em vull matricular a la facultat de ciències.", "I want to enroll in the science faculty.", ["matricular-se"]),
    ("grau", "noun", "bachelor's degree", "Està estudiant un grau en enginyeria informàtica.", "He is studying a bachelor's degree in computer engineering.", ["graus"]),
    ("màster", "noun", "master's degree", "Després del grau, faré un màster en educació.", "After the bachelor's degree, I will do a master's degree in education.", ["màsters"]),
    ("doctorat", "noun", "doctorate", "Per fer recerca a la universitat cal tenir el doctorat.", "To do research at the university you need to have a doctorate.", ["doctorats"]),
    ("becari", "noun", "scholarship holder / intern", "El becari ajuda en les tasques de laboratori.", "The intern helps with the laboratory tasks.", ["becaris", "becària", "becàries"]),
    ("docent", "noun", "teacher / educator", "El personal docent de la universitat està en vaga.", "The university's teaching staff is on strike.", ["docents"]),
    ("acadèmic", "adjective", "academic", "L'expedient acadèmic és decisiu per obtenir la beca.", "The academic record is decisive for getting the scholarship.", ["acadèmics", "acadèmica", "acadèmiques"]),
    ("temari", "noun", "syllabus", "El temari d'aquesta assignatura és molt extens.", "The syllabus of this subject is very extensive.", ["temaris"]),
    ("quadrimestre", "noun", "four-month period / term", "Aquest quadrimestre tinc cinc assignatures obligatòries.", "This term I have five compulsory subjects.", ["quadrimestres"]),
    ("semestre", "noun", "semester", "Passaré el segon semestre estudiant a l'estranger.", "I will spend the second semester studying abroad.", ["semestres"]),
    ("parcial", "noun", "midterm exam", "La setmana que ve tenim l'examen parcial de matemàtiques.", "Next week we have the math midterm exam.", ["parcials"]),
    ("recuperació", "noun", "make-up exam / retake", "Si suspens, hauràs d'anar a la recuperació al setembre.", "If you fail, you will have to go to the retake in September.", ["recuperacions"]),
    ("repàs", "noun", "review / revision", "Farem una classe de repàs abans de la prova final.", "We will do a review class before the final test.", ["repassos"]),
    ("enquadernar", "verb", "to bind (a book/document)", "He d'anar a la copisteria a enquadernar el treball final.", "I need to go to the copy shop to bind the final project.", ["enquadernat"]),
    ("subratllar", "verb", "to underline", "Acostumo a subratllar les idees més importants amb un marcador.", "I usually underline the most important ideas with a highlighter.", ["subratllat"]),
    ("memoritzar", "verb", "to memorize", "No serveix de res memoritzar-ho tot si no ho entens.", "It's useless to memorize everything if you don't understand it.", ["memoritza"]),
    ("raonar", "verb", "to reason", "En aquesta resposta cal raonar els teus arguments.", "In this answer you must reason your arguments.", ["raonat"]),
    ("laboratori", "noun", "laboratory", "Hem fet experiments de química al laboratori del centre.", "We have done chemistry experiments in the school's laboratory.", ["laboratoris"]),
    ("ortografia", "noun", "orthography / spelling", "Les faltes d'ortografia resten punts a la nota final.", "Spelling mistakes deduct points from the final grade.", ["ortografies"]),
    ("sintaxi", "noun", "syntax", "L'anàlisi de la sintaxi d'aquesta oració és complicada.", "The syntax analysis of this sentence is complicated.", ["sintaxis"]),
    ("filosofia", "noun", "philosophy", "L'assignatura de filosofia ens fa reflexionar sobre l'existència.", "The philosophy subject makes us reflect on existence.", ["filosofies"]),
    ("química", "noun", "chemistry", "No entenc la taula periòdica de la classe de química.", "I don't understand the periodic table from the chemistry class.", ["químiques"]),
    ("física", "noun", "physics", "Les lleis de la física són fonamentals per a l'enginyeria.", "The laws of physics are fundamental for engineering.", ["físiques"]),
    ("biologia", "noun", "biology", "A biologia hem estudiat el funcionament de la cèl·lula.", "In biology we have studied the functioning of the cell.", ["biologies"]),
    ("tecnologia", "noun", "technology", "A l'aula de tecnologia construirem un circuit elèctric.", "In the technology classroom we will build an electrical circuit.", ["tecnologies"]),
    ("internat", "noun", "boarding school", "De petit el van enviar a un internat molt estricte.", "When he was little he was sent to a very strict boarding school.", ["internats"]),
    ("escolarització", "noun", "schooling", "L'escolarització obligatòria a Catalunya és fins als setze anys.", "Compulsory schooling in Catalonia is up to sixteen years old.", ["escolaritzacions"]),
    ("autodidacta", "adjective", "self-taught", "Va aprendre a programar de manera autodidacta.", "He learned to program in a self-taught way.", ["autodidactes"]),
    ("bilingüisme", "noun", "bilingualism", "El bilingüisme aporta molts avantatges cognitius als alumnes.", "Bilingualism brings many cognitive advantages to students.", ["bilingüismes"]),
    ("cal·ligrafia", "noun", "calligraphy / handwriting", "El mestre m'ha dit que he de millorar la meva cal·ligrafia.", "The teacher told me I need to improve my handwriting.", ["cal·ligrafies"]),
    ("croquis", "noun", "sketch", "Hem de dibuixar un croquis de la ciutat per a l'examen.", "We have to draw a sketch of the city for the exam.", ["croquis"]),
    ("didàctica", "noun", "didactics / teaching methodology", "Aquesta professora utilitza una didàctica molt innovadora.", "This teacher uses a very innovative teaching methodology.", ["didàctiques"]),
    ("estudiós", "adjective", "studious", "El meu fill petit és molt estudiós i sempre fa els deures.", "My youngest son is very studious and always does his homework.", ["estudiosos", "estudiosa", "estudioses"]),
    ("llicenciat", "noun", "graduate", "Ara és llicenciat en dret i busca feina en un bufet.", "He is now a law graduate and is looking for a job in a firm.", ["llicenciats", "llicenciada", "llicenciades"]),
    ("magistral", "adjective", "magisterial / master", "Hem assistit a una classe magistral sobre història medieval.", "We attended a master class on medieval history.", ["magistrals"]),
    ("optatiu", "adjective", "optional", "A quart d'ESO has de triar una assignatura optativa.", "In the fourth year of ESO you must choose an optional subject.", ["optatius", "optativa", "optatives"]),
    ("pedagog", "noun", "pedagogue / educationalist", "El pedagog va recomanar un canvi d'escola per al nen.", "The pedagogue recommended a change of school for the boy.", ["pedagogs", "pedagoga", "pedagogues"]),
    ("plagi", "noun", "plagiarism", "El professor va suspendre l'alumne per fer plagi al treball.", "The teacher failed the student for committing plagiarism in the assignment.", ["plagis"]),
    ("carpeta", "noun", "folder / binder", "He guardat tots els apunts en una carpeta blava.", "I kept all the notes in a blue folder.", ["carpetes"]),
    ("revàlida", "noun", "final examination", "Abans, per accedir a la universitat calia aprovar la revàlida.", "In the past, to enter university you had to pass the final examination.", ["revàlides"]),
    ("seminari", "noun", "seminar", "El departament de lletres organitza un seminari de poesia.", "The arts department organizes a poetry seminar.", ["seminaris"]),
    ("tesi", "noun", "thesis", "Està redactant la tesi doctoral sobre literatura catalana.", "He is writing his doctoral thesis on Catalan literature.", ["tesis"]),
    ("tribunal", "noun", "examining board", "El tribunal avaluarà la teva presentació del treball de recerca.", "The examining board will evaluate your presentation of the research project.", ["tribunals"]),
    ("vocació", "noun", "vocation", "Ser mestre no és només una feina, requereix molta vocació.", "Being a teacher is not just a job, it requires a lot of vocation.", ["vocacions"]),
    ("xerrada", "noun", "talk", "Ahir vam tenir una xerrada sobre orientació professional.", "Yesterday we had a talk on professional orientation.", ["xerrades"]),
    ("xuleta", "noun", "cheat sheet", "El van enxampar mirant una xuleta durant l'examen final.", "They caught him looking at a cheat sheet during the final exam.", ["xuletes"]),
    ("conferenciant", "noun", "speaker / lecturer", "El conferenciant va respondre totes les preguntes del públic.", "The speaker answered all the questions from the audience.", ["conferenciants"]),
    ("diplomatura", "noun", "diploma / three-year degree", "La diplomatura ha estat substituïda pel sistema de graus.", "The three-year degree has been replaced by the bachelor's system.", ["diplomatures"]),
    ("investigar", "verb", "to investigate / to research", "Han d'investigar els efectes del canvi climàtic per al projecte.", "They have to research the effects of climate change for the project.", ["investigat"])
]

transport_words = [
    ("transbordament", "noun", "transfer", "Has de fer transbordament a l'estació de Sants per arribar-hi.", "You have to transfer at Sants station to get there.", ["transbordaments"]),
    ("abonament", "noun", "season ticket / pass", "He comprat l'abonament mensual per al transport públic.", "I bought the monthly pass for public transport.", ["abonaments"]),
    ("trajecte", "noun", "journey / route", "El trajecte en tren dura aproximadament dues hores.", "The train journey takes approximately two hours.", ["trajectes"]),
    ("andana", "noun", "platform", "El tren amb destinació a Tarragona sortirà de l'andana tres.", "The train bound for Tarragona will depart from platform three.", ["andanes"]),
    ("passatger", "noun", "passenger", "Cada vagó té capacitat per a vuitanta passatgers.", "Each carriage can hold eighty passengers.", ["passatgers", "passatgera", "passatgeres"]),
    ("revisor", "noun", "ticket inspector", "El revisor m'ha demanat que li mostrés el bitllet.", "The ticket inspector asked me to show him my ticket.", ["revisors", "revisora", "revisores"]),
    ("maquinista", "noun", "train driver", "El maquinista va frenar de cop en veure l'obstacle a la via.", "The train driver braked suddenly upon seeing the obstacle on the track.", ["maquinistes"]),
    ("comboi", "noun", "train / convoy", "El primer comboi del matí surt a les sis en punt.", "The morning's first train departs at exactly six o'clock.", ["combois"]),
    ("vagó", "noun", "carriage / wagon", "Vaig pujar a l'últim vagó perquè hi havia menys gent.", "I got into the last carriage because there were fewer people.", ["vagons"]),
    ("locomotora", "noun", "locomotive", "La locomotora antiga de vapor s'exhibeix al museu.", "The old steam locomotive is exhibited in the museum.", ["locomotores"]),
    ("tramvia", "noun", "tram", "El tramvia recorre tota l'avinguda Diagonal de la ciutat.", "The tram runs along the entire Diagonal Avenue of the city.", ["tramvies"]),
    ("funicular", "noun", "funicular railway", "Vam pujar a la muntanya de Montjuïc amb el funicular.", "We went up Montjuïc mountain with the funicular railway.", ["funiculars"]),
    ("telefèric", "noun", "cable car", "Les vistes des del telefèric cap al port són espectaculars.", "The views from the cable car towards the port are spectacular.", ["telefèrics"]),
    ("metro", "noun", "subway / underground", "El metro és el transport més ràpid per moure's pel centre.", "The subway is the fastest transport to get around downtown.", ["metros"]),
    ("llançadora", "noun", "shuttle", "Hi ha un servei de llançadora que uneix l'hotel amb l'aeroport.", "There is a shuttle service connecting the hotel with the airport.", ["llançadores"]),
    ("ferri", "noun", "ferry", "Agafarem el ferri demà per anar a l'illa de Mallorca.", "We will take the ferry tomorrow to go to the island of Mallorca.", ["ferris"]),
    ("creuer", "noun", "cruise ship", "Han decidit passar les vacances en un gran creuer pel Mediterrani.", "They decided to spend their holidays on a large Mediterranean cruise ship.", ["creuers"]),
    ("aviació", "noun", "aviation", "La indústria de l'aviació ha millorat molt la seguretat els últims anys.", "The aviation industry has greatly improved safety in recent years.", ["aviacions"]),
    ("aerolínia", "noun", "airline", "Aquesta aerolínia ofereix vols molt barats per viatjar per Europa.", "This airline offers very cheap flights for travelling around Europe.", ["aerolínies"]),
    ("terminal", "noun", "terminal", "La porta d'embarcament és a la nova terminal de l'aeroport.", "The boarding gate is in the new airport terminal.", ["terminals"]),
    ("facturació", "noun", "check-in / baggage drop", "Hem de fer cua als taulells de facturació per deixar la maleta.", "We must queue at the check-in counters to drop off the suitcase.", ["facturacions"]),
    ("embarcament", "noun", "boarding", "Si us plau, tingueu preparada la targeta d'embarcament.", "Please, have your boarding pass ready.", ["embarcaments"]),
    ("duana", "noun", "customs", "Els agents de la duana van escorcollar el nostre equipatge.", "The customs agents searched our luggage.", ["duanes"]),
    ("peatge", "noun", "toll", "Per anar per aquesta autopista has de pagar un peatge de deu euros.", "To drive on this highway you have to pay a ten-euro toll.", ["peatges"]),
    ("autopista", "noun", "highway / motorway", "L'autopista estava buida i hem arribat ràpid a la ciutat.", "The highway was empty and we arrived quickly in the city.", ["autopistes"]),
    ("autovia", "noun", "dual carriageway", "Hem agafat l'autovia gratuïta per estalviar-nos els diners del peatge.", "We took the free dual carriageway to save toll money.", ["autovies"]),
    ("carretera", "noun", "road", "És una carretera de muntanya molt estreta i amb corbes.", "It is a very narrow mountain road with curves.", ["carreteres"]),
    ("rotonda", "noun", "roundabout", "Has de sortir a la tercera sortida de la rotonda principal.", "You have to take the third exit at the main roundabout.", ["rotondes"]),
    ("semàfor", "noun", "traffic light", "El cotxe no va frenar tot i que el semàfor estava en vermell.", "The car didn't brake even though the traffic light was red.", ["semàfors"]),
    ("cruïlla", "noun", "crossroads / intersection", "Gira a l'esquerra a la següent cruïlla per trobar l'estació.", "Turn left at the next intersection to find the station.", ["cruïlles"]),
    ("vorera", "noun", "sidewalk", "Les bicicletes no haurien de circular per la vorera.", "Bicycles should not ride on the sidewalk.", ["voreres"]),
    ("vianant", "noun", "pedestrian", "El pas de zebra dóna prioritat de pas a qualsevol vianant.", "The zebra crossing gives right of way to any pedestrian.", ["vianants"]),
    ("carril", "noun", "lane", "Has de conduir pel carril de la dreta a no ser que vulguis avançar.", "You must drive in the right lane unless you want to overtake.", ["carrils"]),
    ("asfalt", "noun", "asphalt", "Han renovat l'asfalt d'aquest carrer i ara els cotxes no fan soroll.", "They renewed the asphalt of this street and now cars make no noise.", ["asfalts"]),
    ("vehicle", "noun", "vehicle", "El meu vehicle híbrid gasta molt poca benzina a la ciutat.", "My hybrid vehicle uses very little gas in the city.", ["vehicles"]),
    ("furgoneta", "noun", "van", "L'empresa utilitza una furgoneta gran per fer els repartiments.", "The company uses a large van for deliveries.", ["furgonetes"]),
    ("camió", "noun", "truck", "Un camió de mercaderies ha bloquejat l'entrada del polígon.", "A freight truck blocked the entrance to the industrial estate.", ["camions"]),
    ("remolc", "noun", "trailer", "Han hagut de portar el cotxe amb un remolc cap al taller.", "They had to take the car with a trailer to the workshop.", ["remolcs"]),
    ("motocicleta", "noun", "motorcycle", "Al meu poble, la gent jove prefereix moure's en motocicleta.", "In my town, young people prefer getting around by motorcycle.", ["motocicletes"]),
    ("ciclomotor", "noun", "moped", "Té un ciclomotor antic que no pot superar els cinquanta per hora.", "He has an old moped that cannot exceed fifty per hour.", ["ciclomotors"]),
    ("patinet", "noun", "scooter", "S'ha comprat un patinet elèctric per anar a treballar més ràpid.", "He bought an electric scooter to get to work faster.", ["patinets"]),
    ("estacionament", "noun", "parking / parking lot", "És pràcticament impossible trobar estacionament en aquesta zona.", "It is practically impossible to find parking in this area.", ["estacionaments"]),
    ("parquímetre", "noun", "parking meter", "El parquímetre del carrer no accepta monedes, només targetes.", "The street parking meter doesn't accept coins, only cards.", ["parquímetres"]),
    ("embús", "noun", "traffic jam", "A primera hora del matí hi ha un embús terrible per entrar a la capital.", "First thing in the morning there is a terrible traffic jam to enter the capital.", ["embussos"]),
    ("caravana", "noun", "traffic tailback / convoy", "La forta pluja va provocar una gran caravana a la ronda de dalt.", "The heavy rain caused a major traffic tailback on the upper ring road.", ["caravanes"]),
    ("accelerar", "verb", "to accelerate / to speed up", "Has d'accelerar per incorporar-te correctament a l'autovia.", "You must accelerate to merge properly onto the dual carriageway.", ["accelerat"]),
    ("frenar", "verb", "to brake / to slow down", "El conductor va frenar per evitar atropellar el gos.", "The driver braked to avoid hitting the dog.", ["frenat"]),
    ("aparcar", "verb", "to park", "M'és molt difícil aparcar el cotxe en línia en espais petits.", "I find it very hard to parallel park the car in small spaces.", ["aparcat"]),
    ("avançar", "verb", "to overtake", "No es pot avançar en aquest tram perquè hi ha línia contínua.", "You cannot overtake on this stretch because there is a solid line.", ["avançat"]),
    ("recular", "verb", "to reverse / to back up", "Per treure el cotxe del garatge, he hagut de recular poc a poc.", "To get the car out of the garage, I had to reverse slowly.", ["reculat"])
]

def generate_json_array(word_list, tags):
    entries = []
    for idx, (word, pos, gloss, ex, ex_en, variants) in enumerate(word_list):
        entry = {
            "id": f"lx-TEMP-{tags[0]}-{idx+1}",
            "target": word,
            "targetNormalized": word,
            "glossEn": gloss,
            "pos": pos,
            "freqRank": 999,
            "freqBand": 5,
            "register": "neutral",
            "variants": variants,
            "exampleTarget": ex,
            "exampleEn": ex_en,
            "tags": tags
        }
        entries.append(entry)
    return entries

os.makedirs('/Users/ferran/repositories/dariapp/temp/lexicon_domains', exist_ok=True)

with open('/Users/ferran/repositories/dariapp/temp/lexicon_domains/b5_education.json', 'w', encoding='utf-8') as f:
    json.dump(generate_json_array(education_words, ["education"]), f, ensure_ascii=False, indent=2)

with open('/Users/ferran/repositories/dariapp/temp/lexicon_domains/b5_transport.json', 'w', encoding='utf-8') as f:
    json.dump(generate_json_array(transport_words, ["transport"]), f, ensure_ascii=False, indent=2)
