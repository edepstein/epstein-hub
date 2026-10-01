/* Authoring helper (not imported by the app): builds content/rounds.json from a compact table, sets
 * claimsUnique only when the solver proves it, and prints rival boards for editorial review.
 * Run: pnpm exec tsx src/games/word-fragments/author.gen.ts */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRng, seedFrom } from "@/lib/rng";
import { loadMembershipSync } from "@/lib/dictionary/node";
import type { FragPayload } from "./engine";
import { acceptedTextAllocations, rivalBoards } from "./validate-core";

type Row = {
  id: string;
  title: string;
  difficulty: "gentle" | "standard" | "expert";
  status: "demo" | "practice";
  source: string | null;
  /** [clue, "FRAG|MENT|S"] per lane */
  lanes: [string, string][];
  explanation: string;
  /** Keep the pack's tile ids/order for demo fixtures. */
  keepOrder?: boolean;
};

const rows: Row[] = [
  { id: "wf-demo-1", title: "Original demo board 1", difficulty: "gentle", status: "demo", source: "fragments-001", keepOrder: true, lanes: [["Paper money represented by a single note", "BANK|NOTE"], ["An arc of colours seen when sunlight passes through rain", "RAIN|BOW"], ["A tall plant with a large yellow flower head", "SUN|FLOW|ER"]], explanation: "Every fragment is consumed exactly once." },
  { id: "wf-demo-2", title: "Original demo board 2", difficulty: "gentle", status: "demo", source: "fragments-002", keepOrder: true, lanes: [["A marker placed between pages to keep your place", "BOOK|MARK"], ["An insect with broad, often colourful wings", "BUT|TER|FLY"], ["The hard outer covering of a marine mollusc", "SEA|SHELL"]], explanation: "The target spellings use all seven fragment tiles." },
  { id: "wf-g1", title: "Gentle board 1", difficulty: "gentle", status: "practice", source: null, lanes: [["Bright light from the sun", "SUN|SHINE"], ["A pot with a spout for brewing a hot drink", "TEA|POT"], ["A game played by two teams of eleven, kicking a ball", "FOOT|BALL"]], explanation: "Three compounds of two whole words each." },
  { id: "wf-g2", title: "Gentle board 2", difficulty: "gentle", status: "practice", source: null, lanes: [["A cabinet with shelves, often in a kitchen", "CUP|BOARD"], ["A waterproof coat", "RAIN|COAT"], ["The step just outside a front door", "DOOR|STEP"]], explanation: "Three compounds of two whole words each." },
  { id: "wf-g3", title: "Gentle board 3", difficulty: "gentle", status: "practice", source: null, lanes: [["A ball of packed snow for throwing", "SNOW|BALL"], ["A trim at the barber's or hairdresser's", "HAIR|CUT"], ["A thin flat cake fried in a pan, eaten on Shrove Tuesday", "PAN|CAKE"]], explanation: "Three compounds of two whole words each." },
  { id: "wf-g4", title: "Gentle board 4", difficulty: "gentle", status: "practice", source: null, lanes: [["The room where you sleep", "BED|ROOM"], ["A tower with a bright lamp that guides ships", "LIGHT|HOUSE"], ["A sea creature shaped like a five-pointed star", "STAR|FISH"]], explanation: "Three compounds of two whole words each." },
  { id: "wf-g5", title: "Gentle board 5", difficulty: "gentle", status: "practice", source: null, lanes: [["The anniversary of the day you were born", "BIRTH|DAY"], ["A stream of water dropping over a cliff", "WATER|FALL"], ["A small bag for carrying a purse and keys", "HAND|BAG"]], explanation: "Three compounds of two whole words each." },
  { id: "wf-s1", title: "Standard board 1", difficulty: "standard", status: "practice", source: null, lanes: [["A plot of land where flowers and vegetables grow", "GAR|DEN"], ["A thick floor covering", "CAR|PET"], ["A container woven from cane or wicker", "BAS|KET"]], explanation: "Each word splits into two spelling chunks, and the first chunks look interchangeable: only one sharing-out spells all three answers." },
  { id: "wf-s2", title: "Standard board 2", difficulty: "standard", status: "practice", source: null, lanes: [["A room where food is cooked", "KIT|CHEN"], ["A farmyard bird that lays eggs", "CHIC|KEN"], ["A glove without separate finger sections", "MIT|TEN"]], explanation: "KIT and MIT, CHEN, KEN and TEN look as if they could swap; the clues decide." },
  { id: "wf-s3", title: "Standard board 3", difficulty: "standard", status: "practice", source: null, lanes: [["A seafarer who robs ships", "PI|RATE"], ["A round citrus fruit", "OR|ANGE"], ["A world that travels round a star", "PLAN|ET"], ["A pale yellow spread made from cream", "BUT|TER"]], explanation: "Four lanes, with chunks split inside the words rather than at syllables." },
  { id: "wf-s4", title: "Standard board 4", difficulty: "standard", status: "practice", source: null, lanes: [["A writing tool with a graphite core", "PEN|CIL"], ["An opening in a wall that lets in light", "WIN|DOW"], ["A meal eaten outdoors", "PIC|NIC"]], explanation: "Spelling chunks, not syllables: PEN+CIL, WIN+DOW, PIC+NIC." },
  { id: "wf-s5", title: "Standard board 5", difficulty: "standard", status: "practice", source: null, lanes: [["A tool for knocking in nails", "HAM|MER"], ["A stick of wax with a wick", "CAN|DLE"], ["A flat piece of furniture with legs", "TA|BLE"], ["A large black and white bear from China", "PAN|DA"]], explanation: "CAN and PAN, TA and DA look as if they could swap; only one sharing-out spells all four answers." },
  { id: "wf-e1", title: "Expert board 1", difficulty: "expert", status: "practice", source: null, lanes: [["A long-tailed animal that climbs trees", "MON|KEY"], ["A long-eared animal related to the horse", "DON|KEY"], ["A large bird often roasted at Christmas", "TUR|KEY"], ["A team game played with sticks, on a field or on ice", "HOC|KEY"]], explanation: "Four identical KEY tiles: any KEY can finish any lane, so the challenge is pairing the openings." },
  { id: "wf-e2", title: "Expert board 2", difficulty: "expert", status: "practice", source: null, lanes: [["A starchy vegetable dug from the ground", "POT|ATO"], ["A red fruit used in salads and sauces", "TOM|ATO"], ["The lowest part of something", "BOT|TOM"]], explanation: "Two ATO tiles and two TOM tiles: TOM starts one word and ends another." },
  { id: "wf-e3", title: "Expert board 3", difficulty: "expert", status: "practice", source: null, lanes: [["A thick floor covering", "CAR|PET"], ["An orange root vegetable", "CAR|ROT"], ["A colourful bird that can copy speech", "PAR|ROT"], ["A brass instrument with three valves", "TRUM|PET"]], explanation: "Repeated CAR, ROT and PET tiles; CAR and PAR both fit before ROT, so the clues decide." },
  { id: "wf-e4", title: "Expert board 4", difficulty: "expert", status: "practice", source: null, lanes: [["An insect with broad, colourful wings", "BUT|TER|FLY"], ["A small yellow meadow flower", "BUT|TER|CUP"], ["A cabinet with shelves, often in a kitchen", "CUP|BOARD"], ["The set of keys you type on", "KEY|BOARD"]], explanation: "BUT, TER, CUP and BOARD each appear twice; CUP can end one word or begin another." },
  { id: "wf-e5", title: "Expert board 5", difficulty: "expert", status: "practice", source: null, lanes: [["A pot for brewing a hot drink", "TEA|POT"], ["A small spoon for stirring a cup", "TEA|SPOON"], ["A strong beam of light on a stage", "S|POT|LIGHT"], ["A hole in a road surface", "POT|HOLE"]], explanation: "Three POT tiles, two TEA tiles and a lone S: S+POT could also read SPOT, so the clues decide." },
];

const membership = loadMembershipSync();
const out = rows.map((r) => {
  const lanes = r.lanes.map(([clue, parts], i) => ({ id: "abcdefgh"[i], clue, length: parts.replace(/\|/g, "").length }));
  const pieces = r.lanes.flatMap(([, parts], i) => parts.split("|").map((text) => ({ lane: lanes[i].id, text })));
  const order = r.keepOrder ? pieces.map((_, i) => i) : createRng(seedFrom(r.id)).shuffle(pieces.map((_, i) => i));
  const idOf = new Map<number, string>();
  order.forEach((pieceIndex, k) => idOf.set(pieceIndex, `t${k + 1}`));
  const tiles = order.map((pieceIndex) => ({ id: idOf.get(pieceIndex)!, text: pieces[pieceIndex].text }));
  const allocation: Record<string, string[]> = {};
  pieces.forEach((pc, i) => (allocation[pc.lane] ??= []).push(idOf.get(i)!));
  const acceptedAnswers = Object.fromEntries(r.lanes.map(([, parts], i) => [lanes[i].id, [parts.replace(/\|/g, "")]]));
  const payload: FragPayload = { lanes, tiles, acceptedAnswers, allocations: [allocation], claimsUnique: false, explanation: r.explanation };
  const textAllocs = acceptedTextAllocations(payload);
  payload.claimsUnique = textAllocs.length === 1;
  const rivals = rivalBoards(payload, membership, 10);
  console.log(r.id, "text allocations", textAllocs.length, "rivals", rivals.length, rivals.slice(0, 4).join("  ;  "));
  return { id: r.id, title: r.title, difficulty: r.difficulty, status: r.status, sourceFixtureId: r.source, payload };
});

writeFileSync(
  join(process.cwd(), "src/games/word-fragments/content/rounds.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      gameId: "word-fragments",
      rulesVersion: "1.0",
      note: "Demo rounds import the pack fixtures (sourceFixtureId) with their tile ids. Practice rounds are original to this build; tile ids are shuffled so they do not reveal grouping. claimsUnique is set only when the exact allocation solver finds a single sharing-out of fragment texts. Clues are original and not yet human-reviewed.",
      rounds: out,
    },
    null,
    2,
  ) + "\n",
);
