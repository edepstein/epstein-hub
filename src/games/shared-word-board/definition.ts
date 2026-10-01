import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "shared-word-board",
  title: "Shared Word Board",
  tagline: "A friendly board. A thoughtful move.",
  category: "Play together",
  phase: "multiplayer",
  kind: "match",
  theme: {
    accent: "#76563d",
    wash: "#f1e7d9",
    kicker: "The shared table",
    strap: "Good company. Thoughtful words.",
    emblem: "▧",
    poster: "table",
  },
  rules: {
    summary:
      "Two to four players take turns building connected words on a nine-by-nine board from racks of seven tiles. Every word a move forms must be in the word list, and each move scores every word it makes.",
    sections: [
      {
        heading: "How this edition is played",
        points: [
          "This is local pass-and-play on one device. After each turn, pass the device to the next player; racks stay hidden until that player chooses to show theirs.",
          "Online play needs the server set up. It is not offered yet, and there is no computer opponent.",
          "Each match is pinned to one rules version and one word list for its whole life. A saved match is never replayed under different rules.",
        ],
      },
      {
        heading: "Placing tiles",
        points: [
          "Choose a tile on your rack, then choose an empty square. You can also move around the board with the arrow keys and press Enter to place the chosen tile.",
          "All the tiles you place in one turn must be in a single row or a single column.",
          "There must be no empty squares between your new tiles. Tiles already on the board may fill the gaps.",
          "The first move of the match must cover the centre star (row 5, column 5) and make a word of at least two letters.",
          "Every later move must join the tiles already on the board by sharing an edge. Touching only at a corner does not count.",
          "Committed tiles never move, and you cannot place a tile on a filled square.",
          "Every run of two or more letters that your move creates or extends, across or down, must be in the word list. If any one is not, the whole move is refused, nothing changes, and your tiles stay where you put them so you can fix it.",
          "Recall brings your placed tiles back to your rack. Shuffle rearranges your rack; it never changes your tiles.",
        ],
      },
      {
        heading: "Scoring",
        points: [
          "A move scores the sum of every word it forms, including letters already on the board that are part of those words.",
          "A tile where an across word and a down word cross counts in both words.",
          "Single letters that do not form a word of two or more letters score nothing.",
          "There is no bonus for using all seven tiles.",
          "Before you submit, the preview shows each word and exactly how its score is made up.",
        ],
      },
      {
        heading: "Rules 1.0: uniform fixture rules (short match)",
        points: [
          "Every letter scores 1 point. There are no blanks and no premium squares.",
          "The bag holds 32 tiles: A×5, B, C, D, E×5, G, I, L×2, N×2, O×2, R×4, S×3, T×4. This is the pack's fixture tile set, so matches are short.",
          "These are the rules the pack's worked example uses (CAT 3, CATS 4, CART 4).",
        ],
      },
      {
        heading: "Rules 1.1 candidate: premiums and letter values (proposed, not yet balanced)",
        points: [
          "93 tiles: 91 letters plus 2 blanks. Letter values: A, E, I, L, N, O, R, S, T, U 1; D, G 2; B, C, M, P 3; F, H, V, W, Y 4; K 5; J, X 7; Q, Z 9.",
          "Letter counts: A×8, B×2, C×2, D×4, E×10, F×2, G×2, H×3, I×6, J, K, L×4, M×2, N×6, O×6, P×2, Q, R×5, S×5, T×7, U×4, V×2, W×2, X, Y×2, Z.",
          "Double word squares (marked 2W) at rows 3 and 7, columns 3 and 7. Triple letter squares (marked 3L) at the middle of each edge: row 1 column 5, row 5 column 1, row 5 column 9 and row 9 column 5.",
          "Premiums count only for tiles placed on them this turn. Letter premiums are applied first, the word is added up, then multiplied by every new word premium it covers.",
          "A tile on a premium square counts its premium in each new word it belongs to, across and down.",
          "Once covered, a premium square is used up: later words through it score the tile's plain value.",
          "A blank can stand for any letter you choose from A to Z. It always scores 0, even on a letter premium, and its letter cannot change once committed.",
          "This configuration is a proposal from the build pack. Its balance has not been reviewed, and practice simulations suggest the board often fills up before the bag runs out.",
        ],
      },
      {
        heading: "Exchanging and passing",
        points: [
          "Instead of placing, you can exchange any number of your tiles (one to all seven) when the bag holds at least seven tiles. You draw replacements first, then your old tiles go back and the bag is shuffled. An exchange scores nothing and ends your turn.",
          "You can pass at any time. Passing ends your turn without drawing.",
          "Hints show words you could spell from your rack alone (not where they fit). Taking one is recorded as assistance in the match history and result.",
        ],
      },
      {
        heading: "Drawing and taking turns",
        points: [
          "After a move, you draw from the bag until you have seven tiles again, or the bag is empty.",
          "Play passes to the next player who has not resigned.",
        ],
      },
      {
        heading: "Ending the match",
        points: [
          "Going out: when the bag is empty and a player uses their last tile, the match ends. Every other player loses the value of the tiles left on their rack, and the player who went out gains the total of those values.",
          "Passes: if every player passes or exchanges three times in a row (six turns in a row with two players, nine with three, twelve with four), the match ends. Each player loses the value of their own remaining tiles; nobody gains them.",
          "Resigning: with two players, resigning ends the match and the other player wins; scores are left as they were, with no adjustments. With three or four players, the player who resigns leaves the match and the others carry on.",
          "The highest final score wins. Equal highest scores share the win.",
          "Resigning asks for confirmation first.",
        ],
      },
      {
        heading: "Word list",
        points: [
          "Words are checked against the Word Club word list (about 253,000 words, British and American spellings, with the 127 standard two-letter tile-game words). It is not Collins Scrabble Words itself and has not yet been reviewed for tile-game use, so a rare word you know may occasionally be refused.",
          "Only A to Z words count: no names, abbreviations, hyphens or apostrophes.",
        ],
      },
    ],
    example:
      "Under rules 1.0, Ann plays CAT across the centre for 3. Ben adds S after it to make CATS for 4. Ann then lays A, R and T down from the C to make CART for 4. Under rules 1.1, HOUSE with the H on a triple letter square scores 4×3 + 1 + 1 + 1 + 1 = 16.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    { gate: "Engine rules and tests", status: "passed", note: "Pure engine, fixture replayed exactly under 1.0, premium/blank/exchange/pass/went-out/resign, conflict and idempotency tests, seeded full-match simulations" },
    { gate: "Hidden-rack projection and turn protocol (pure functions)", status: "passed", note: "No-leak tests for racks, bag and exchanges; stale, duplicate and forged-seat handling" },
    { gate: "Local pass-and-play browser walkthrough (setup, keyboard, taps, exchange, pass, end, refresh, 390px)", status: "passed", note: "tests/e2e/shared-word-board.spec.ts" },
    { gate: "Balance review of rules 1.1 candidate (tile distribution, premiums, match length)", status: "open", note: "Simple-bot simulations block the 9x9 board with 11 to 23 tiles still in the bag" },
    { gate: "Online backend (authentication, invitations, server-side shuffle, redacted reads)", status: "open", note: "Not built; online play is not offered" },
    { gate: "Approved two-letter-and-longer tile-game word list", status: "open" },
    { gate: "Real-device pass-and-play testing", status: "open" },
    ...STANDARD_OPEN_GATES.filter((g) => !/daily editions|practice bank|dictionary membership/i.test(g.gate)),
  ],
};
