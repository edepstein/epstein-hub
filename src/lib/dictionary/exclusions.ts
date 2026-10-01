/**
 * Gameplay exclusions applied on top of the membership list.
 * Collins Scrabble Words contains ordinary rude words (ARSE, BOLLOCKS, CRAP and so on), and a
 * word-game player may reasonably play them, so those are ACCEPTED. Only slurs aimed at people
 * for their race, disability, sexuality or gender identity are excluded, as a deliberate
 * family-space policy. This is the one place where the game is stricter than official Scrabble
 * word lists; an editor should confirm it (docs/REVIEW-LOG.md, Shared). Entries are upper-case A-Z.
 * Curated puzzle answers and targets are chosen from the familiar-word layer, so ordinary rude
 * words never become targets.
 */
export const EXCLUDED_WORDS: ReadonlySet<string> = new Set([
  "NIGGER", "NIGGERS", "NIGGA", "NIGGAS", "FAGGOT", "FAGGOTS", "FAG", "FAGS", "DYKE", "DYKES", "SPASTIC", "SPASTICS", "SPAZ",
  "RETARD", "RETARDS", "PAKI", "PAKIS", "CHINK", "CHINKS", "GOOK", "GOOKS", "KIKE", "KIKES", "WOP", "WOPS", "WETBACK", "WETBACKS",
  "COON", "COONS", "DAGO", "DAGOS", "TRANNY", "TRANNIES", "YID", "YIDS", "POLACK", "POLACKS", "SPIC", "SPICS", "SPICK", "SPICKS",
]);
