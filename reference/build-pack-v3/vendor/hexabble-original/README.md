# HEXABBLE (web version)

Open `index.html` in Chrome or Edge (double-click works, no server or internet needed).
To host it later, upload the whole folder to any static web host.

Files: `index.html`, `styles.css`, `app.js` (UI), `engine.js` (rules and scoring), `words.js` (dictionary, about 252k words).
Tests: `node tests/engine.test.js` (rules and scoring) and `node tests/simulate.js 6` (bots play full games).

## Rule interpretations
- Board: 217 hexes (17 across), premium layout copied from the PDF image. The centre start and the 6 key spaces are double-word spaces.
- Words read down, down-right or up-right. Every straight line of 2+ letters that includes a new tile is a word.
- Adjacent Letters Rule: a two-letter "touch" scores if valid and is ignored if not, but each new tile may have only one ignored touch. Lines of 3+ letters must always be valid.
- Three-Tile Adjacency Rule: a tile touching 3+ existing tiles must make a valid word with one of them.
- Word multipliers add up (DW + TW = 5x, DW + DW = 4x).
- Wild: any letter, 0 points. Key: any letter, 0 points. A Key must go on a free key space, where it can start an unconnected word. Once all key spaces are used, a Key works as a wild.
- Pivot: goes between two letters where the word changes direction (for example CA > TS reads CATS). It scores 0, doesn't trigger premiums and becomes a void that blocks later words.
- Scrabble defaults: 7-tile racks, +50 for using all 7 tiles, exchanges only while 7+ tiles are in the bag, and unplayed tiles deducted at the end (the player who goes out gains them). The game also ends after every player passes or fails twice in a row, or with the End game button.
- Official mode: an invalid word loses the turn (Challenge Rule). Friendly mode: live checking, with no penalty.
- Dictionary: ENABLE (public domain) + SCOWL British (permissive licence) + Collins two-letter words. It's not the official Collins list.
