/**
 * Gameplay exclusions applied on top of the ESDB candidate list.
 * This is a first-pass automated filter for clearly offensive or slur terms and is NOT
 * an editorial review; see docs/REVIEW-LOG.md. Keep entries upper-case A–Z.
 */
export const EXCLUDED_WORDS: ReadonlySet<string> = new Set([
  "CUNT", "CUNTS", "FUCK", "FUCKED", "FUCKER", "FUCKERS", "FUCKING", "FUCKS", "SHIT", "SHITS", "SHITTY", "SHITTED",
  "BITCH", "BITCHES", "BITCHY", "WANK", "WANKER", "WANKERS", "WANKED", "WANKING", "TWAT", "TWATS", "BOLLOCKS",
  "NIGGER", "NIGGERS", "NIGGA", "NIGGAS", "FAGGOT", "FAGGOTS", "FAG", "FAGS", "DYKE", "DYKES", "SPASTIC", "SPASTICS", "SPAZ",
  "RETARD", "RETARDS", "PAKI", "PAKIS", "CHINK", "CHINKS", "GOOK", "GOOKS", "KIKE", "KIKES", "WOP", "WOPS", "WETBACK", "WETBACKS",
  "COON", "COONS", "DAGO", "DAGOS", "TRANNY", "TRANNIES", "PISS", "PISSED", "PISSING", "ARSEHOLE", "ARSEHOLES", "ASSHOLE", "ASSHOLES",
  "DICKHEAD", "DICKHEADS", "ARSE", "ARSES", "ARSED", "TURD", "TURDS", "CRAP", "CRAPS", "CRAPPY", "CRAPPED", "BUGGERY", "SODOMY", "SODOMISE", "SODOMIZE", "COCKSUCKER", "MOTHERFUCKER", "SLUT", "SLUTS", "WHORE", "WHORES", "SPUNK", "JIZZ", "CLIT", "CLITS",
]);
