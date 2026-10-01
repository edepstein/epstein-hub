/** Node-only loader for tests, validators and offline generators. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildMembership } from "./index";
import { CRUDE_WORDS } from "./crude";

let memo: Set<string> | null = null;
export function loadMembershipSync(): Set<string> {
  if (!memo) memo = buildMembership(readFileSync(join(process.cwd(), "public/dictionaries/wc-membership-v2.txt"), "utf8"));
  return memo;
}

let familiar: Set<string> | null = null;
/**
 * SCOWL size-35 "familiar" layer for authoring/validation only (data/dictionaries). Use it to
 * check that curated targets are everyday words; never as gameplay membership.
 */
export function loadFamiliarSync(): Set<string> {
  if (!familiar) {
    familiar = new Set(
      readFileSync(join(process.cwd(), "data/dictionaries/gb-esdb-v1-size35.txt"), "utf8")
        .split(/\r?\n/)
        .filter((w) => w && !CRUDE_WORDS.has(w)),
    );
  }
  return familiar;
}
