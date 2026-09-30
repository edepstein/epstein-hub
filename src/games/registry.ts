/* Central registry. Each game owns src/games/<id>/; only add imports here when adding a new game. */
import type { GameDefinition, RoundBundle } from "./types";
import { definition as letterWheel } from "./letter-wheel/definition";
import { definition as letterSet } from "./letter-set/definition";
import { definition as wordDeduction } from "./word-deduction/definition";
import { definition as wordFamilies } from "./word-families/definition";
import { definition as hiddenWordTrail } from "./hidden-word-trail/definition";
import { definition as letterCircuit } from "./letter-circuit/definition";
import { definition as dailyCrossword } from "./daily-crossword/definition";
import { definition as wordLadder } from "./word-ladder/definition";
import { definition as cluePairs } from "./clue-pairs/definition";
import { definition as wordWeave } from "./word-weave/definition";
import { definition as crypticWorkshop } from "./cryptic-workshop/definition";
import { definition as shrinkingStaircase } from "./shrinking-staircase/definition";
import { definition as wordFragments } from "./word-fragments/definition";
import { definition as missingLinks } from "./missing-links/definition";
import { definition as phraseRepair } from "./phrase-repair/definition";
import { definition as anagramRelay } from "./anagram-relay/definition";
import { definition as definitionDetective } from "./definition-detective/definition";
import { definition as sharedWordBoard } from "./shared-word-board/definition";
import { definition as hexabble } from "./hexabble/definition";
import { rounds as letterWheelRounds } from "./letter-wheel/rounds";
import { rounds as letterSetRounds } from "./letter-set/rounds";
import { rounds as wordDeductionRounds } from "./word-deduction/rounds";
import { rounds as wordFamiliesRounds } from "./word-families/rounds";
import { rounds as hiddenWordTrailRounds } from "./hidden-word-trail/rounds";
import { rounds as letterCircuitRounds } from "./letter-circuit/rounds";
import { rounds as dailyCrosswordRounds } from "./daily-crossword/rounds";
import { rounds as wordLadderRounds } from "./word-ladder/rounds";
import { rounds as cluePairsRounds } from "./clue-pairs/rounds";
import { rounds as wordWeaveRounds } from "./word-weave/rounds";
import { rounds as crypticWorkshopRounds } from "./cryptic-workshop/rounds";
import { rounds as shrinkingStaircaseRounds } from "./shrinking-staircase/rounds";
import { rounds as wordFragmentsRounds } from "./word-fragments/rounds";
import { rounds as missingLinksRounds } from "./missing-links/rounds";
import { rounds as phraseRepairRounds } from "./phrase-repair/rounds";
import { rounds as anagramRelayRounds } from "./anagram-relay/rounds";
import { rounds as definitionDetectiveRounds } from "./definition-detective/rounds";
import { rounds as sharedWordBoardRounds } from "./shared-word-board/rounds";
import { rounds as hexabbleRounds } from "./hexabble/rounds";

export const GAMES: GameDefinition[] = [
  letterWheel,
  letterSet,
  wordDeduction,
  wordFamilies,
  hiddenWordTrail,
  letterCircuit,
  dailyCrossword,
  wordLadder,
  cluePairs,
  wordWeave,
  crypticWorkshop,
  shrinkingStaircase,
  wordFragments,
  missingLinks,
  phraseRepair,
  anagramRelay,
  definitionDetective,
  sharedWordBoard,
  hexabble,
];

const ROUNDS: Record<string, RoundBundle[]> = {
  "letter-wheel": letterWheelRounds as RoundBundle[],
  "letter-set": letterSetRounds as RoundBundle[],
  "word-deduction": wordDeductionRounds as RoundBundle[],
  "word-families": wordFamiliesRounds as RoundBundle[],
  "hidden-word-trail": hiddenWordTrailRounds as RoundBundle[],
  "letter-circuit": letterCircuitRounds as RoundBundle[],
  "daily-crossword": dailyCrosswordRounds as RoundBundle[],
  "word-ladder": wordLadderRounds as RoundBundle[],
  "clue-pairs": cluePairsRounds as RoundBundle[],
  "word-weave": wordWeaveRounds as RoundBundle[],
  "cryptic-workshop": crypticWorkshopRounds as RoundBundle[],
  "shrinking-staircase": shrinkingStaircaseRounds as RoundBundle[],
  "word-fragments": wordFragmentsRounds as RoundBundle[],
  "missing-links": missingLinksRounds as RoundBundle[],
  "phrase-repair": phraseRepairRounds as RoundBundle[],
  "anagram-relay": anagramRelayRounds as RoundBundle[],
  "definition-detective": definitionDetectiveRounds as RoundBundle[],
  "shared-word-board": sharedWordBoardRounds as RoundBundle[],
  "hexabble": hexabbleRounds as RoundBundle[],
};

export function getGame(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === id);
}

export function getRounds(gameId: string): RoundBundle[] {
  return ROUNDS[gameId] ?? [];
}

export function getRound(gameId: string, roundId: string): RoundBundle | undefined {
  return getRounds(gameId).find((r) => r.meta.id === roundId);
}

export const LAUNCH_IDS = ["letter-wheel", "word-deduction", "word-families", "word-ladder"] as const;
