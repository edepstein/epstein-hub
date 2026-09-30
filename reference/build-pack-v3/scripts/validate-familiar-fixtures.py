#!/usr/bin/env python3
"""Validate original familiar-game demos. Not production editorial certification."""
from pathlib import Path
from collections import Counter, deque
import json

ROOT = Path(__file__).resolve().parents[1]
SLUGS = ['letter-wheel', 'letter-set', 'word-deduction', 'word-families',
         'hidden-word-trail', 'letter-circuit', 'daily-crossword', 'shared-word-board']

def feedback(answer, guess):
    result = ['absent'] * len(answer)
    remaining = Counter(answer)
    for i, char in enumerate(guess):
        if char == answer[i]:
            result[i] = 'correct'
            remaining[char] -= 1
    for i, char in enumerate(guess):
        if result[i] != 'correct' and remaining[char] > 0:
            result[i] = 'present'
            remaining[char] -= 1
    return result

def circuit_optimum(r):
    alphabet = [c for side in r['sides'] for c in side]
    bits = {c: 1 << i for i, c in enumerate(alphabet)}
    full = (1 << len(alphabet)) - 1
    words = [(w, sum(bits[c] for c in set(w))) for w in r['acceptedWords']]
    queue = deque([('', 0, 0)])
    seen = {('', 0)}
    while queue:
        end, covered, count = queue.popleft()
        if covered == full:
            return count
        for word, mask in words:
            if end and word[0] != end:
                continue
            state = (word[-1], covered | mask)
            if state not in seen:
                seen.add(state)
                queue.append((*state, count + 1))
    raise AssertionError('Circuit has no complete route')

def replay_board(r):
    config = r['configuration']
    racks = {p: list(v) for p, v in config['initialRacks'].items()}
    bag, board = list(config['initialBagDrawOrder']), {}
    scores = {p: 0 for p in racks}
    for index, turn in enumerate(r['turns']):
        player = turn['player']
        assert player == ('p1' if index % 2 == 0 else 'p2')
        new = {(tile['row'], tile['column']): tile['letter'] for tile in turn['tiles']}
        assert len(new) == len(turn['tiles'])
        assert len({x for x, y in new}) == 1 or len({y for x, y in new}) == 1
        for (x, y), letter in new.items():
            assert 0 <= x < config['boardSize'] and 0 <= y < config['boardSize']
            assert (x, y) not in board and letter in racks[player]
        if not board:
            assert tuple(config['anchor']) in new
        else:
            assert any((x + dx, y + dy) in board for x, y in new
                       for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)])
        for letter in new.values():
            racks[player].remove(letter)
        board.update(new)
        rows, cols = {x for x, y in new}, {y for x, y in new}
        if len(rows) == 1:
            x = next(iter(rows)); ys = [y for a, y in new]
            assert all((x, y) in board for y in range(min(ys), max(ys) + 1))
        else:
            y = next(iter(cols)); xs = [x for x, b in new]
            assert all((x, y) in board for x in range(min(xs), max(xs) + 1))
        paths = set()
        for x, y in new:
            for dx, dy in [(1, 0), (0, 1)]:
                a, b = x, y
                while (a - dx, b - dy) in board:
                    a -= dx; b -= dy
                path = []
                while (a, b) in board:
                    path.append((a, b)); a += dx; b += dy
                if len(path) >= config['minimumWordLength']:
                    paths.add(tuple(path))
        words = [''.join(board[cell] for cell in path) for path in paths]
        assert sorted(words) == sorted(turn['formedWords'])
        assert all(word in config['dictionary'] for word in words)
        score = sum(sum(config['tileScores'][board[cell]] for cell in path) for path in paths)
        assert score == turn['expectedScore']
        scores[player] += score
        draw = bag[:config['rackSize'] - len(racks[player])]
        del bag[:len(draw)]
        assert draw == turn['expectedDraw']
        racks[player] += draw
        assert racks[player] == turn['expectedNextRack']
    assert scores == r['expectedTotals']

def validate(slug, r):
    assert r['status'] == 'demo' and r['rulesVersion'] == '1.0'
    assert r['dictionaryVersion'] == 'demo-uk-v1'
    assert r['hints'] and r['explanation']
    if slug == 'letter-wheel':
        rack = Counter(''.join(r['letters']).lower())
        assert sum(rack.values()) == 9
        for word in r['acceptedWords']:
            assert len(word) >= 4 and r['requiredLetter'].lower() in word
            assert not Counter(word) - rack
        assert set(r['nineLetterAnswers']) == {w for w in r['acceptedWords'] if len(w) == 9}
        assert r['nineLetterAnswers']
        assert r['maximumScore'] == sum(len(w) + (9 if len(w) == 9 else 0) for w in r['acceptedWords'])
    elif slug == 'letter-set':
        letters = set(''.join(r['letters']).lower())
        assert len(letters) == 7
        for word in r['acceptedWords']:
            assert len(word) >= 4 and r['requiredLetter'].lower() in word and set(word) <= letters
        assert set(r['allLetterAnswers']) == {w for w in r['acceptedWords'] if set(w) == letters}
        assert r['allLetterAnswers']
        assert r['maximumScore'] == sum((1 if len(w) == 4 else len(w)) + (7 if set(w) == letters else 0) for w in r['acceptedWords'])
    elif slug == 'word-deduction':
        assert r['answer'] in r['acceptedGuesses'] and len(r['answer']) == 5
        for item in r['testGuesses']:
            assert item['guess'] in r['acceptedGuesses']
            assert feedback(r['answer'], item['guess']) == item['expectedFeedback']
    elif slug == 'word-families':
        terms = [term for group in r['groups'] for term in group['terms']]
        assert all(len(group['terms']) == 4 for group in r['groups'])
        assert len(set(terms)) == len(terms) == 16
        assert sorted(r['displayOrder']) == sorted(terms)
    elif slug == 'hidden-word-trail':
        used = set()
        for answer in r['answers']:
            path = list(map(tuple, answer['path']))
            assert len(set(path)) == len(path)
            assert ''.join(r['grid'][x][y] for x, y in path) == answer['word']
            assert all(max(abs(x-u), abs(y-v)) == 1 for (x, y), (u, v) in zip(path, path[1:]))
            assert not used & set(path)
            used.update(path)
        assert used == {(x, y) for x, row in enumerate(r['grid']) for y in range(len(row))}
    elif slug == 'letter-circuit':
        side_of = {char: i for i, side in enumerate(r['sides']) for char in side}
        assert len(side_of) == 12 and all(len(side) == 3 for side in r['sides'])
        for word in r['acceptedWords']:
            assert len(word) >= r['minimumWordLength']
            assert all(side_of[a] != side_of[b] for a, b in zip(word, word[1:]))
        words = r['referenceChain']
        assert all(w in r['acceptedWords'] for w in words)
        assert all(a[-1] == b[0] for a, b in zip(words, words[1:]))
        assert set(''.join(words)) == set(side_of)
        assert circuit_optimum(r) == r['optimumWordCountWithinFixtureLexicon']
    elif slug == 'daily-crossword':
        covered = Counter()
        for entry in r['entries']:
            assert len(entry['answer']) == entry['enumeration'] == len(entry['cells'])
            assert ''.join(r['solutionGrid'][x][y] for x, y in entry['cells']) == entry['answer']
            cells = list(map(tuple, entry['cells']))
            axis = (0, 1) if entry['direction'] == 'across' else (1, 0)
            assert all((b[0]-a[0], b[1]-a[1]) == axis for a, b in zip(cells, cells[1:]))
            covered.update(cells)
        assert len(covered) == 16 and all(n == 2 for n in covered.values())
    else:
        replay_board(r)

count = 0
for slug in SLUGS:
    document = json.loads((ROOT / 'content' / (slug + '.json')).read_text())
    assert document['gameId'] == slug and document['locale'] == 'en-GB'
    assert len(document['rounds']) >= (1 if slug == 'shared-word-board' else 2)
    for round_data in document['rounds']:
        try:
            validate(slug, round_data)
        except Exception as error:
            raise AssertionError(f'{slug}/{round_data["id"]}: {error}') from error
        count += 1
    print(f'PASS {slug}: {len(document["rounds"])} rounds')
print(f'PASS {count} complete demo rounds. Structural checks do not certify editorial fairness or public readiness.')
