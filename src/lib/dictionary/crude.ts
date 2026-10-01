/**
 * Ordinary rude words. These are valid in tile-game dictionaries, so players may play them
 * (membership accepts them), but they are never offered by the game: they are removed from the
 * familiar-word layer used to choose targets, hint words and example routes.
 */
export const CRUDE_WORDS: ReadonlySet<string> = new Set([
  "CUNT", "CUNTS", "FUCK", "FUCKED", "FUCKER", "FUCKERS", "FUCKING", "FUCKS", "SHIT", "SHITS", "SHITTY", "SHITTED",
  "BITCH", "BITCHES", "BITCHY", "WANK", "WANKER", "WANKERS", "WANKED", "WANKING", "TWAT", "TWATS", "BOLLOCKS",
  "PISS", "PISSED", "PISSING", "ARSEHOLE", "ARSEHOLES", "ASSHOLE", "ASSHOLES", "DICKHEAD", "DICKHEADS", "ARSE", "ARSES", "ARSED",
  "TURD", "TURDS", "CRAP", "CRAPS", "CRAPPY", "CRAPPED", "BUGGERY", "SODOMY", "SODOMISE", "SODOMIZE", "COCKSUCKER", "MOTHERFUCKER",
  "SLUT", "SLUTS", "WHORE", "WHORES", "SPUNK", "JIZZ", "CLIT", "CLITS", "ANUS", "ANUSES",
]);
