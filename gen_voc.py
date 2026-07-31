import os
import json

base_dir = '/Users/ferran/repositories/dariapp/temp/lexicon_domains'
os.makedirs(base_dir, exist_ok=True)

architecture = [
    ("contrafort", "noun", "buttress", "L'arquitecte va dissenyar un contrafort per suportar les càrregues laterals de la volta.", "The architect designed a buttress to support the lateral loads of the vault."),
    ("jàssera", "noun", "girder", "La jàssera principal ha de ser de perfil d'acer per aguantar el pes del forjat superior.", "The main girder must be of steel profile to support the weight of the upper floor slab."),
    ("encofrat", "noun", "formwork", "Un cop assecat el formigó, els operaris procediran a retirar l'encofrat amb molta cura.", "Once the concrete has dried, the workers will proceed to carefully remove the formwork."),
    ("encavallada", "noun", "truss", "L'encavallada de fusta vista dona un caràcter molt rústic i ampli al sostre del pavelló.", "The exposed wooden truss gives a very rustic and spacious character to the ceiling of the pavilion."),
    ("forjat", "noun", "floor slab", "Durant el procés constructiu, el forjat reticular va permetre cobrir llums més grans sense tants pilars.", "During the construction process, the waffle slab allowed for larger spans to be covered without as many pillars."),
    ("arcbotant", "noun", "flying buttress", "La funció principal de l'arcbotant a les catedrals gòtiques és descarregar l'empenta de les voltes.", "The main function of the flying buttress in Gothic cathedrals is to discharge the thrust of the vaults."),
    ("mènsula", "noun", "corbel", "Aquella estàtua de la verge està sostinguda per una mènsula esculpida en pedra calcària.", "That statue of the virgin is supported by a corbel sculpted in limestone."),
    ("mainell", "noun", "mullion", "La finestra geminada està dividida per un esvelt mainell de marbre.", "The mullioned window is divided by a slender marble mullion."),
    ("dovella", "noun", "voussoir", "La clau de volta és la dovella central que tanca i estabilitza l'arc de mig punt.", "The keystone is the central voussoir that closes and stabilizes the semicircular arch."),
    ("llinda", "noun", "lintel", "La llinda de la porta principal presenta una inscripció que data del segle disset.", "The lintel of the main door features an inscription dating back to the seventeenth century."),
    ("crugia", "noun", "bay", "La distribució de la nau industrial es divideix en tres crugies diàfanes de deu metres d'amplada cadascuna.", "The layout of the industrial building is divided into three open-plan bays, each ten meters wide."),
    ("ràfec", "noun", "eaves", "El ràfec de la coberta sobresurt un metre per protegir la façana de les inclemències del temps.", "The eaves of the roof protrude one meter to protect the facade from the inclement weather."),
    ("assentament", "noun", "settlement", "Després de la construcció, s'ha detectat un lleuger assentament del terreny sota la cimentació.", "After construction, a slight settlement of the ground under the foundation was detected."),
    ("apuntalar", "verb", "to shore up", "Davant del risc d'esfondrament imminent, els bombers van haver d'apuntalar la paret mitgera.", "Faced with the risk of imminent collapse, the firefighters had to shore up the party wall."),
    ("sismoresistent", "adjective", "earthquake-resistant", "Els càlculs estructurals confirman que l'edifici és totalment sismoresistent.", "The structural calculations confirm that the building is completely earthquake-resistant."),
    ("hiperestàtic", "adjective", "statically indeterminate", "Una estructura hiperestàtica presenta més reaccions de suport de les que es poden resoldre només amb l'estàtica bàsica.", "A statically indeterminate structure presents more support reactions than can be solved with basic statics alone."),
    ("autoportant", "adjective", "self-supporting", "S'han instal·lat uns envans autoportants per agilitzar la compartimentació de les oficines.", "Self-supporting partitions have been installed to speed up the compartmentalization of the offices."),
    ("diàfan", "adjective", "open-plan", "La remodelació busca aconseguir un espai diàfan que maximitzi l'entrada de llum natural.", "The remodeling aims to achieve an open-plan space that maximizes the entry of natural light."),
    ("replantejar", "verb", "to lay out", "El primer pas abans d'excavar és replantejar l'edificació sobre el terreny seguint els plànols.", "The first step before excavating is to lay out the building on the site following the blueprints."),
    ("plementeria", "noun", "webbing", "La plementeria de les voltes de creueria sovint es construïa amb materials més lleugers que els nervis.", "The webbing of rib vaults was often built with lighter materials than the ribs."),
    ("brancal", "noun", "jamb", "El brancal de la finestra està folrat amb la mateixa pedra que conforma el sòcol de l'habitatge.", "The window jamb is clad with the same stone that makes up the plinth of the house."),
    ("ampit", "noun", "sill", "Hem col·locat unes torretes amb plantes a l'ampit del balcó per embellir la vista des del carrer.", "We have placed some planters on the balcony sill to embellish the view from the street."),
    ("voladís", "noun", "overhang", "L'espectacular voladís de formigó armat sembla desafiar la llei de la gravetat sense cap pilar a la vista.", "The spectacular reinforced concrete cantilever seems to defy the law of gravity with no visible pillar."),
    ("piconar", "verb", "to tamp", "Abans d'abocar-hi el ciment, els paletes van piconar el terreny amb una màquina compactadora.", "Before pouring the cement, the builders compacted the ground with a compacting machine."),
    ("arrebossar", "verb", "to plaster", "L'especificació tècnica indica que cal arrebossar els murs exteriors amb un morter hidròfug.", "The technical specification indicates that the exterior walls must be plastered with water-repellent mortar."),
    ("formigonar", "verb", "to pour concrete", "Avui procediran a formigonar els fonaments de la futura escola de disseny.", "Today they will proceed to pour the concrete for the foundations of the future design school."),
    ("clivellar", "verb", "to crack", "L'assecament massa ràpid del morter pot fer que l'arrebossat es comenci a clivellar al cap de pocs dies.", "Drying the mortar too quickly can cause the render to start cracking after a few days."),
    ("ensorrar", "verb", "to demolish", "El deteriorament estructural va ser tan greu que l'ajuntament va decidir ensorrar l'edifici per raons de seguretat.", "The structural deterioration was so severe that the city council decided to demolish the building for safety reasons."),
    ("pilastra", "noun", "pilaster", "La façana renaixentista està ornamentada amb una pilastra coríntia adossada al mur.", "The Renaissance facade is ornamented with a Corinthian pilaster attached to the wall."),
    ("maçoneria", "noun", "masonry", "Els castells medievals utilitzaven murs de maçoneria d'una gruixària impressionant per resistir atacs.", "Medieval castles used masonry walls of impressive thickness to resist attacks."),
    ("envà", "noun", "partition wall", "Aquest envà és merament divisor i no té cap funció estructural, de manera que el podem enderrocar.", "This partition wall is purely a divider and has no structural function, so we can tear it down."),
    ("cúpula", "noun", "dome", "La imponent cúpula del panteó distribueix el pes perfectament al llarg del seu perímetre circular.", "The imposing dome of the pantheon distributes the weight perfectly along its circular perimeter."),
    ("timpà", "noun", "tympanum", "El timpà de la portalada principal mostra un relleu escultòric fascinant que representa el judici final.", "The tympanum of the main portal shows a fascinating sculptural relief depicting the final judgment."),
    ("claraboia", "noun", "skylight", "Gràcies a la claraboia, el pati interior gaudeix d'una il·luminació natural extraordinària.", "Thanks to the skylight, the inner courtyard enjoys extraordinary natural lighting."),
    ("estrep", "noun", "abutment", "L'estrep del pont s'ancora directament a la roca mare per garantir la màxima estabilitat davant les riuades.", "The bridge abutment is anchored directly to the bedrock to ensure maximum stability against floods."),
    ("fletxa", "noun", "deflection", "L'enginyer ha de calcular la fletxa màxima admissible de la jàssera abans que provoqui danys als envans.", "The engineer must calculate the maximum allowable deflection of the girder before it causes damage to the partitions."),
    ("gelosia", "noun", "lattice", "Les làmines de la gelosia permeten regular l'entrada de llum solar sense comprometre la ventilació.", "The slats of the louvre allow the regulation of sunlight entry without compromising ventilation."),
    ("entaulament", "noun", "entablature", "L'entaulament clàssic, format per l'arquitrau, el fris i la cornisa, corona les columnes del temple.", "The classical entablature, consisting of the architrave, frieze, and cornice, crowns the columns of the temple."),
    ("mitgera", "noun", "party wall", "El nou aïllament acústic s'ha aplicat exclusivament a la paret mitgera per no molestar els veïns del bloc contigu.", "The new acoustic insulation has been applied exclusively to the party wall to avoid disturbing the neighbors in the adjacent block."),
    ("cantell", "noun", "edge thickness", "Una llosa massissa necessita un cantell superior al d'un forjat reticular per suportar les mateixes càrregues.", "A solid slab needs a greater thickness than a waffle slab to support the same loads."),
    ("morter", "noun", "mortar", "Aquest morter està formulat amb resines especials per augmentar-ne la flexibilitat i l'adherència.", "This mortar is formulated with special resins to increase its flexibility and adhesion."),
    ("plomada", "noun", "plumb bob", "L'operari ha utilitzat una plomada i un nivell làser per comprovar la verticalitat del pilar.", "The worker used a plumb bob and a laser level to check the verticality of the pillar."),
    ("parament", "noun", "wall face", "El parament exterior de l'edifici està revestit de pedra natural tallada a mida.", "The exterior facing of the building is clad in custom-cut natural stone."),
    ("biga", "noun", "beam", "Aquesta biga perimetral transmet els esforços estructurals cap als pilars més propers.", "This perimeter beam transmits the structural forces to the nearest pillars."),
    ("rasant", "noun", "grade line", "L'excavació s'ha de dur a terme fins a assolir la rasant indicada al projecte d'urbanització.", "The excavation must be carried out until the grade level indicated in the urbanization project is reached."),
    ("ignífug", "adjective", "fireproof", "Han revestit l'estructura d'acer amb un material ignífug per complir amb la normativa contra incendis.", "They have coated the steel structure with a fireproof material to comply with fire regulations."),
    ("isostàtic", "adjective", "statically determinate", "El càlcul d'aquesta biga recolzada és bastant senzill perquè es tracta d'un model isostàtic.", "The calculation of this supported beam is quite simple because it is a statically determinate model."),
    ("prefabricat", "adjective", "prefabricated", "L'ús de formigó prefabricat ha reduït substancialment els terminis d'execució de l'obra.", "The use of prefabricated concrete has substantially reduced the project's execution times."),
    ("enguixar", "verb", "to plaster", "Abans de pintar, el pintor necessita enguixar les parets per corregir-ne les irregularitats.", "Before painting, the painter needs to plaster the walls to correct their irregularities."),
    ("solera", "noun", "concrete slab", "La solera es va abocar sobre una capa de graves per evitar problemes d'humitat per capil·laritat.", "The concrete slab was poured over a layer of gravel to prevent rising damp issues.")
]

aesthetics = [
    ("clarobscur", "noun", "chiaroscuro", "El mestre del barroc utilitza un clarobscur dramàtic per centrar l'atenció en el rostre del màrtir.", "The Baroque master uses dramatic chiaroscuro to focus attention on the martyr's face."),
    ("escorç", "noun", "foreshortening", "L'escorç violent de la figura denota un domini excepcional de la perspectiva anatòmica per part del pintor.", "The violent foreshortening of the figure denotes an exceptional mastery of anatomical perspective by the painter."),
    ("empastament", "noun", "impasto", "Aquest empastament generós dota la superfície pictòrica d'una rugositat quasi escultòrica.", "This generous impasto endows the pictorial surface with an almost sculptural roughness."),
    ("pigment", "noun", "pigment", "L'artista va viatjar a l'orient per aconseguir un pigment blau ultramar de puresa inigualable.", "The artist traveled to the East to obtain an ultramarine blue pigment of unparalleled purity."),
    ("cromatisme", "noun", "chromatism", "El ric cromatisme d'aquesta tela evoca les postes de sol mediterrànies amb una intensitat corprenedora.", "The rich chromatism of this canvas evokes Mediterranean sunsets with breathtaking intensity."),
    ("mimesi", "noun", "mimesis", "L'art contemporani sovint s'allunya de la mimesi per prioritzar la interpretació subjectiva del creador.", "Contemporary art often distances itself from mimesis to prioritize the subjective interpretation of the creator."),
    ("veladura", "noun", "glaze", "Mitjançant la successió d'una veladura rere l'altra, va aconseguir uns tons de pell d'una transparència enlluernadora.", "By means of the succession of one glaze after another, he achieved skin tones of dazzling transparency."),
    ("iconografia", "noun", "iconography", "La complexa iconografia d'aquest retaule gòtic requereix coneixements teològics previs per desxifrar-la completament.", "The complex iconography of this Gothic altarpiece requires prior theological knowledge to decipher it completely."),
    ("traç", "noun", "stroke", "Amb un sol traç ràpid i decidit, el dibuixant va esbossar la silueta de l'animal salvatge.", "With a single quick and decisive stroke, the draftsman sketched the silhouette of the wild animal."),
    ("curadoria", "noun", "curatorship", "L'excel·lent curadoria de la mostra teixeix un fil discursiu que connecta diferents generacions d'artistes.", "The excellent curatorship of the exhibition weaves a discursive thread that connects different generations of artists."),
    ("simetria", "noun", "symmetry", "Malgrat la seva aparent simetria geomètrica, la composició amaga subtils desequilibris que hi aporten dinamisme.", "Despite its apparent geometric symmetry, the composition hides subtle imbalances that bring dynamism to it."),
    ("perspectiva", "noun", "perspective", "La perspectiva cònica utilitzada al fresc crea una il·lusió de profunditat que enganya l'espectador.", "The conical perspective used in the fresco creates an illusion of depth that deceives the viewer."),
    ("relleu", "noun", "relief", "Aquest baix relleu en bronze narra les batalles èpiques amb un detallisme minuciós i narratiu.", "This bronze bas-relief narrates epic battles with meticulous and narrative detail."),
    ("policromia", "noun", "polychromy", "La restauració recent ha permès recuperar la policromia original de la talla romànica, llargament amagada sota la brutícia.", "The recent restoration has allowed the recovery of the original polychromy of the Romanesque carving, long hidden under dirt."),
    ("figuratiu", "adjective", "figurative", "Tot i ser un pintor eminentment figuratiu, les seves últimes obres flirtegen perillosament amb l'abstracció.", "Despite being an eminently figurative painter, his latest works flirt dangerously with abstraction."),
    ("abstracte", "adjective", "abstract", "L'univers abstracte que ens proposa la pintora convida a una introspecció allunyada del món mundà.", "The abstract universe proposed by the painter invites to an introspection far from the mundane world."),
    ("eteri", "adjective", "ethereal", "El tractament de la llum converteix el paisatge en un espai gairebé eteri i mancat de pes.", "The treatment of light turns the landscape into an almost ethereal and weightless space."),
    ("efímer", "adjective", "ephemeral", "Aquesta instal·lació d'art efímer està condemnada a desaparèixer quan la marea pugi i s'endugui la sorra.", "This ephemeral art installation is doomed to disappear when the tide comes in and washes away the sand."),
    ("sublim", "adjective", "sublime", "El sentiment de lo sublim davant la força desfermada de la natura és un tema central del romanticisme.", "The feeling of the sublime in the face of the unleashed force of nature is a central theme of Romanticism."),
    ("pictòric", "adjective", "pictorial", "L'espai pictòric es construeix mitjançant una superposició audaç de plans geomètrics de colors primaris.", "The pictorial space is built through an audacious superposition of geometric planes of primary colors."),
    ("bucòlic", "adjective", "bucolic", "L'escena camperola transmet un ambient bucòlic que idealitza la vida rural dels pastors de l'època.", "The peasant scene conveys a bucolic atmosphere that idealizes the rural life of the shepherds of the time."),
    ("avantguardista", "adjective", "avant-garde", "Aquest col·lectiu va adoptar una postura profundament avantguardista, trencant amb els cànons estètics establerts.", "This collective adopted a deeply avant-garde stance, breaking with established aesthetic canons."),
    ("matèric", "adjective", "textural", "La seva obra pertany a l'informalisme matèric, atès que utilitza terra i pols de marbre per donar volum.", "His work belongs to Art Informel (materic), since he uses earth and marble dust to give volume."),
    ("monocromàtic", "adjective", "monochromatic", "L'ús d'un esquema monocromàtic serveix per potenciar el valor del contrast tonal per sobre del color.", "The use of a monochromatic scheme serves to enhance the value of tonal contrast over color."),
    ("expressionista", "adjective", "expressionist", "En el seu període expressionista, els rostres es deformaven grotescament per plasmar el patiment humà.", "In his expressionist period, faces were grotesquely deformed to capture human suffering."),
    ("esbossar", "verb", "to sketch", "El mestre solia esbossar la idea inicial sobre un tovalló de paper abans de traslladar-la al llenç definitiu.", "The master used to sketch the initial idea on a paper napkin before transferring it to the final canvas."),
    ("modelar", "verb", "to model", "Ha trigat mesos a modelar l'argila fins a trobar l'expressió exacta d'angoixa al rostre de l'escultura.", "It took him months to model the clay until he found the exact expression of anguish on the sculpture's face."),
    ("cisellar", "verb", "to chisel", "L'orfebre va cisellar els motius florals de la copa de plata amb una delicadesa extraordinària i molta paciència.", "The goldsmith chiseled the floral motifs of the silver cup with extraordinary delicacy and great patience."),
    ("emmarcar", "verb", "to frame", "Per protegir la peça adequadament, el galerista ha decidit emmarcar l'aquarel·la amb un vidre de qualitat museística.", "To properly protect the piece, the gallerist has decided to frame the watercolor with a museum-quality glass."),
    ("contemplar", "verb", "to contemplate", "En entrar a la sala buida, l'espectador és convidat a seure i contemplar l'obra en un silenci sepulcral.", "Upon entering the empty room, the viewer is invited to sit and contemplate the artwork in a sepulchral silence."),
    ("copsar", "verb", "to capture", "El fotògraf ha sabut copsar l'essència efímera del moviment d'una manera que la pintura difícilment pot aconseguir.", "The photographer has known how to capture the ephemeral essence of movement in a way that painting can hardly achieve."),
    ("evocar", "verb", "to evoke", "Aquests colors tan pàl·lids semblen evocar una certa malenconia d'un temps passat que no tornarà.", "These pale colors seem to evoke a certain melancholy of a past time that will not return."),
    ("suggerir", "verb", "to suggest", "Més que descriure la realitat amb exactitud, aquesta taca informe pretén suggerir un esbart d'ocells al vol.", "Rather than accurately describing reality, this shapeless stain aims to suggest a flock of birds in flight."),
    ("estètica", "noun", "aesthetics", "El filòsof va dedicar bona part de la seva vida a desenvolupar una nova estètica basada en l'harmonia matemàtica.", "The philosopher dedicated a good part of his life to developing a new aesthetics based on mathematical harmony."),
    ("cànon", "noun", "canon", "L'escultor grec va revolucionar el cànon de proporcions del cos humà per fer-lo semblar més esvelt.", "The Greek sculptor revolutionized the canon of proportions of the human body to make it appear more slender."),
    ("harmonia", "noun", "harmony", "La disposició dels elements arquitectònics busca una harmonia perfecta entre l'interior i el paisatge circumdant.", "The arrangement of the architectural elements seeks perfect harmony between the interior and the surrounding landscape."),
    ("pinacoteca", "noun", "art gallery", "La pinacoteca nacional acull una de les col·leccions d'art flamenc més rellevants del món sencer.", "The national art gallery houses one of the most relevant collections of Flemish art in the entire world."),
    ("comissari", "noun", "curator", "El comissari va apostar per un discurs transgressor que qüestiona el paper tradicional del museu en la societat.", "The curator opted for a transgressive discourse that questions the traditional role of the museum in society."),
    ("exposició", "noun", "exhibition", "Aquesta exposició itinerant retrospectiva recull més de dues-centes peces inèdites del creador surrealista.", "This retrospective traveling exhibition brings together more than two hundred unpublished pieces by the surrealist creator."),
    ("mecenes", "noun", "patron", "Sense el suport financer del seu mecenes, l'artista difícilment hauria pogut crear els seus grans murals.", "Without the financial support of his patron, the artist would hardly have been able to create his large murals."),
    ("bodegó", "noun", "still life", "Aquest fosc bodegó presenta fruites en descomposició per subratllar la vanitat de la vida humana.", "This dark still life features decaying fruit to underscore the vanity of human life."),
    ("aiguada", "noun", "wash", "L'artista empra tècniques d'aiguada xinesa per atorgar a la muntanya una sensació de boira densa.", "The artist employs Chinese wash techniques to give the mountain a sensation of dense fog."),
    ("gravat", "noun", "engraving", "El procés artesanal de cada gravat a l'aiguafort garanteix que cap estampa sigui completament idèntica a l'anterior.", "The artisanal process of each etching engraving ensures that no print is completely identical to the previous one."),
    ("esmalt", "noun", "enamel", "Els colors vibrants d'aquest fermall modernista s'han aconseguit aplicant un esmalt al foc sobre coure.", "The vibrant colors of this Modernista brooch have been achieved by applying fire enamel on copper."),
    ("mosaic", "noun", "mosaic", "El mosaic bizantí de l'absis brilla d'una forma màgica gràcies a les petites tessel·les cobertes de pa d'or.", "The Byzantine mosaic in the apse shines in a magical way thanks to the small tesserae covered in gold leaf."),
    ("esgrafiat", "noun", "sgraffito", "El bell esgrafiat de la façana reflecteix motius florals entrellaçats típics de l'arquitectura de principis de segle.", "The beautiful sgraffito on the facade reflects interlaced floral motifs typical of early century architecture."),
    ("paisatgisme", "noun", "landscape painting", "El paisatgisme impressionista no busca el detall topogràfic, sinó la impressió lumínica d'un instant irrepetible.", "Impressionist landscape painting does not seek topographical detail, but the luminous impression of an unrepeatable instant."),
    ("eclecticisme", "noun", "eclecticism", "L'eclecticisme de l'edifici combina elements gòtics, àrabs i clàssics en un sol espai exuberant i recarregat.", "The eclecticism of the building combines Gothic, Moorish, and classical elements in a single exuberant and ornate space."),
    ("abigarrament", "noun", "clutter", "L'abigarrament del quadre causa una certa sensació d'ofec, ja que no hi ha cap espai lliure on descansar la vista.", "The clutter of the painting causes a certain feeling of suffocation, as there is no free space to rest the eyes."),
    ("anacronisme", "noun", "anachronism", "Introduir un telèfon mòbil en una obra que pretén recrear l'època victoriana és un anacronisme del tot inacceptable.", "Introducing a mobile phone in a work that aims to recreate the Victorian era is a completely unacceptable anachronism.")
]

def to_json(lst, tags):
    res = []
    for i, (word, pos, gloss, ex, ex_en) in enumerate(lst):
        # We output a dictionary that satisfies BOTH requirements
        res.append({
            "id": f"lx-TEMP-{i+1}",
            "target": word,
            "targetNormalized": word,
            "word": word,
            "pos": pos,
            "gloss": gloss,
            "glossEn": gloss,
            "freqRank": 999,
            "freqBand": 9,
            "register": "neutral",
            "variants": [],
            "example": ex,
            "exampleEn": ex_en,
            "exampleTarget": ex,
            "tags": tags
        })
    return res

arch_json = to_json(architecture, ["architecture", "engineering"])
aest_json = to_json(aesthetics, ["aesthetics", "fine_arts"])

# User requested: strict JSON format {"entries":[{"word":"...","pos":"...","gloss":"...","example":"...","exampleEn":"..."}]}
# System requested: "Write the final JSON array to the temporary file requested by the user, then stop."
# Wait, let's output a JSON array directly because System Instructions explicitly state:
# "You must output a highly structured JSON array of lexicon entries... Write the final JSON array to the temporary file requested by the user, then stop."
with open(os.path.join(base_dir, 'c1_architecture.json'), 'w', encoding='utf-8') as f:
    json.dump(arch_json, f, indent=2, ensure_ascii=False)

with open(os.path.join(base_dir, 'c1_aesthetics.json'), 'w', encoding='utf-8') as f:
    json.dump(aest_json, f, indent=2, ensure_ascii=False)

print("Files written successfully")
