import type { GameDefinition } from "../types";

/**
 * Hexabble: local pass-and-play match game (2 to 4 people on one device).
 * Rules text mirrors engine behaviour for rules version hexabble-rules-1.0
 * (see docs/hexabble-rules-decisions.md). Keep them in step.
 */
export const definition: GameDefinition = {
  id: "hexabble",
  title: "Hexabble",
  tagline: "A strategic hexagonal word game to play together.",
  category: "Play together",
  phase: "family-bonus",
  kind: "match",
  theme: {
    accent: "#845a15",
    wash: "#fff0cc",
    kicker: "The hexagonal table",
    strap: "A whole game to share.",
    emblem: "⬢",
    poster: "hex",
  },
  rules: {
    summary:
      "Two to four people take turns on one device, building words on a hexagonal board that read in three directions, and score the most points using premium spaces, special tiles and every letter on the rack.",
    sections: [
      {
        heading: "Who plays and how",
        points: [
          "Hexabble is local pass-and-play for two to four people sharing one device. There is no computer opponent and no online play.",
          "Players take turns in the order entered at setup. With the pass-the-device option on, each rack stays hidden until the next player presses Show my tiles.",
          "Each player holds a rack of seven tiles. After a move the rack is refilled from the bag.",
          "Matches save on this device after every change, including tiles you have not placed yet, so a refresh or interruption does not lose the game. This is not a backup: clearing browser data removes it.",
        ],
      },
      {
        heading: "The board",
        points: [
          "The board is a hexagon of 217 hexagonal spaces, 17 spaces across.",
          "Premium spaces: DL doubles a letter, TL triples a letter, DW doubles a word, TW triples a word. The centre start space and the six Key spaces are also double word spaces.",
          "Words read in three directions only: down, down-right and up-right.",
        ],
      },
      {
        heading: "Your turn",
        points: [
          "On your turn you either place tiles, exchange tiles or pass.",
          "Placing: put tiles in one straight line (down, down-right or up-right) with no gaps. Tiles already on the board may fill spaces in your line. Then press Place tiles.",
          "The first word must have at least two letters and cover the centre start space, unless it starts on a Key space with a Key tile (see Special tiles).",
          "After the first word, every word must join tiles already on the board, except a word started with a Key tile on a free Key space, or a word that covers the centre while the centre is still free.",
          "Before placing you can move tiles around, return one by selecting it again, or press Recall to take them all back. Nothing is committed until you press Place tiles.",
          "To place a tile: select it on your rack, then select a board space. You can also drag it. With a keyboard, press Enter on a rack tile, move with the arrow keys, and press Enter or Space on a space. Typing a letter on the board places a matching rack tile; Delete returns a tile.",
        ],
      },
      {
        heading: "Words and adjacency",
        points: [
          "Every new straight line of two or more letters that your tiles make counts as a word, in all three directions.",
          "Lines of three or more letters must always be valid words.",
          "Adjacent Letters Rule: on a hex board a tile often touches letters by accident. A two-letter touch that is a valid word scores; one that is not is ignored. Each tile you place may have at most one ignored touch, so a tile touching two letters must make a valid word with at least one of them.",
          "Three-Tile Adjacency Rule: a tile that touches three or more letters already on the board must also make a valid word with one of them.",
          "If a move could be read in more than one way, the legal reading with the highest score is used, and the preview shows which one.",
        ],
      },
      {
        heading: "Special tiles",
        points: [
          "Wild (4 tiles): shows any letter you choose and scores 0.",
          "Key (2 tiles): shows any letter and scores 0. While any Key space is free, a Key must be placed on a free Key space, and there it may start a new word anywhere without joining existing tiles. A normal letter on a Key space does not allow that. Once all six Key spaces are covered, a Key is simply a Wild.",
          "Pivot (4 tiles): place it between two letters of your word where the word turns to a different reading direction, for example CA, Pivot, TS reads CATS. The word must change direction at every Pivot and each part must have at least one letter. A Pivot scores 0, triggers no premium and stays on the board as a void: later words cannot read through it and it does not count as a neighbour.",
        ],
      },
      {
        heading: "Scoring",
        points: [
          "Letter values are shown on each tile. DL and TL multiply a newly placed letter; DW and TW multiply the whole word.",
          "Word multipliers add up rather than multiply: DW plus TW is five times, two DWs are four times.",
          "Premium spaces count only on the turn they are first covered.",
          "Each word your move makes is scored separately, with the premiums under its own new tiles, and the scores are added together.",
          "Using all seven rack tiles in one move earns 50 bonus points (once per move). A Pivot counts as one of the seven.",
        ],
      },
      {
        heading: "Exchanging and passing",
        points: [
          "Exchange: swap any number of your tiles for new ones from the bag. You can only exchange while the bag holds at least seven tiles. It uses your turn and scores nothing.",
          "Pass: give up your turn and score nothing. Any unplaced tiles return to your rack.",
        ],
      },
      {
        heading: "Checking modes",
        points: [
          "Friendly checking (recommended): words are checked as you build your move and the preview marks each one. A move with an invalid word cannot be placed, and nobody loses a turn.",
          "Challenge checking: the preview shows the geometry and a projected score but does not reveal whether words are valid. Words are checked when you press Place tiles; if any word is invalid, the move is refused, you keep your tiles and lose that turn.",
          "Both modes use the same rules and word list. They change how words are checked, not how difficult the game is, and neither is an official tournament ruleset.",
          "Moves that break the placement rules (gaps, not joining the board, Pivot or Key misuse) are always refused without losing the turn.",
        ],
      },
      {
        heading: "Ending the match",
        points: [
          "The match ends when a player uses their last tile while the bag is empty.",
          "It also ends after a run of scoreless turns in a row equal to twice the number of players (four in a two-player match). Passes, exchanges and failed challenges all count as scoreless turns.",
          "You can also end it by agreement with End game, when nobody can make a useful move.",
          "At the end, everyone loses the value of the tiles left on their rack. A player who used their last tile with the bag empty also gains the total of everyone else's unplayed tiles. The highest final score wins; a tie shows every winner.",
        ],
      },
      {
        heading: "Word list",
        points: [
          "Words are checked against the Word Club word list (about 253,000 words), the same list the other games use. It includes the standard two-letter tile-game words (such as QI, ZA, AA and AE) and accepts both British and American spellings. It is not Collins Scrabble Words itself and has not yet had full editorial review.",
          "Only the 127 two-letter words used in Collins Scrabble Words are accepted at two letters. Abbreviations that are not words (such as CF or JR) are refused.",
          "The list holds ordinary words: names of places and people, hyphenated words and words with apostrophes are not included. Only slurs are removed from the list; ordinary rude words are accepted, as in tile-game dictionaries.",
        ],
      },
    ],
    example:
      "The opening CAT reading down from the centre scores (C 3 + A 1 + T 1) x 2 for the centre double word = 10. Later, adding S below it makes CATS.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    {
      gate: "Engine rules and tests",
      status: "passed",
      note: "Pure TypeScript engine (rules hexabble-rules-1.0) with the 18 ported pack checks, targeted Pivot/Key/premium/adjacency cases, seeded bot simulations and snapshot tests.",
    },
    {
      gate: "Complete local match loop in the browser",
      status: "passed",
      note: "Setup, handover, keyboard and pointer placement, preview, exchange, pass, end, results and device-local restore covered by tests/e2e/hexabble.spec.ts.",
    },
    { gate: "Publication permission for the Hexabble name, board artwork/layout and supplied code", status: "open" },
    { gate: "Originating rules document (board/rules PDF) reviewed against rules decisions R1–R14", status: "open", note: "The PDF is not in the pack." },
    { gate: "Approved word-game dictionary membership and notices", status: "open", note: "Uses the ESDB candidate list; see REVIEW-LOG." },
    { gate: "Real phone and tablet testing (touch drag, pan, readable board)", status: "open" },
    { gate: "Manual screen-reader and real-device checks", status: "open" },
    { gate: "Observed family play session", status: "open" },
  ],
};
