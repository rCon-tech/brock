/**
 * The trivia lifeline's question bank: hard general knowledge, one right answer and three
 * plausible wrong ones. Ids are stable (a player is never shown the same question twice until
 * they've seen them all), so add new questions with new ids and never reuse an old one.
 *
 * Only include facts that are settled and unambiguous; a disputed answer feels unfair when a
 * streak is on the line.
 */
export interface TriviaQuestion {
  id: string;
  question: string;
  answer: string;
  wrong: [string, string, string];
}

const q = (
  id: string,
  question: string,
  answer: string,
  wrong: [string, string, string],
): TriviaQuestion => ({ id, question, answer, wrong });

export const QUESTIONS: TriviaQuestion[] = [
  // ---------- science ----------
  q('sci-tungsten', 'What is the chemical symbol for tungsten?', 'W', ['Tu', 'Tn', 'Tg']),
  q('sci-tin', 'Which element has the chemical symbol Sn?', 'Tin', [
    'Antimony',
    'Strontium',
    'Selenium',
  ]),
  q('sci-lead', 'Which element has the chemical symbol Pb?', 'Lead', [
    'Platinum',
    'Palladium',
    'Phosphorus',
  ]),
  q('sci-potassium', 'Which element has the chemical symbol K?', 'Potassium', [
    'Krypton',
    'Calcium',
    'Phosphorus',
  ]),
  q('sci-gold-79', 'Which element has atomic number 79?', 'Gold', [
    'Silver',
    'Platinum',
    'Mercury',
  ]),
  q('sci-liquid-metal', 'Which metal is liquid at standard room temperature (20°C)?', 'Mercury', [
    'Gallium',
    'Caesium',
    'Sodium',
  ]),
  q('sci-argon', 'What is the third most abundant gas in Earth’s dry atmosphere?', 'Argon', [
    'Carbon dioxide',
    'Neon',
    'Helium',
  ]),
  q('sci-crust', 'What is the most abundant element in Earth’s crust by mass?', 'Oxygen', [
    'Silicon',
    'Iron',
    'Aluminium',
  ]),
  q('sci-universe', 'What is the most abundant element in the universe?', 'Hydrogen', [
    'Helium',
    'Oxygen',
    'Carbon',
  ]),
  q('sci-mohs', 'On the Mohs scale, which mineral is the next hardest after diamond?', 'Corundum', [
    'Topaz',
    'Quartz',
    'Garnet',
  ]),
  q('sci-heisenberg', 'Who formulated the uncertainty principle?', 'Werner Heisenberg', [
    'Niels Bohr',
    'Erwin Schrödinger',
    'Max Planck',
  ]),
  q('sci-neutron', 'Which subatomic particle did James Chadwick discover in 1932?', 'Neutron', [
    'Proton',
    'Electron',
    'Positron',
  ]),
  q('sci-absolute-zero', 'What is absolute zero in degrees Celsius?', '−273.15', [
    '−459.67',
    '−373.15',
    '−100',
  ]),
  q('sci-penicillin', 'Who discovered penicillin in 1928?', 'Alexander Fleming', [
    'Louis Pasteur',
    'Joseph Lister',
    'Howard Florey',
  ]),
  q('sci-polio', 'Who developed the first polio vaccine, licensed in 1955?', 'Jonas Salk', [
    'Albert Sabin',
    'Louis Pasteur',
    'Edward Jenner',
  ]),
  q('sci-first-nobel-woman', 'Who was the first woman to win a Nobel Prize?', 'Marie Curie', [
    'Bertha von Suttner',
    'Irène Joliot-Curie',
    'Selma Lagerlöf',
  ]),
  q('sci-beagle', 'On which ship did Charles Darwin make his famous voyage?', 'HMS Beagle', [
    'HMS Endeavour',
    'HMS Bounty',
    'HMS Victory',
  ]),
  q('sci-binary-13', 'What is the decimal number 13 written in binary?', '1101', [
    '1011',
    '1110',
    '1001',
  ]),
  q('sci-sqrt-361', 'What is the square root of 361?', '19', ['17', '21', '23']),
  q('sci-prime-89', 'What is the next prime number after 89?', '97', ['91', '93', '95']),
  q('sci-dodecagon', 'How many sides does a dodecagon have?', '12', ['10', '11', '20']),
  q('sci-zero-factorial', 'What is 0! (zero factorial)?', '1', ['0', 'Undefined', 'Infinity']),
  q('sci-roman-1990', 'Which year is written MCMXC in Roman numerals?', '1990', [
    '1890',
    '1940',
    '1960',
  ]),
  q('sci-sigma', 'Which Greek letter is used as the symbol for summation?', 'Sigma', [
    'Pi',
    'Delta',
    'Omega',
  ]),

  // ---------- the human body ----------
  q('body-stapes', 'What is the smallest bone in the human body?', 'Stapes', [
    'Incus',
    'Malleus',
    'Hyoid',
  ]),
  q('body-femur', 'What is the longest bone in the human body?', 'Femur', [
    'Tibia',
    'Humerus',
    'Fibula',
  ]),
  q('body-bones', 'How many bones are there in a typical adult human skeleton?', '206', [
    '186',
    '212',
    '226',
  ]),
  q('body-teeth', 'How many teeth does a typical adult human have, including wisdom teeth?', '32', [
    '28',
    '30',
    '36',
  ]),
  q('body-chromosome-pairs', 'How many pairs of chromosomes do humans normally have?', '23', [
    '22',
    '24',
    '46',
  ]),
  q(
    'body-cerebellum',
    'Which part of the brain mainly coordinates balance and fine movement?',
    'Cerebellum',
    ['Medulla oblongata', 'Hypothalamus', 'Amygdala'],
  ),
  q('body-largest-organ', 'What is the largest organ of the human body?', 'Skin', [
    'Liver',
    'Lungs',
    'Brain',
  ]),
  q(
    'body-universal-donor',
    'Which blood type is the universal donor for red blood cells?',
    'O negative',
    ['AB positive', 'O positive', 'A negative'],
  ),
  q('body-vitamin-d', 'Which vitamin does the skin make when exposed to sunlight?', 'Vitamin D', [
    'Vitamin A',
    'Vitamin C',
    'Vitamin K',
  ]),

  // ---------- animals ----------
  q('animal-octopus-hearts', 'How many hearts does an octopus have?', '3', ['1', '2', '4']),
  q(
    'animal-hippo',
    'Which animals are the closest living relatives of the hippopotamus?',
    'Whales',
    ['Pigs', 'Elephants', 'Rhinoceroses'],
  ),
  q('animal-crows', 'What is a group of crows called?', 'A murder', [
    'A parliament',
    'A murmuration',
    'A gaggle',
  ]),
  q(
    'animal-peregrine',
    'Which bird reaches the highest speed of any animal, in its hunting dive?',
    'Peregrine falcon',
    ['Golden eagle', 'Common swift', 'Gyrfalcon'],
  ),
  q('animal-lobster-legs', 'How many legs does a lobster have?', '10', ['6', '8', '12']),
  q('animal-largest-shark', 'What is the largest living species of shark?', 'Whale shark', [
    'Great white shark',
    'Basking shark',
    'Tiger shark',
  ]),
  q('animal-scotland', 'What is the national animal of Scotland?', 'Unicorn', [
    'Red deer',
    'Golden eagle',
    'Highland cow',
  ]),

  // ---------- space ----------
  q('space-shortest-day', 'Which planet has the shortest day in the Solar System?', 'Jupiter', [
    'Saturn',
    'Neptune',
    'Mercury',
  ]),
  q('space-largest-moon', 'What is the largest moon in the Solar System?', 'Ganymede', [
    'Titan',
    'Callisto',
    'Io',
  ]),
  q('space-triton', 'Triton is a moon of which planet?', 'Neptune', [
    'Uranus',
    'Saturn',
    'Jupiter',
  ]),
  q('space-mars-moons', 'How many moons does Mars have?', '2', ['0', '1', '4']),
  q('space-hottest', 'Which is the hottest planet in the Solar System?', 'Venus', [
    'Mercury',
    'Mars',
    'Jupiter',
  ]),
  q(
    'space-day-longer-year',
    'On which planet is a day (one rotation) longer than its year?',
    'Venus',
    ['Mercury', 'Mars', 'Neptune'],
  ),
  q('space-most-moons', 'Which planet has the most known moons?', 'Saturn', [
    'Jupiter',
    'Uranus',
    'Neptune',
  ]),
  q('space-andromeda', 'Which is the nearest large spiral galaxy to the Milky Way?', 'Andromeda', [
    'Triangulum',
    'Whirlpool',
    'Sombrero',
  ]),
  q(
    'space-event-horizon',
    'What is the boundary around a black hole beyond which nothing can escape?',
    'Event horizon',
    ['Photon sphere', 'Accretion disk', 'Singularity'],
  ),
  q('space-gagarin', 'Who was the first person in space?', 'Yuri Gagarin', [
    'Alexei Leonov',
    'Alan Shepard',
    'Valentina Tereshkova',
  ]),
  q('space-aldrin', 'Who was the second person to walk on the Moon?', 'Buzz Aldrin', [
    'Michael Collins',
    'Pete Conrad',
    'Alan Shepard',
  ]),
  q('space-sputnik', 'What was the name of the first artificial satellite?', 'Sputnik 1', [
    'Explorer 1',
    'Vostok 1',
    'Telstar',
  ]),
  q(
    'space-apollo-13',
    'Which Apollo mission reported “Houston, we’ve had a problem”?',
    'Apollo 13',
    ['Apollo 11', 'Apollo 12', 'Apollo 14'],
  ),

  // ---------- geography ----------
  q('geo-q-states', 'Which letter appears in no US state name?', 'Q', ['X', 'Z', 'J']),
  q(
    'geo-time-zones',
    'Which country, counting its overseas territories, spans the most time zones?',
    'France',
    ['Russia', 'United States', 'United Kingdom'],
  ),
  q('geo-kazakhstan', 'What is the capital of Kazakhstan?', 'Astana', [
    'Almaty',
    'Bishkek',
    'Tashkent',
  ]),
  q('geo-new-zealand', 'What is the capital of New Zealand?', 'Wellington', [
    'Auckland',
    'Christchurch',
    'Hamilton',
  ]),
  q('geo-canada', 'What is the capital of Canada?', 'Ottawa', ['Toronto', 'Montreal', 'Vancouver']),
  q('geo-turkey', 'What is the capital of Turkey?', 'Ankara', ['Istanbul', 'Izmir', 'Bursa']),
  q('geo-brazil', 'What is the capital of Brazil?', 'Brasília', [
    'Rio de Janeiro',
    'São Paulo',
    'Salvador',
  ]),
  q('geo-morocco', 'What is the capital of Morocco?', 'Rabat', ['Casablanca', 'Marrakesh', 'Fez']),
  q('geo-vietnam', 'What is the capital of Vietnam?', 'Hanoi', [
    'Ho Chi Minh City',
    'Huế',
    'Da Nang',
  ]),
  q('geo-nigeria', 'What is the capital of Nigeria?', 'Abuja', ['Lagos', 'Kano', 'Ibadan']),
  q('geo-myanmar', 'What is the capital of Myanmar?', 'Naypyidaw', ['Yangon', 'Mandalay', 'Bago']),
  q('geo-mongolia', 'What is the capital of Mongolia?', 'Ulaanbaatar', [
    'Erdenet',
    'Darkhan',
    'Hohhot',
  ]),
  q('geo-volga', 'What is the longest river in Europe?', 'Volga', ['Danube', 'Rhine', 'Dnieper']),
  q('geo-baikal', 'What is the deepest lake in the world?', 'Lake Baikal', [
    'Lake Tanganyika',
    'Caspian Sea',
    'Lake Superior',
  ]),
  q('geo-largest-desert', 'What is the largest desert in the world?', 'Antarctic Desert', [
    'Sahara',
    'Arctic Desert',
    'Gobi',
  ]),
  q('geo-kilimanjaro', 'What is the highest mountain in Africa?', 'Kilimanjaro', [
    'Mount Kenya',
    'Mount Stanley',
    'Ras Dashen',
  ]),
  q('geo-aconcagua', 'What is the highest mountain in South America?', 'Aconcagua', [
    'Chimborazo',
    'Ojos del Salado',
    'Huascarán',
  ]),
  q('geo-algeria', 'What is the largest country in Africa by area?', 'Algeria', [
    'DR Congo',
    'Sudan',
    'Libya',
  ]),
  q('geo-vatican', 'What is the smallest country in the world by area?', 'Vatican City', [
    'Monaco',
    'San Marino',
    'Nauru',
  ]),
  q('geo-coastline', 'Which country has the longest coastline?', 'Canada', [
    'Indonesia',
    'Russia',
    'Norway',
  ]),
  q('geo-nigeria-pop', 'Which African country has the largest population?', 'Nigeria', [
    'Ethiopia',
    'Egypt',
    'DR Congo',
  ]),
  q('geo-tigris', 'Which river flows through Baghdad?', 'Tigris', ['Euphrates', 'Jordan', 'Karun']),
  q('geo-petra', 'In which country is the ancient city of Petra?', 'Jordan', [
    'Egypt',
    'Syria',
    'Lebanon',
  ]),
  q('geo-timbuktu', 'In which country is Timbuktu?', 'Mali', [
    'Niger',
    'Mauritania',
    'Burkina Faso',
  ]),
  q('geo-gibraltar', 'Which strait separates Europe from Africa?', 'Strait of Gibraltar', [
    'Bosphorus',
    'Strait of Messina',
    'Dardanelles',
  ]),
  q('geo-pyramids', 'Which country has the most pyramids?', 'Sudan', ['Egypt', 'Mexico', 'Peru']),
  q('geo-edo', 'Which city was formerly known as Edo?', 'Tokyo', ['Kyoto', 'Osaka', 'Nara']),
  q('geo-siam', 'Which country was formerly called Siam?', 'Thailand', [
    'Myanmar',
    'Cambodia',
    'Laos',
  ]),
  q('geo-ceylon', 'Which country was formerly called Ceylon?', 'Sri Lanka', [
    'Myanmar',
    'Bangladesh',
    'Malaysia',
  ]),
  q('geo-abyssinia', 'Which country was historically known as Abyssinia?', 'Ethiopia', [
    'Eritrea',
    'Somalia',
    'Sudan',
  ]),
  q('geo-swiss-languages', 'How many national languages does Switzerland have?', '4', [
    '2',
    '3',
    '5',
  ]),
  q('geo-nepal-flag', 'Which country’s national flag is not a rectangle?', 'Nepal', [
    'Bhutan',
    'Qatar',
    'Sri Lanka',
  ]),
  q('geo-burj', 'In which country is the Burj Khalifa?', 'United Arab Emirates', [
    'Qatar',
    'Saudi Arabia',
    'Kuwait',
  ]),
  q('geo-mandarin', 'Which language has the most native speakers?', 'Mandarin Chinese', [
    'Spanish',
    'English',
    'Hindi',
  ]),
  q('geo-zloty', 'The złoty is the currency of which country?', 'Poland', [
    'Hungary',
    'Czech Republic',
    'Bulgaria',
  ]),

  // ---------- history ----------
  q('hist-berlin-wall', 'In which year did the Berlin Wall fall?', '1989', [
    '1987',
    '1990',
    '1991',
  ]),
  q('hist-titanic', 'In which year did the Titanic sink?', '1912', ['1911', '1914', '1915']),
  q('hist-hastings', 'In which year was the Battle of Hastings?', '1066', ['1056', '1086', '1166']),
  q('hist-magna-carta', 'In which year was the Magna Carta sealed?', '1215', [
    '1066',
    '1265',
    '1314',
  ]),
  q(
    'hist-versailles',
    'Which treaty formally ended the First World War between Germany and the Allies?',
    'Treaty of Versailles',
    ['Treaty of Paris', 'Treaty of Trianon', 'Treaty of Brest-Litovsk'],
  ),
  q('hist-augustus', 'Who was the first Roman emperor?', 'Augustus', [
    'Julius Caesar',
    'Nero',
    'Tiberius',
  ]),
  q('hist-suleiman', 'Suleiman the Magnificent ruled which empire?', 'Ottoman Empire', [
    'Mughal Empire',
    'Safavid Empire',
    'Byzantine Empire',
  ]),
  q(
    'hist-armada',
    'Who was England’s monarch when the Spanish Armada was defeated in 1588?',
    'Elizabeth I',
    ['Mary I', 'James I', 'Henry VIII'],
  ),
  q(
    'hist-nz-vote',
    'Which was the first country to give all women the vote in national elections, in 1893?',
    'New Zealand',
    ['Australia', 'Finland', 'Norway'],
  ),
  q('hist-machu-picchu', 'Which civilisation built Machu Picchu?', 'Inca', [
    'Maya',
    'Aztec',
    'Olmec',
  ]),
  q(
    'hist-cuban-crisis',
    'Who was US president during the Cuban Missile Crisis?',
    'John F. Kennedy',
    ['Dwight D. Eisenhower', 'Lyndon B. Johnson', 'Richard Nixon'],
  ),
  q(
    'hist-santa-maria',
    'The Santa María was the flagship of which explorer?',
    'Christopher Columbus',
    ['Ferdinand Magellan', 'Vasco da Gama', 'John Cabot'],
  ),
  q('hist-amundsen', 'Who led the first expedition to reach the South Pole?', 'Roald Amundsen', [
    'Robert Falcon Scott',
    'Ernest Shackleton',
    'Richard Byrd',
  ]),
  q('hist-art-of-war', 'Who is traditionally credited with writing The Art of War?', 'Sun Tzu', [
    'Confucius',
    'Laozi',
    'Mencius',
  ]),
  q('hist-leviathan', 'Which philosopher wrote Leviathan (1651)?', 'Thomas Hobbes', [
    'John Locke',
    'Jean-Jacques Rousseau',
    'David Hume',
  ]),
  q('hist-first-iphone', 'In which year was the first iPhone released?', '2007', [
    '2005',
    '2006',
    '2008',
  ]),

  // ---------- arts and literature ----------
  q('art-bosch', 'Who painted The Garden of Earthly Delights?', 'Hieronymus Bosch', [
    'Pieter Bruegel the Elder',
    'Jan van Eyck',
    'Albrecht Dürer',
  ]),
  q(
    'art-dali',
    'Who painted The Persistence of Memory, with its melting clocks?',
    'Salvador Dalí',
    ['René Magritte', 'Max Ernst', 'Joan Miró'],
  ),
  q('art-vermeer', 'Who painted Girl with a Pearl Earring?', 'Johannes Vermeer', [
    'Rembrandt',
    'Frans Hals',
    'Jan Steen',
  ]),
  q('art-munch', 'Who painted The Scream?', 'Edvard Munch', [
    'Gustav Klimt',
    'Egon Schiele',
    'Wassily Kandinsky',
  ]),
  q('art-sistine', 'Who painted the ceiling of the Sistine Chapel?', 'Michelangelo', [
    'Raphael',
    'Leonardo da Vinci',
    'Botticelli',
  ]),
  q('art-bilbao', 'Which architect designed the Guggenheim Museum in Bilbao?', 'Frank Gehry', [
    'Zaha Hadid',
    'Frank Lloyd Wright',
    'Renzo Piano',
  ]),
  q('art-liberty', 'Who designed the Statue of Liberty?', 'Frédéric Auguste Bartholdi', [
    'Gustave Eiffel',
    'Auguste Rodin',
    'Edgar Degas',
  ]),
  q('lit-solitude', 'Who wrote One Hundred Years of Solitude?', 'Gabriel García Márquez', [
    'Mario Vargas Llosa',
    'Jorge Luis Borges',
    'Isabel Allende',
  ]),
  q(
    'lit-poirot-debut',
    'In which novel did Hercule Poirot first appear?',
    'The Mysterious Affair at Styles',
    ['The Murder on the Links', 'The Murder of Roger Ackroyd', 'Murder on the Orient Express'],
  ),
  q('lit-orwell', 'What was George Orwell’s real name?', 'Eric Arthur Blair', [
    'Edward George Blair',
    'Arthur Eric Bliss',
    'George Edmund Orr',
  ]),
  q('lit-ishmael', 'Which novel opens with “Call me Ishmael”?', 'Moby-Dick', [
    'Treasure Island',
    'The Old Man and the Sea',
    'Robinson Crusoe',
  ]),
  q('lit-brave-new-world', 'Who wrote Brave New World?', 'Aldous Huxley', [
    'George Orwell',
    'H. G. Wells',
    'Ray Bradbury',
  ]),
  q('lit-gatsby-narrator', 'Who narrates The Great Gatsby?', 'Nick Carraway', [
    'Tom Buchanan',
    'Jay Gatsby',
    'George Wilson',
  ]),
  q('lit-achebe', 'Who wrote Things Fall Apart?', 'Chinua Achebe', [
    'Wole Soyinka',
    'Ngũgĩ wa Thiong’o',
    'Ben Okri',
  ]),
  q('lit-hudson', 'What is the name of Sherlock Holmes’s landlady?', 'Mrs Hudson', [
    'Mrs Hughes',
    'Mrs Patmore',
    'Mrs Danvers',
  ]),
  q('lit-wuthering', 'Which Brontë wrote Wuthering Heights?', 'Emily', [
    'Charlotte',
    'Anne',
    'Branwell',
  ]),
  q('lit-shylock', 'In which Shakespeare play does Shylock appear?', 'The Merchant of Venice', [
    'Othello',
    'Measure for Measure',
    'The Tempest',
  ]),
  q('lit-longest-shakespeare', 'Which is Shakespeare’s longest play?', 'Hamlet', [
    'King Lear',
    'Richard III',
    'Coriolanus',
  ]),

  // ---------- music, film and TV ----------
  q('music-rite', 'Who composed The Rite of Spring?', 'Igor Stravinsky', [
    'Sergei Prokofiev',
    'Claude Debussy',
    'Maurice Ravel',
  ]),
  q('music-carmen', 'Who composed the opera Carmen?', 'Georges Bizet', [
    'Giuseppe Verdi',
    'Giacomo Puccini',
    'Jules Massenet',
  ]),
  q('music-four-seasons', 'Who composed The Four Seasons?', 'Antonio Vivaldi', [
    'Johann Sebastian Bach',
    'George Frideric Handel',
    'Arcangelo Corelli',
  ]),
  q('music-beethoven', 'How many symphonies did Beethoven complete?', '9', ['7', '10', '12']),
  q('music-dark-side', 'Which band released The Dark Side of the Moon?', 'Pink Floyd', [
    'Led Zeppelin',
    'The Who',
    'Genesis',
  ]),
  q('music-pete-best', 'Who was the Beatles’ drummer before Ringo Starr?', 'Pete Best', [
    'Stuart Sutcliffe',
    'Jimmy Nicol',
    'Brian Epstein',
  ]),
  q('music-queen-of-soul', 'Which singer was known as the Queen of Soul?', 'Aretha Franklin', [
    'Diana Ross',
    'Etta James',
    'Whitney Houston',
  ]),
  q('film-wings', 'Which film won the first Academy Award for Best Picture?', 'Wings', [
    'Sunrise',
    'The Jazz Singer',
    'Metropolis',
  ]),
  q('film-seven-samurai', 'Who directed Seven Samurai?', 'Akira Kurosawa', [
    'Yasujirō Ozu',
    'Kenji Mizoguchi',
    'Hayao Miyazaki',
  ]),
  q('film-wakanda', 'What is the fictional African nation in Black Panther?', 'Wakanda', [
    'Genovia',
    'Zamunda',
    'Sokovia',
  ]),
  q('film-chewbacca', 'What species is Chewbacca in Star Wars?', 'Wookiee', [
    'Ewok',
    'Hutt',
    'Rodian',
  ]),
  q(
    'film-phantom',
    'Which is the longest-running show in Broadway history?',
    'The Phantom of the Opera',
    ['Cats', 'Chicago', 'The Lion King'],
  ),

  // ---------- sport and games ----------
  q('sport-rugby-union', 'How many players does each rugby union team have on the field?', '15', [
    '11',
    '12',
    '13',
  ]),
  q('sport-world-cups', 'Which country has won the most FIFA men’s World Cups?', 'Brazil', [
    'Germany',
    'Italy',
    'Argentina',
  ]),
  q('sport-first-world-cup', 'Which country won the first FIFA World Cup, in 1930?', 'Uruguay', [
    'Argentina',
    'Brazil',
    'Italy',
  ]),
  q('sport-barcelona', 'Which city hosted the 1992 Summer Olympics?', 'Barcelona', [
    'Seoul',
    'Atlanta',
    'Sydney',
  ]),
  q('sport-athens', 'Which city hosted the first modern Olympic Games, in 1896?', 'Athens', [
    'Paris',
    'London',
    'Rome',
  ]),
  q('sport-marathon', 'How long is a marathon?', '42.195 km', ['40 km', '42 km', '43.195 km']),
  q('sport-albatross', 'In golf, what is three under par on a single hole called?', 'Albatross', [
    'Eagle',
    'Condor',
    'Birdie',
  ]),
  q('sport-fosbury', 'In which event is the Fosbury Flop used?', 'High jump', [
    'Pole vault',
    'Diving',
    'Gymnastics',
  ]),
  q('sport-snooker-black', 'How many points is the black ball worth in snooker?', '7', [
    '5',
    '6',
    '10',
  ]),
  q('sport-clay', 'Which Grand Slam tennis tournament is played on clay?', 'French Open', [
    'Wimbledon',
    'US Open',
    'Australian Open',
  ]),
  q('sport-chess-knight', 'In standard chess notation, which letter stands for the knight?', 'N', [
    'K',
    'Kn',
    'H',
  ]),

  // ---------- food and everyday things ----------
  q('food-marzipan', 'Which nut is the main ingredient of marzipan?', 'Almond', [
    'Hazelnut',
    'Pistachio',
    'Cashew',
  ]),
  q('food-saffron', 'Which spice comes from the Crocus sativus flower?', 'Saffron', [
    'Turmeric',
    'Paprika',
    'Cardamom',
  ]),
  q('food-coffee', 'Which country produces the most coffee?', 'Brazil', [
    'Vietnam',
    'Colombia',
    'Ethiopia',
  ]),
  q('food-pecorino', 'Pecorino cheese is made from which animal’s milk?', 'Sheep', [
    'Goat',
    'Cow',
    'Water buffalo',
  ]),
  q('food-halloumi', 'Halloumi cheese originates from which country?', 'Cyprus', [
    'Greece',
    'Turkey',
    'Lebanon',
  ]),
  q('tech-http', 'What does HTTP stand for?', 'HyperText Transfer Protocol', [
    'HyperText Transmission Protocol',
    'HighText Transfer Protocol',
    'Hyperlink Text Transfer Process',
  ]),
  q('tech-www', 'Who invented the World Wide Web?', 'Tim Berners-Lee', [
    'Vint Cerf',
    'Marc Andreessen',
    'Linus Torvalds',
  ]),
  q('tech-python', 'Which programming language did Guido van Rossum create?', 'Python', [
    'Ruby',
    'Perl',
    'Java',
  ]),
];
