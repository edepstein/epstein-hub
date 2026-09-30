/** Node-only loader for tests, validators and offline generators. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildMembership } from "./index";

let memo: Set<string> | null = null;
export function loadMembershipSync(): Set<string> {
  if (!memo) memo = buildMembership(readFileSync(join(process.cwd(), "public/dictionaries/gb-esdb-v1.txt"), "utf8"));
  return memo;
}
