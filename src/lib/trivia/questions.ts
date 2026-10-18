/**
 * The "win another life" question bank, themed on rock, paper and scissors (read broadly:
 * geology, gems, famous stones and rock music; paper money, books, printing and stationery;
 * blades, hairdressing, sewing and the rock-paper-scissors game itself).
 *
 * Questions are pitched at a friendly pub quiz: well-known facts and pop culture, short enough
 * to read and answer in 15 seconds, with no specialist terminology or obscure dates.
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
  // ---------------- ROCK: geology, gems, famous rocks and stones, rock music ----------------
  rock('e-geologist', 'What do you call a scientist who studies rocks?', 'Geologist', [
    'Biologist',
    'Astronomer',
    'Botanist',
  ]),
  rock('e-queen', 'Which band sang “We Will Rock You”?', 'Queen', ['ABBA', 'The Beatles', 'Oasis']),
  rock('e-stonehenge', 'In which country is Stonehenge?', 'England', [
    'Scotland',
    'Ireland',
    'France',
  ]),
  rock('e-uluru', 'In which country is Uluru, also called Ayers Rock?', 'Australia', [
    'New Zealand',
    'South Africa',
    'Canada',
  ]),
  rock('e-rosetta', 'Which museum displays the Rosetta Stone?', 'British Museum', [
    'The Louvre',
    'Vatican Museums',
    'The Prado',
  ]),
  rock('e-the-rock', 'Which actor and ex-wrestler is nicknamed “The Rock”?', 'Dwayne Johnson', [
    'Vin Diesel',
    'Jason Statham',
    'John Cena',
  ]),
  rock('e-rocky', 'Which actor played the boxer Rocky Balboa?', 'Sylvester Stallone', [
    'Bruce Willis',
    'Mel Gibson',
    'Arnold Schwarzenegger',
  ]),
  rock('e-diamond', 'Which gem is the hardest natural mineral?', 'Diamond', [
    'Ruby',
    'Emerald',
    'Opal',
  ]),
  rock('e-ruby', 'What colour is a ruby?', 'Red', ['Green', 'Blue', 'Purple']),
  rock('e-emerald', 'What colour is an emerald?', 'Green', ['Red', 'Blue', 'Yellow']),
  rock('e-sapphire', 'Sapphires are best known for being which colour?', 'Blue', [
    'Red',
    'Green',
    'Orange',
  ]),
  rock('e-amethyst', 'What colour is an amethyst?', 'Purple', ['Green', 'Red', 'Yellow']),
  rock('e-pearl', 'Which gem grows inside an oyster?', 'Pearl', ['Ruby', 'Opal', 'Amethyst']),
  rock(
    'e-jade',
    'Which green stone has been especially treasured in China for thousands of years?',
    'Jade',
    ['Ruby', 'Amethyst', 'Topaz'],
  ),
  rock('e-crown-jewels', 'Where are the British Crown Jewels kept?', 'Tower of London', [
    'Buckingham Palace',
    'Windsor Castle',
    'Westminster Abbey',
  ]),
  rock('e-lava', 'What is molten rock called once it erupts from a volcano?', 'Lava', [
    'Ash',
    'Steam',
    'Clay',
  ]),
  rock('e-chalk', 'The White Cliffs of Dover are made of which soft white rock?', 'Chalk', [
    'Granite',
    'Marble',
    'Slate',
  ]),
  rock('e-boulder', 'What do you call a very large rock?', 'Boulder', ['Pebble', 'Gravel', 'Grit']),
  rock(
    'e-stalactite',
    'What do you call a rocky spike hanging down from a cave ceiling?',
    'Stalactite',
    ['Stalagmite', 'Geode', 'Fossil'],
  ),
  rock(
    'e-fossil',
    'What do you call the remains of an ancient creature preserved in rock?',
    'Fossil',
    ['Crystal', 'Geode', 'Pebble'],
  ),
  rock('e-rushmore', 'How many presidents’ faces are carved into Mount Rushmore?', 'Four', [
    'Three',
    'Five',
    'Six',
  ]),
  rock(
    'e-easter-island',
    'The giant stone heads called moai are on which island?',
    'Easter Island',
    ['Hawaii', 'Fiji', 'Tahiti'],
  ),
  rock('e-alcatraz', 'Which former US island prison was nicknamed “The Rock”?', 'Alcatraz', [
    'Rikers Island',
    'Ellis Island',
    'Robben Island',
  ]),
  rock(
    'e-gibraltar',
    'Which British territory on Spain’s south coast is nicknamed “The Rock”?',
    'Gibraltar',
    ['Bermuda', 'The Falklands', 'Jersey'],
  ),
  rock('e-blackpool', 'Which English seaside town is famous for its sticks of rock?', 'Blackpool', [
    'Bath',
    'York',
    'Oxford',
  ]),
  rock('e-flintstones', 'Which cartoon family lives in the town of Bedrock?', 'The Flintstones', [
    'The Simpsons',
    'The Jetsons',
    'The Griffins',
  ]),
  rock('e-stone-age', 'Which of these ages came first?', 'Stone Age', [
    'Bronze Age',
    'Iron Age',
    'Industrial Age',
  ]),
  rock(
    'e-goliath',
    'In the Bible, which giant did David kill with a stone from his sling?',
    'Goliath',
    ['Samson', 'Herod', 'Pharaoh'],
  ),
  rock(
    'e-philosophers-stone',
    'The first Harry Potter book’s UK title names which kind of stone?',
    'Philosopher’s',
    ['Wizard’s', 'Dragon’s', 'Wise Man’s'],
  ),
  rock('e-moss', 'Finish the saying: “A rolling stone gathers no…”?', 'Moss', [
    'Dust',
    'Speed',
    'Friends',
  ]),
  rock('e-two-birds', 'Finish the saying: “Kill two birds with one…”?', 'Stone', [
    'Arrow',
    'Bullet',
    'Net',
  ]),
  rock('e-stone-pounds', 'How many pounds are there in a stone?', '14', ['10', '12', '16']),
  rock('e-rock-bottom', 'What does it mean to “hit rock bottom”?', 'Reach your lowest point', [
    'Reach your highest point',
    'Start a rock band',
    'Go exploring caves',
  ]),
  rock('e-on-the-rocks', 'A drink served “on the rocks” comes with what?', 'Ice', [
    'Lemon',
    'Salt',
    'Soda',
  ]),
  rock('e-elvis', 'Which singer was known as the “King of Rock and Roll”?', 'Elvis Presley', [
    'Chuck Berry',
    'Buddy Holly',
    'Little Richard',
  ]),
  rock('e-jagger', 'Who is the lead singer of the Rolling Stones?', 'Mick Jagger', [
    'Keith Richards',
    'Rod Stewart',
    'Roger Daltrey',
  ]),
  rock('e-mercury', 'Who was the lead singer of Queen?', 'Freddie Mercury', [
    'Brian May',
    'Elton John',
    'David Bowie',
  ]),
  rock('e-acdc', 'Which band released “Highway to Hell”?', 'AC/DC', [
    'Metallica',
    'Guns N’ Roses',
    'Kiss',
  ]),
  rock('e-nirvana', 'Kurt Cobain was the lead singer of which band?', 'Nirvana', [
    'Pearl Jam',
    'Foo Fighters',
    'Green Day',
  ]),
  rock('e-hendrix', 'Which instrument was Jimi Hendrix famous for playing?', 'Guitar', [
    'Drums',
    'Piano',
    'Saxophone',
  ]),
  rock(
    'e-school-of-rock',
    'Who stars as the fake substitute teacher in “School of Rock”?',
    'Jack Black',
    ['Will Ferrell', 'Adam Sandler', 'Ben Stiller'],
  ),
  rock('e-beatles', 'Which English city did the Beatles come from?', 'Liverpool', [
    'Manchester',
    'London',
    'Birmingham',
  ]),
  rock('e-crocodile-rock', 'Who sang “Crocodile Rock”?', 'Elton John', [
    'Rod Stewart',
    'Billy Joel',
    'Stevie Wonder',
  ]),
  rock('e-kiss', 'Which rock band is famous for black-and-white face paint?', 'Kiss', [
    'Queen',
    'U2',
    'Coldplay',
  ]),
  rock('e-u2', 'Bono is the lead singer of which band?', 'U2', ['Coldplay', 'Oasis', 'R.E.M.']),

  // ---------------- PAPER: money, books, newspapers, origami, printing, stationery ----------------
  paper('e-origami', 'Which Japanese art involves folding paper into shapes?', 'Origami', [
    'Ikebana',
    'Karaoke',
    'Bonsai',
  ]),
  paper(
    'e-cranes',
    'Folding 1,000 paper versions of which bird is said to grant a wish?',
    'Crane',
    ['Swan', 'Eagle', 'Owl'],
  ),
  paper('e-a4', 'Which paper size is the standard for printers in the UK and Europe?', 'A4', [
    'A1',
    'A6',
    'B7',
  ]),
  paper('e-a3', 'Which paper size is twice as big as A4?', 'A3', ['A5', 'A2', 'A6']),
  paper('e-papyrus', 'Ancient Egyptians wrote on sheets made from which plant?', 'Papyrus', [
    'Bamboo',
    'Cotton',
    'Oak',
  ]),
  paper('e-china', 'In which country was paper invented?', 'China', ['Japan', 'Greece', 'Italy']),
  paper('e-wood', 'Most paper is made from which material?', 'Wood', [
    'Cotton',
    'Plastic',
    'Glass',
  ]),
  paper(
    'e-gutenberg',
    'Which German is famous for inventing the printing press?',
    'Johannes Gutenberg',
    ['Albert Einstein', 'Karl Marx', 'Ludwig van Beethoven'],
  ),
  paper('e-washington', 'Whose face is on the US one-dollar bill?', 'George Washington', [
    'Abraham Lincoln',
    'Thomas Jefferson',
    'Benjamin Franklin',
  ]),
  paper('e-franklin', 'Whose face is on the US hundred-dollar bill?', 'Benjamin Franklin', [
    'George Washington',
    'Abraham Lincoln',
    'Alexander Hamilton',
  ]),
  paper('e-penny-black', 'The world’s first postage stamp was called the Penny… what?', 'Black', [
    'Green',
    'Blue',
    'Gold',
  ]),
  paper('e-envelope', 'What do you put a letter in before posting it?', 'Envelope', [
    'Folder',
    'Binder',
    'Wallet',
  ]),
  paper(
    'e-anniversary',
    'Which wedding anniversary is traditionally the paper anniversary?',
    'First',
    ['Fifth', 'Tenth', 'Twentieth'],
  ),
  paper('e-confetti', 'What are the paper bits thrown over newlyweds called?', 'Confetti', [
    'Tinsel',
    'Glitter',
    'Sequins',
  ]),
  paper(
    'e-cracker-hat',
    'What do people usually wear from their Christmas crackers?',
    'A paper hat',
    ['A bow tie', 'A scarf', 'A mask'],
  ),
  paper(
    'e-papier-mache',
    'Which craft builds models from strips of paper and paste?',
    'Papier-mâché',
    ['Macramé', 'Crochet', 'Batik'],
  ),
  paper('e-sandpaper', 'Which rough paper is used to smooth wood?', 'Sandpaper', [
    'Tissue paper',
    'Crêpe paper',
    'Tracing paper',
  ]),
  paper('e-post-it', 'What colour is the classic Post-it note?', 'Yellow', [
    'Pink',
    'Blue',
    'Green',
  ]),
  paper('e-stapler', 'Which desk tool joins sheets of paper with bent metal wire?', 'Stapler', [
    'Hole punch',
    'Paperweight',
    'Pencil sharpener',
  ]),
  paper('e-pen-mightier', 'Finish the saying: “The pen is mightier than the…”?', 'Sword', [
    'Gun',
    'Shield',
    'Axe',
  ]),
  paper(
    'e-quill',
    'Before modern pens, people often wrote with a quill made from what?',
    'A feather',
    ['A bone', 'A twig', 'A shell'],
  ),
  paper('e-bookworm', 'What do you call someone who loves reading books?', 'Bookworm', [
    'Bookend',
    'Bookmark',
    'Bookcase',
  ]),
  paper('e-bookmark', 'What do you put in a book to keep your place?', 'Bookmark', [
    'Bookend',
    'Blurb',
    'Spine',
  ]),
  paper('e-library', 'Where do you usually go to borrow books?', 'Library', [
    'Bookshop',
    'Museum',
    'Gallery',
  ]),
  paper('e-paperback', 'What do you call a book with a soft cover?', 'Paperback', [
    'Hardback',
    'Box set',
    'Audiobook',
  ]),
  paper('e-atlas', 'What do you call a book of maps?', 'Atlas', [
    'Almanac',
    'Encyclopedia',
    'Diary',
  ]),
  paper(
    'e-autobiography',
    'What do you call a book someone writes about their own life?',
    'Autobiography',
    ['Biography', 'Anthology', 'Novel'],
  ),
  paper('e-crossword', 'Which newspaper puzzle has “across” and “down” clues?', 'Crossword', [
    'Sudoku',
    'Word search',
    'Jigsaw',
  ]),
  paper('e-sudoku', 'Which numbers are used to fill in a standard Sudoku?', '1 to 9', [
    '0 to 9',
    '1 to 10',
    '1 to 12',
  ]),
  paper('e-yellow-pages', 'The printed Yellow Pages directory listed what?', 'Businesses', [
    'Recipes',
    'TV shows',
    'Bus times',
  ]),
  paper('e-daily-planet', 'Which newspaper does Clark Kent work for?', 'The Daily Planet', [
    'The Daily Bugle',
    'The Gotham Gazette',
    'The Daily Prophet',
  ]),
  paper('e-daily-bugle', 'Peter Parker takes photos for which newspaper?', 'The Daily Bugle', [
    'The Daily Planet',
    'The Gotham Gazette',
    'The Daily Prophet',
  ]),
  paper(
    'e-daily-prophet',
    'What is the wizarding newspaper in Harry Potter called?',
    'The Daily Prophet',
    ['The Daily Planet', 'The Wizard Times', 'The Magic Post'],
  ),
  paper('e-peanuts', 'Which newspaper comic strip stars Snoopy and Charlie Brown?', 'Peanuts', [
    'Garfield',
    'Dilbert',
    'Calvin and Hobbes',
  ]),
  paper('e-shakespeare', 'Who wrote “Romeo and Juliet”?', 'William Shakespeare', [
    'Charles Dickens',
    'Jane Austen',
    'Geoffrey Chaucer',
  ]),
  paper('e-dickens', 'Who wrote “A Christmas Carol”?', 'Charles Dickens', [
    'Mark Twain',
    'Oscar Wilde',
    'Jane Austen',
  ]),
  paper('e-rowling', 'Who wrote the Harry Potter books?', 'J.K. Rowling', [
    'Roald Dahl',
    'Enid Blyton',
    'C.S. Lewis',
  ]),
  paper('e-tolkien', 'Who wrote “The Hobbit”?', 'J.R.R. Tolkien', [
    'C.S. Lewis',
    'Roald Dahl',
    'J.K. Rowling',
  ]),
  paper('e-dahl', 'Who wrote “Charlie and the Chocolate Factory”?', 'Roald Dahl', [
    'Dr. Seuss',
    'Enid Blyton',
    'Lewis Carroll',
  ]),
  paper('e-golden-ticket', 'What did Charlie Bucket find in his Wonka bar?', 'A golden ticket', [
    'A silver key',
    'A gold coin',
    'A treasure map',
  ]),

  // ---------------- SCISSORS: the game, cutting tools, hair, sewing, blades ----------------
  scissors('e-rps-paper', 'In rock paper scissors, what beats paper?', 'Scissors', [
    'Rock',
    'Paper',
    'Nothing',
  ]),
  scissors('e-rps-rock', 'In rock paper scissors, what beats rock?', 'Paper', [
    'Scissors',
    'Rock',
    'Nothing',
  ]),
  scissors('e-rps-scissors', 'In rock paper scissors, what beats scissors?', 'Rock', [
    'Paper',
    'Scissors',
    'Nothing',
  ]),
  scissors('e-rps-scissors-beat', 'In rock paper scissors, what do scissors beat?', 'Paper', [
    'Rock',
    'Scissors',
    'Nothing',
  ]),
  scissors(
    'e-rps-same',
    'In rock paper scissors, what happens if both players pick the same?',
    'It’s a draw',
    ['First player wins', 'Second player wins', 'Both players lose'],
  ),
  scissors('e-rps-fist', 'In rock paper scissors, which hand shape means rock?', 'A fist', [
    'A flat hand',
    'Two fingers',
    'A thumbs-up',
  ]),
  scissors('e-rps-flat', 'In rock paper scissors, which hand shape means paper?', 'A flat hand', [
    'A fist',
    'Two fingers',
    'A thumbs-up',
  ]),
  scissors('e-rps-fingers', 'How many fingers do you hold out for scissors?', 'Two', [
    'One',
    'Three',
    'Five',
  ]),
  scissors('e-rps-odd-one', 'Which of these is not a move in rock paper scissors?', 'Hammer', [
    'Rock',
    'Paper',
    'Scissors',
  ]),
  scissors(
    'e-lizard-spock',
    'Which sitcom made “Rock Paper Scissors Lizard Spock” famous?',
    'The Big Bang Theory',
    ['Friends', 'The Office', 'How I Met Your Mother'],
  ),
  scissors('e-edward-actor', 'Who played the title role in “Edward Scissorhands”?', 'Johnny Depp', [
    'Tom Cruise',
    'Brad Pitt',
    'Keanu Reeves',
  ]),
  scissors('e-edward-director', 'Who directed “Edward Scissorhands”?', 'Tim Burton', [
    'Steven Spielberg',
    'James Cameron',
    'George Lucas',
  ]),
  scissors(
    'e-ribbon',
    'At an opening ceremony, what is cut with a big pair of scissors?',
    'A ribbon',
    ['A cake', 'A rope', 'A flag'],
  ),
  scissors('e-blades', 'How many blades does a pair of scissors have?', 'Two', [
    'One',
    'Three',
    'Four',
  ]),
  scissors('e-run', 'What are children warned never to do while holding scissors?', 'Run', [
    'Sit down',
    'Read',
    'Sing',
  ]),
  scissors('e-barber', 'What tool does a barber mainly cut hair with?', 'Scissors', [
    'Tweezers',
    'Pliers',
    'A comb',
  ]),
  scissors(
    'e-barber-pole',
    'Which two colours are classically striped on a barber’s pole?',
    'Red and white',
    ['Green and yellow', 'Black and orange', 'Purple and gold'],
  ),
  scissors('e-sweeney-todd', 'Sweeney Todd is the “demon” what of Fleet Street?', 'Barber', [
    'Butcher',
    'Baker',
    'Tailor',
  ]),
  scissors('e-mohawk', 'Which hairstyle has a central strip of hair with shaved sides?', 'Mohawk', [
    'Mullet',
    'Bob',
    'Quiff',
  ]),
  scissors('e-mullet', 'Which haircut is “business at the front, party at the back”?', 'Mullet', [
    'Mohawk',
    'Bob',
    'Buzz cut',
  ]),
  scissors('e-bangs', 'What do Americans call a hair fringe?', 'Bangs', [
    'Locks',
    'Bunches',
    'Curls',
  ]),
  scissors('e-samson', 'In the Bible, who lost his strength when his hair was cut?', 'Samson', [
    'Goliath',
    'Moses',
    'Noah',
  ]),
  scissors('e-tailor', 'What do you call someone who makes and alters suits?', 'Tailor', [
    'Cobbler',
    'Butcher',
    'Plumber',
  ]),
  scissors('e-tape-measure', 'What does a tailor use to measure your waist?', 'Tape measure', [
    'Spirit level',
    'Protractor',
    'Compass',
  ]),
  scissors('e-thimble', 'What do you wear on a fingertip to push a sewing needle?', 'Thimble', [
    'Bobbin',
    'Spool',
    'Button',
  ]),
  scissors('e-needle-eye', 'What is the hole in a sewing needle called?', 'The eye', [
    'The mouth',
    'The ear',
    'The nose',
  ]),
  scissors('e-singer', 'Which company is famous for making sewing machines?', 'Singer', [
    'Gucci',
    'Hoover',
    'Dyson',
  ]),
  scissors('e-knitting', 'Which craft uses two long needles and a ball of yarn?', 'Knitting', [
    'Crochet',
    'Embroidery',
    'Weaving',
  ]),
  scissors(
    'e-hedge-shears',
    'Which garden tool looks like giant scissors for trimming hedges?',
    'Shears',
    ['Rake', 'Hoe', 'Trowel'],
  ),
  scissors('e-axe', 'What tool does a lumberjack swing to chop down trees?', 'Axe', [
    'Hammer',
    'Shovel',
    'Rake',
  ]),
  scissors('e-scalpel', 'What small, very sharp knife does a surgeon use?', 'Scalpel', [
    'Cleaver',
    'Machete',
    'Penknife',
  ]),
  scissors('e-sickle', 'Which curved blade appears with a hammer on the Soviet flag?', 'Sickle', [
    'Saw',
    'Axe',
    'Spade',
  ]),
  scissors('e-scythe', 'Which long-bladed tool does the Grim Reaper carry?', 'Scythe', [
    'Trident',
    'Hammer',
    'Axe',
  ]),
  scissors('e-excalibur', 'What is the name of King Arthur’s sword?', 'Excalibur', [
    'Sting',
    'Andúril',
    'Narsil',
  ]),
  scissors('e-sword-stone', 'In legend, who pulled the sword from the stone?', 'Arthur', [
    'Lancelot',
    'Merlin',
    'Robin Hood',
  ]),
  scissors('e-lightsaber', 'What glowing blade does a Jedi fight with?', 'Lightsaber', [
    'Phaser',
    'Blaster',
    'Batarang',
  ]),
  scissors(
    'e-wolverine',
    'Which X-Men hero has metal claws that pop out of his hands?',
    'Wolverine',
    ['Cyclops', 'Magneto', 'Professor X'],
  ),
  scissors('e-zorro', 'Which masked swordsman leaves the mark of a “Z”?', 'Zorro', [
    'Robin Hood',
    'The Phantom',
    'Batman',
  ]),
  scissors(
    'e-musketeers',
    'Whose motto is “All for one, and one for all”?',
    'The Three Musketeers',
    ['The Merry Men', 'The Three Amigos', 'The Knights of the Round Table'],
  ),
  scissors('e-katana', 'What is the curved sword of the samurai called?', 'Katana', [
    'Rapier',
    'Cutlass',
    'Claymore',
  ]),
];
