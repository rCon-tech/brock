/**
 * The "win another life" question bank, themed on rock, paper and scissors (read broadly:
 * geology, gems and rock music; paper, printing and books; blades, hairdressing and tailoring).
 *
 * Ids are stable: a player never sees the same question twice until they've seen them all, so add
 * new questions with new ids and never reuse an old one. Only include facts that are settled and
 * unambiguous; a disputed answer feels unfair when a life is on the line.
 */
export type Theme = 'rock' | 'paper' | 'scissors';

export interface TriviaQuestion {
  id: string;
  theme: Theme;
  question: string;
  answer: string;
  wrong: [string, string, string];
}

const make =
  (theme: Theme) =>
  (
    id: string,
    question: string,
    answer: string,
    wrong: [string, string, string],
  ): TriviaQuestion => ({
    id: `${theme}-${id}`,
    theme,
    question,
    answer,
    wrong,
  });

const rock = make('rock');
const paper = make('paper');
const scissors = make('scissors');

export const QUESTIONS: TriviaQuestion[] = [
  // ---------------- ROCK: geology, minerals, gems, famous rocks, rock music ----------------
  rock('igneous', 'Which type of rock forms when magma or lava cools and solidifies?', 'Igneous', [
    'Sedimentary',
    'Metamorphic',
    'Evaporite',
  ]),
  rock('marble', 'Marble is the metamorphosed form of which rock?', 'Limestone', [
    'Granite',
    'Sandstone',
    'Shale',
  ]),
  rock('slate', 'Slate forms when which rock is metamorphosed?', 'Shale', [
    'Limestone',
    'Basalt',
    'Sandstone',
  ]),
  rock('beach-sand', 'Which mineral makes up most of the sand on typical beaches?', 'Quartz', [
    'Feldspar',
    'Calcite',
    'Mica',
  ]),
  rock('graphite', 'Which soft form of pure carbon is used in pencil “lead”?', 'Graphite', [
    'Galena',
    'Talc',
    'Molybdenite',
  ]),
  rock('talc', 'Which mineral is the softest on the Mohs scale, at 1?', 'Talc', [
    'Gypsum',
    'Calcite',
    'Mica',
  ]),
  rock('mohs-7', 'Which mineral sits at 7 on the Mohs hardness scale?', 'Quartz', [
    'Topaz',
    'Orthoclase feldspar',
    'Corundum',
  ]),
  rock('mohs-inventor', 'Who devised the 1-to-10 scale of mineral hardness?', 'Friedrich Mohs', [
    'Charles Richter',
    'James Hutton',
    'Charles Lyell',
  ]),
  rock('pyrite', 'Which mineral is commonly called “fool’s gold”?', 'Pyrite', [
    'Galena',
    'Mica',
    'Bauxite',
  ]),
  rock('ruby', 'A ruby is a red variety of which mineral?', 'Corundum', [
    'Garnet',
    'Spinel',
    'Tourmaline',
  ]),
  rock('emerald', 'An emerald is a green variety of which mineral?', 'Beryl', [
    'Corundum',
    'Tourmaline',
    'Olivine',
  ]),
  rock('amethyst', 'Amethyst is a purple variety of which mineral?', 'Quartz', [
    'Fluorite',
    'Corundum',
    'Beryl',
  ]),
  rock('peridot', 'Peridot is the gem form of which mineral?', 'Olivine', [
    'Garnet',
    'Beryl',
    'Zircon',
  ]),
  rock('april', 'Which gemstone is the modern birthstone for April?', 'Diamond', [
    'Emerald',
    'Ruby',
    'Opal',
  ]),
  rock(
    'cullinan',
    'What was the largest gem-quality rough diamond ever found, in South Africa in 1905?',
    'The Cullinan',
    ['The Hope Diamond', 'The Koh-i-Noor', 'The Regent'],
  ),
  rock(
    'pumice',
    'Which volcanic rock is so full of gas bubbles that it can float on water?',
    'Pumice',
    ['Obsidian', 'Basalt', 'Granite'],
  ),
  rock('obsidian', 'Obsidian is best described as what?', 'Volcanic glass', [
    'A metamorphic rock',
    'A fossil resin',
    'A sedimentary rock',
  ]),
  rock('calcite', 'Which mineral mainly makes up stalactites in limestone caves?', 'Calcite', [
    'Gypsum',
    'Quartz',
    'Halite',
  ]),
  rock('halite', 'What is the mineral name for rock salt?', 'Halite', [
    'Gypsum',
    'Calcite',
    'Sylvite',
  ]),
  rock('gypsum', 'Plaster of Paris is made by heating which mineral?', 'Gypsum', [
    'Calcite',
    'Talc',
    'Kaolinite',
  ]),
  rock('bauxite', 'Which rock is the main ore of aluminium?', 'Bauxite', [
    'Hematite',
    'Galena',
    'Cassiterite',
  ]),
  rock('galena', 'Galena is the main ore of which metal?', 'Lead', ['Zinc', 'Tin', 'Silver']),
  rock('cassiterite', 'Cassiterite is the main ore of which metal?', 'Tin', [
    'Copper',
    'Lead',
    'Nickel',
  ]),
  rock('hematite', 'Hematite is an important ore of which metal?', 'Iron', [
    'Copper',
    'Manganese',
    'Chromium',
  ]),
  rock(
    'cretaceous',
    'Which geological period ended with the extinction of the non-avian dinosaurs?',
    'Cretaceous',
    ['Jurassic', 'Triassic', 'Permian'],
  ),
  rock(
    'pangaea',
    'What is the name of the supercontinent that began breaking up around 200 million years ago?',
    'Pangaea',
    ['Gondwana', 'Laurasia', 'Rodinia'],
  ),
  rock(
    'moment-magnitude',
    'Which scale do seismologists now use instead of the Richter scale for large earthquakes?',
    'Moment magnitude scale',
    ['Mercalli scale', 'Beaufort scale', 'Fujita scale'],
  ),
  rock('vesuvius', 'Which volcano buried Pompeii in AD 79?', 'Vesuvius', [
    'Etna',
    'Stromboli',
    'Vulcano',
  ]),
  rock(
    'hutton',
    'Which Scottish scientist is often called the father of modern geology?',
    'James Hutton',
    ['Charles Lyell', 'William Smith', 'Louis Agassiz'],
  ),
  rock(
    'william-smith',
    'Who produced the first geological map of a whole country, Britain, in 1815?',
    'William Smith',
    ['James Hutton', 'Charles Lyell', 'Mary Anning'],
  ),
  rock(
    'anning',
    'Fossil hunter Mary Anning made her famous finds around which English town?',
    'Lyme Regis',
    ['Whitby', 'Scarborough', 'Brighton'],
  ),
  rock('neolithic', 'Which part of the Stone Age is named the “new stone” age?', 'Neolithic', [
    'Palaeolithic',
    'Mesolithic',
    'Chalcolithic',
  ]),
  rock('uluru-state', 'In which Australian state or territory is Uluru?', 'Northern Territory', [
    'Western Australia',
    'South Australia',
    'Queensland',
  ]),
  rock('uluru-rock', 'Uluru is made mainly of which rock?', 'Arkose sandstone', [
    'Granite',
    'Basalt',
    'Limestone',
  ]),
  rock('gibraltar-rock', 'The Rock of Gibraltar is made mainly of which rock?', 'Limestone', [
    'Granite',
    'Basalt',
    'Sandstone',
  ]),
  rock(
    'gibraltar-apes',
    'Which animals famously live wild on the Rock of Gibraltar?',
    'Barbary macaques',
    ['Rock hyraxes', 'Chamois', 'Mouflon'],
  ),
  rock('causeway', 'The Giant’s Causeway’s hexagonal columns are made of which rock?', 'Basalt', [
    'Granite',
    'Sandstone',
    'Limestone',
  ]),
  rock('rushmore', 'Mount Rushmore’s presidents are carved into which rock?', 'Granite', [
    'Marble',
    'Sandstone',
    'Basalt',
  ]),
  rock(
    'preseli',
    'Stonehenge’s smaller “bluestones” were brought from which hills?',
    'Preseli Hills',
    ['Cotswolds', 'Mendip Hills', 'Brecon Beacons'],
  ),
  rock('rosetta-museum', 'In which museum is the Rosetta Stone displayed?', 'British Museum', [
    'The Louvre',
    'Egyptian Museum, Cairo',
    'Metropolitan Museum of Art',
  ]),
  rock('rosetta-scripts', 'How many different scripts are inscribed on the Rosetta Stone?', '3', [
    '2',
    '4',
    '5',
  ]),
  rock('scone', 'The Stone of Scone is also known as the Stone of what?', 'Destiny', [
    'Kings',
    'Coronation',
    'Courage',
  ]),
  rock(
    'blarney',
    'Visitors to which Irish castle kiss a stone for “the gift of the gab”?',
    'Blarney Castle',
    ['Kilkenny Castle', 'Bunratty Castle', 'Cahir Castle'],
  ),
  rock('cashel', 'In which country is the Rock of Cashel?', 'Ireland', [
    'Scotland',
    'Wales',
    'England',
  ]),
  rock(
    'curling',
    'Granite for Olympic curling stones famously comes from which Scottish island?',
    'Ailsa Craig',
    ['Skye', 'Arran', 'Iona'],
  ),
  rock(
    'plymouth',
    'Plymouth Rock is traditionally where passengers of which ship landed in 1620?',
    'Mayflower',
    ['Speedwell', 'Susan Constant', 'Endeavour'],
  ),
  rock('alcatraz', 'Which former island prison was nicknamed “The Rock”?', 'Alcatraz', [
    'Robben Island',
    'Rikers Island',
    'Devil’s Island',
  ]),
  rock(
    'the-rock-uni',
    'Dwayne “The Rock” Johnson played college football for which university?',
    'University of Miami',
    ['Florida State', 'USC', 'Alabama'],
  ),
  rock('rocky-city', 'In the film Rocky, which city is Rocky Balboa from?', 'Philadelphia', [
    'Pittsburgh',
    'Boston',
    'Detroit',
  ]),
  rock('back-in-black', 'Which band released the album Back in Black?', 'AC/DC', [
    'Def Leppard',
    'Kiss',
    'Motörhead',
  ]),
  rock('hall-of-fame', 'In which city is the Rock and Roll Hall of Fame?', 'Cleveland', [
    'Memphis',
    'Nashville',
    'Detroit',
  ]),
  rock(
    'rolling-stones',
    'The Rolling Stones took their name from a song by which bluesman?',
    'Muddy Waters',
    ['Chuck Berry', 'Howlin’ Wolf', 'Bo Diddley'],
  ),

  // ---------------- PAPER: papermaking, printing, books, money, origami, pop culture ----------------
  paper('invented', 'In which country was paper invented?', 'China', ['Egypt', 'Japan', 'Persia']),
  paper(
    'cai-lun',
    'Who is traditionally credited with inventing paper, around AD 105?',
    'Cai Lun',
    ['Bi Sheng', 'Zhang Heng', 'Shen Kuo'],
  ),
  paper('papyrus', 'What was papyrus made from?', 'A reed-like water plant', [
    'Animal skin',
    'Tree bark',
    'Rice straw',
  ]),
  paper('word-paper', 'The word “paper” comes from which ancient writing material?', 'Papyrus', [
    'Parchment',
    'Vellum',
    'Pergamon',
  ]),
  paper('vellum', 'Fine vellum is traditionally made from what?', 'Calfskin', [
    'Papyrus reed',
    'Cotton rag',
    'Mulberry bark',
  ]),
  paper('pergamon', 'The word “parchment” comes from which ancient city?', 'Pergamon', [
    'Petra',
    'Byblos',
    'Alexandria',
  ]),
  paper(
    'byblos',
    'The ancient paper-trading port of Byblos gave its name to which word?',
    'Bible',
    ['Book', 'Library', 'Papyrus'],
  ),
  paper(
    'washi',
    'Traditional Japanese washi paper is usually made from the bark of which plant?',
    'Kōzo (paper mulberry)',
    ['Bamboo', 'Cherry', 'Cedar'],
  ),
  paper('a4', 'What are the dimensions of a sheet of A4 paper?', '210 × 297 mm', [
    '216 × 279 mm',
    '200 × 300 mm',
    '220 × 310 mm',
  ]),
  paper('a0', 'How many A4 sheets make up one sheet of A0?', '16', ['8', '12', '32']),
  paper('ratio', 'What is the ratio of the sides of every A-series paper size?', '1 : √2', [
    '2 : 3',
    '1 : 1.5',
    'The golden ratio',
  ]),
  paper('gsm', 'In paper weights, what does “gsm” stand for?', 'Grams per square metre', [
    'Grain strength measure',
    'Gloss surface measure',
    'Grams per sheet made',
  ]),
  paper('octavo', 'A sheet folded to make 8 leaves (16 pages) gives which book format?', 'Octavo', [
    'Quarto',
    'Folio',
    'Duodecimo',
  ]),
  paper('mache', 'What does the French “papier-mâché” literally mean?', 'Chewed paper', [
    'Folded paper',
    'Glued paper',
    'Torn paper',
  ]),
  paper(
    'crane',
    'In Japanese tradition, folding a thousand of which origami bird grants a wish?',
    'Crane',
    ['Swan', 'Dove', 'Heron'],
  ),
  paper(
    'kirigami',
    'Kirigami differs from origami because it also involves what?',
    'Cutting the paper',
    ['Gluing the paper', 'Painting the paper', 'Wetting the paper'],
  ),
  paper('gutenberg-city', 'In which city did Johannes Gutenberg print his famous Bible?', 'Mainz', [
    'Strasbourg',
    'Cologne',
    'Nuremberg',
  ]),
  paper(
    'caxton',
    'Who set up the first printing press in England, in the 1470s?',
    'William Caxton',
    ['Wynkyn de Worde', 'Thomas Malory', 'Richard Pynson'],
  ),
  paper(
    'diamond-sutra',
    'What is the world’s oldest surviving dated printed book, from AD 868?',
    'The Diamond Sutra',
    ['The Gutenberg Bible', 'The Book of Kells', 'The Jikji'],
  ),
  paper('kells', 'In which library is the Book of Kells kept?', 'Trinity College Dublin', [
    'The British Library',
    'The Bodleian Library',
    'National Library of Scotland',
  ]),
  paper('isbn', 'What does ISBN stand for?', 'International Standard Book Number', [
    'International Serial Book Number',
    'Indexed Standard Book Number',
    'International Standard Binding Number',
  ]),
  paper('isbn-digits', 'How many digits does a modern ISBN have?', '13', ['10', '12', '16']),
  paper('penguin', 'Who founded Penguin Books in 1935?', 'Allen Lane', [
    'John Murray',
    'Victor Gollancz',
    'Stanley Unwin',
  ]),
  paper(
    'fahrenheit',
    'Who wrote Fahrenheit 451, named after the temperature at which book paper supposedly burns?',
    'Ray Bradbury',
    ['George Orwell', 'Aldous Huxley', 'Philip K. Dick'],
  ),
  paper('paper-towns', 'Who wrote the novel Paper Towns?', 'John Green', [
    'Rainbow Rowell',
    'David Levithan',
    'Stephen Chbosky',
  ]),
  paper(
    'anne-frank',
    'Whose diary was written in a red-and-white checked autograph book?',
    'Anne Frank',
    ['Samuel Pepys', 'Virginia Woolf', 'Frida Kahlo'],
  ),
  paper('ft', 'Which newspaper is famously printed on salmon-pink paper?', 'Financial Times', [
    'The Times',
    'The Wall Street Journal',
    'The Economist',
  ]),
  paper(
    'dollar',
    'US dollar banknotes are printed on paper made mainly of what?',
    'Cotton and linen',
    ['Wood pulp', 'Polymer plastic', 'Hemp and silk'],
  ),
  paper(
    'polymer',
    'Which country introduced the first polymer (plastic) banknotes, in 1988?',
    'Australia',
    ['Canada', 'New Zealand', 'United Kingdom'],
  ),
  paper('hundred', 'Whose portrait is on the US $100 bill?', 'Benjamin Franklin', [
    'George Washington',
    'Alexander Hamilton',
    'Ulysses S. Grant',
  ]),
  paper('rand', 'The rand is the paper currency of which country?', 'South Africa', [
    'Namibia',
    'Botswana',
    'Zimbabwe',
  ]),
  paper('post-it', 'Which company invented Post-it notes?', '3M', ['Avery', 'Staples', 'Xerox']),
  paper('kleenex', 'Which company makes Kleenex tissues?', 'Kimberly-Clark', [
    'Procter & Gamble',
    'Georgia-Pacific',
    '3M',
  ]),
  paper('litmus', 'Blue litmus paper turns which colour in acid?', 'Red', [
    'Green',
    'Yellow',
    'Purple',
  ]),
  paper('anniversary', 'Paper is the traditional gift for which wedding anniversary?', 'First', [
    'Second',
    'Fifth',
    'Tenth',
  ]),
  paper(
    'paper-moon',
    'Who won an Oscar for Paper Moon, becoming the youngest competitive winner?',
    'Tatum O’Neal',
    ['Jodie Foster', 'Drew Barrymore', 'Linda Blair'],
  ),
  paper('paper-planes', 'Which artist had a hit with “Paper Planes”?', 'M.I.A.', [
    'Santigold',
    'Lily Allen',
    'Kate Nash',
  ]),
  paper('paper-mario', 'Paper Mario first appeared on which games console?', 'Nintendo 64', [
    'GameCube',
    'Super Nintendo',
    'Wii',
  ]),
  paper(
    'dunder',
    'In the US version of The Office, what is the name of the paper company?',
    'Dunder Mifflin',
    ['Wernham Hogg', 'Sabre', 'Staples'],
  ),
  paper(
    'wernham',
    'In the UK version of The Office, what is the name of the paper company?',
    'Wernham Hogg',
    ['Dunder Mifflin', 'Slough Paper Co.', 'Hogg & Partners'],
  ),

  // ---------------- SCISSORS: blades, cutting tools, hairdressing, tailoring, pop culture ----------------
  scissors(
    'romans',
    'Which civilisation is generally credited with pivoted, cross-bladed scissors?',
    'The Romans',
    ['The Egyptians', 'The Chinese', 'Renaissance Italians'],
  ),
  scissors(
    'sheffield',
    'Which English city is famous for its steel, cutlery and scissor-making?',
    'Sheffield',
    ['Birmingham', 'Manchester', 'Leeds'],
  ),
  scissors('solingen', 'Which German city is known as the “City of Blades”?', 'Solingen', [
    'Essen',
    'Stuttgart',
    'Dortmund',
  ]),
  scissors(
    'fiskars',
    'Fiskars, maker of orange-handled scissors, comes from which country?',
    'Finland',
    ['Sweden', 'Denmark', 'Norway'],
  ),
  scissors('pinking', 'What kind of edge do pinking shears cut?', 'Zigzag', [
    'Rolled',
    'Frayed',
    'Perforated',
  ]),
  scissors(
    'metzenbaum',
    'What are surgical Metzenbaum scissors mainly used for?',
    'Dissecting delicate tissue',
    ['Cutting bandages', 'Cutting sutures', 'Cutting bone'],
  ),
  scissors(
    'tailors-ham',
    'In sewing, what is a “tailor’s ham”?',
    'A firm cushion for pressing curved seams',
    ['A cut of pork', 'A tailor’s dummy', 'A measuring stick'],
  ),
  scissors('savile-row', 'In which city is Savile Row, home of bespoke tailoring?', 'London', [
    'Milan',
    'Paris',
    'Edinburgh',
  ]),
  scissors('no1-savile', 'Which tailor is at No. 1 Savile Row?', 'Gieves & Hawkes', [
    'Henry Poole',
    'Huntsman',
    'Anderson & Sheppard',
  ]),
  scissors('sassoon', 'Which hairdresser created the 1960s “five-point cut”?', 'Vidal Sassoon', [
    'Paul Mitchell',
    'John Frieda',
    'Nicky Clarke',
  ]),
  scissors(
    'number-one',
    'How long does a “number 1” clipper guard leave hair?',
    '⅛ inch (about 3 mm)',
    ['1 mm', '¼ inch (about 6 mm)', '½ inch (about 13 mm)'],
  ),
  scissors('rachel', 'Which TV show gave its name to the 1990s haircut “the Rachel”?', 'Friends', [
    'Glee',
    'Ally McBeal',
    'Seinfeld',
  ]),
  scissors(
    'barber-pole',
    'The red and white barber’s pole originally advertised which service?',
    'Bloodletting and surgery',
    ['A royal warrant', 'A tailors’ guild', 'A public bath'],
  ),
  scissors('sweeney', 'Who is “the demon barber of Fleet Street”?', 'Sweeney Todd', [
    'Figaro',
    'Fagin',
    'Jack Wild',
  ]),
  scissors(
    'figaro',
    'What is the name of the barber in Rossini’s The Barber of Seville?',
    'Figaro',
    ['Almaviva', 'Bartolo', 'Basilio'],
  ),
  scissors('burton', 'Who directed Edward Scissorhands?', 'Tim Burton', [
    'Terry Gilliam',
    'Sam Raimi',
    'Joel Schumacher',
  ]),
  scissors('depp', 'Who played the title role in Edward Scissorhands?', 'Johnny Depp', [
    'Jim Carrey',
    'Gary Oldman',
    'Christian Slater',
  ]),
  scissors('price', 'In Edward Scissorhands, who played Edward’s inventor?', 'Vincent Price', [
    'Christopher Lee',
    'Peter Cushing',
    'Alan Arkin',
  ]),
  scissors(
    'krueger',
    'Freddy Krueger, with his bladed glove, first appeared in which film?',
    'A Nightmare on Elm Street',
    ['Friday the 13th', 'Halloween', 'Scream'],
  ),
  scissors(
    'scissor-sisters',
    'Which band had a 2006 hit with “I Don’t Feel Like Dancin’”?',
    'Scissor Sisters',
    ['The Killers', 'Franz Ferdinand', 'Keane'],
  ),
  scissors('guillotine', 'The guillotine is named after which man?', 'Joseph-Ignace Guillotin', [
    'Antoine Louis',
    'Maximilien Robespierre',
    'Charles-Henri Sanson',
  ]),
  scissors(
    'daisho',
    'The katana and which shorter sword together form the samurai’s daishō?',
    'Wakizashi',
    ['Tantō', 'Tachi', 'Nodachi'],
  ),
  scissors(
    'excalibur',
    'In many versions of the legend, who gives King Arthur the sword Excalibur?',
    'The Lady of the Lake',
    ['Merlin', 'Morgan le Fay', 'Guinevere'],
  ),
  scissors(
    'victorinox',
    'Victorinox, maker of the Swiss Army knife, combines “Victoria” with which word?',
    'Inox (stainless steel)',
    ['Innovation', 'Knox', 'Nox'],
  ),
  scissors('opinel', 'Opinel folding knives come from which country?', 'France', [
    'Italy',
    'Spain',
    'Switzerland',
  ]),
  scissors('bowie', 'The Bowie knife is named after whom?', 'Jim Bowie', [
    'David Bowie',
    'Davy Crockett',
    'Kit Carson',
  ]),
  scissors(
    'mezzaluna',
    'What does the name of the curved “mezzaluna” chopping blade mean in Italian?',
    'Half moon',
    ['Little knife', 'Double edge', 'Rocking blade'],
  ),
  scissors(
    'topiary',
    'What is the art of clipping shrubs into ornamental shapes called?',
    'Topiary',
    ['Bonsai', 'Espalier', 'Ikebana'],
  ),
  scissors(
    'golden-shears',
    'Which country hosts the Golden Shears sheep-shearing championships?',
    'New Zealand',
    ['Australia', 'Wales', 'Scotland'],
  ),
  scissors('budding', 'Who invented the lawnmower, in 1830?', 'Edwin Budding', [
    'John Deere',
    'Joseph Bramah',
    'James Ransome',
  ]),
  scissors(
    'gillette',
    'King C. Gillette is known for inventing what?',
    'The disposable safety-razor blade',
    ['The straight razor', 'The electric shaver', 'Aerosol shaving foam'],
  ),
  scissors('schick', 'Who patented the first electric razor, in 1928?', 'Jacob Schick', [
    'King C. Gillette',
    'Alfred Braun',
    'Gerard Philips',
  ]),
  scissors('occam', 'What does Occam’s razor favour?', 'The simplest explanation', [
    'The oldest explanation',
    'The most detailed explanation',
    'The most popular explanation',
  ]),
  scissors(
    'chelae',
    'What is the scientific name for the pincer claws of crabs and lobsters?',
    'Chelae',
    ['Mandibles', 'Pedipalps', 'Chelicerae'],
  ),
];
