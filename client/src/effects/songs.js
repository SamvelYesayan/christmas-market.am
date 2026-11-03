// Playlist of PUBLIC-DOMAIN melodies in our own arrangements (no recordings are embedded).
// Notation: "E4:1" = note E4 for 1 beat (quarter note), "R:1" = rest. Chords: "C:4" = C major for 4 beats.
// Chord suffixes: m (minor), 7 (dominant seventh).
export const SONGS = [
  {
    id: 'jingle-bells',
    title: { en: 'Jingle Bells', hy: 'Զանգակներ (Jingle Bells)' },
    credit: { en: 'J. L. Pierpont, 1857 · public domain', hy: 'Ջ. Լ. Փիերփոնթ, 1857 · հանրային սեփականություն' },
    bpm: 148, lead: 'celesta', bells: true, repeats: 2,
    melody: `E4:1 E4:1 E4:2 E4:1 E4:1 E4:2 E4:1 G4:1 C4:1.5 D4:0.5 E4:4
      F4:1 F4:1 F4:1.5 F4:0.5 F4:1 E4:1 E4:1 E4:0.5 E4:0.5 E4:1 D4:1 D4:1 E4:1 D4:2 G4:2
      E4:1 E4:1 E4:2 E4:1 E4:1 E4:2 E4:1 G4:1 C4:1.5 D4:0.5 E4:4
      F4:1 F4:1 F4:1.5 F4:0.5 F4:1 E4:1 E4:1 E4:0.5 E4:0.5 G4:1 G4:1 F4:1 D4:1 C4:4`,
    chords: 'C:4 C:4 C:4 C:4 F:4 C:4 D7:4 G7:4 C:4 C:4 C:4 C:4 F:4 C:4 G7:4 C:4',
  },
  {
    id: 'we-wish-you',
    title: { en: 'We Wish You a Merry Christmas', hy: 'Մաղթում ենք ուրախ Սուրբ Ծնունդ' },
    credit: { en: 'English traditional · public domain', hy: 'Անգլիական ժողովրդական · հանրային սեփականություն' },
    bpm: 138, lead: 'celesta', bells: true, repeats: 2, beatsPerBar: 3,
    melody: `D4:1 G4:1 G4:0.5 A4:0.5 G4:0.5 F#4:0.5 E4:1 E4:1 E4:1
      A4:1 A4:0.5 B4:0.5 A4:0.5 G4:0.5 F#4:1 D4:1 D4:1
      B4:1 B4:0.5 C5:0.5 B4:0.5 A4:0.5 G4:1 E4:1 D4:0.5 D4:0.5 E4:1 A4:1 F#4:1 G4:3`,
    chords: 'G:1 G:3 C:3 A7:3 D:3 B7:3 Em:3 C:1 D7:2 G:3',
  },
  {
    id: 'deck-the-halls',
    title: { en: 'Deck the Halls', hy: 'Զարդարեք սրահները' },
    credit: { en: 'Welsh traditional · public domain', hy: 'Ուելսյան ժողովրդական · հանրային սեփականություն' },
    bpm: 116, lead: 'bell', bells: false, repeats: 2,
    melody: `G4:1.5 F4:0.5 E4:1 D4:1 C4:1 D4:1 E4:1 C4:1 D4:0.5 E4:0.5 F4:0.5 D4:0.5 E4:1.5 D4:0.5 C4:1 B3:1 C4:2
      G4:1.5 F4:0.5 E4:1 D4:1 C4:1 D4:1 E4:1 C4:1 D4:0.5 E4:0.5 F4:0.5 D4:0.5 E4:1.5 D4:0.5 C4:1 B3:1 C4:2
      D4:1.5 E4:0.5 F4:1 D4:1 E4:1.5 F4:0.5 G4:1 D4:1 E4:0.5 F#4:0.5 G4:1 A4:0.5 B4:0.5 C5:1 B4:1 A4:1 G4:2
      G4:1.5 F4:0.5 E4:1 D4:1 C4:1 D4:1 E4:1 C4:1 A4:0.5 A4:0.5 A4:0.5 A4:0.5 G4:1.5 F4:0.5 E4:1 D4:1 C4:2`,
    chords: 'C:4 C:4 G7:4 C:2 G7:1 C:1 C:4 C:4 G7:4 C:2 G7:1 C:1 G:4 C:2 G:2 D7:4 G:4 C:4 C:4 F:4 G7:2 C:2',
  },
  {
    id: 'silent-night',
    title: { en: 'Silent Night', hy: 'Լուռ գիշեր' },
    credit: { en: 'F. X. Gruber, 1818 · public domain', hy: 'Ֆ. Քս. Գրուբեր, 1818 · հանրային սեփականություն' },
    bpm: 66, lead: 'flute', bells: false, repeats: 1, beatsPerBar: 3,
    melody: `G4:1.5 A4:0.5 G4:1 E4:3 G4:1.5 A4:0.5 G4:1 E4:3 D5:2 D5:1 B4:3 C5:2 C5:1 G4:3
      A4:2 A4:1 C5:1.5 B4:0.5 A4:1 G4:1.5 A4:0.5 G4:1 E4:3 A4:2 A4:1 C5:1.5 B4:0.5 A4:1 G4:1.5 A4:0.5 G4:1 E4:3
      D5:2 D5:1 F5:1.5 D5:0.5 B4:1 C5:3 E5:3 C5:1 G4:1 E4:1 G4:1.5 F4:0.5 D4:1 C4:3 R:3`,
    chords: 'C:3 C:3 C:3 C:3 G7:3 G7:3 C:3 C:3 F:3 F:3 C:3 C:3 F:3 F:3 C:3 C:3 G7:3 G7:3 C:3 C:3 C:3 G7:3 C:3 C:3',
  },
  {
    id: 'joy-to-the-world',
    title: { en: 'Joy to the World', hy: 'Ցնծա՛, աշխարհ' },
    credit: { en: 'L. Mason, 1839 · public domain', hy: 'Լ. Մեյսոն, 1839 · հանրային սեփականություն' },
    bpm: 104, lead: 'bell', bells: false, repeats: 1,
    melody: `C5:2 B4:1.5 A4:0.5 G4:3 F4:1 E4:2 D4:2 C4:3 G4:1 A4:3 A4:1 B4:3 B4:1 C5:3 C5:1
      C5:1 B4:1 A4:1 G4:1 G4:1.5 F4:0.5 E4:1 C5:1 C5:1 B4:1 A4:1 G4:1 G4:1.5 F4:0.5 E4:1 E4:1
      E4:1 E4:1 E4:1 E4:0.5 F4:0.5 G4:3 F4:0.5 E4:0.5 D4:1 D4:1 D4:1 D4:0.5 E4:0.5 F4:3 E4:0.5 D4:0.5
      C4:1 C5:2 A4:1 G4:1.5 F4:0.5 E4:1 F4:1 E4:2 D4:2 C4:4`,
    chords: 'C:4 C:2 F:2 C:2 G7:2 C:4 F:4 G7:4 C:4 C:2 G:2 C:4 C:2 G:2 C:4 C:4 C:4 G7:4 G7:4 C:2 F:2 C:2 F:2 C:2 G7:2 C:4',
  },
  {
    id: 'snowglobe-waltz',
    title: { en: 'Snowglobe Waltz', hy: 'Ձյունե գնդի վալս' },
    credit: { en: 'Original for Christmas Market', hy: 'Օրիգինալ ստեղծագործություն Ամանորյա տոնավաճառի համար' },
    bpm: 132, lead: 'celesta', bells: false, repeats: 2, beatsPerBar: 3, arpeggio: true,
    melody: `E5:2 D5:1 C5:3 G4:2 A4:1 C5:3 D5:2 E5:1 F5:2 E5:1 D5:3 R:3
      E5:2 D5:1 C5:3 A4:2 B4:1 C5:3 D5:2 C5:1 B4:2 G4:1 C5:3 R:3`,
    chords: 'C:3 Am:3 F:3 C:3 Dm:3 G7:3 G7:3 G7:3 C:3 Am:3 F:3 C:3 Dm:3 G7:3 C:3 C:3',
  },
];
