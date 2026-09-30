#!/usr/bin/env python3
"""Check this reference pack's integrity, not production app readiness."""
from pathlib import Path
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []
def require(condition, message):
    if not condition:
        errors.append(message)

catalogue = json.loads((ROOT / 'catalogue.json').read_text())['games']
require(len(catalogue) == 19, 'Expected 19 specified games')
rounds = 0
for game in catalogue:
    for key in ('brief', 'fixtures', 'ui'):
        require((ROOT / game[key]).is_file(), f'Missing {key}: {game[key]}')
    brief = ROOT / game['brief']
    if brief.is_file():
        text = brief.read_text()
        require(len(text.split()) >= 600, f'Brief too thin: {brief.name}')
    path = ROOT / game['fixtures']
    if path.is_file():
        data = json.loads(path.read_text())
        require(data.get('gameId') == game['id'], f'Wrong gameId: {path.name}')
        rs = data.get('rounds', [])
        require(len(rs) >= (1 if game['id'] == 'shared-word-board' else 2), f'Too few complete examples: {path.name}')
        ids = [r.get('id') for r in rs]
        require(len(set(ids)) == len(ids) and None not in ids, f'Invalid round IDs: {path.name}')
        for r in rs:
            require(r.get('status') == 'demo', f'Round incorrectly claims publication: {path.name}/{r.get("id")}')
            require(r.get('rulesVersion') and r.get('dictionaryVersion'), f'Unversioned round: {path.name}')
            require(r.get('hints') is not None and r.get('explanation'), f'Missing hints/explanation: {path.name}/{r.get("id")}')
        rounds += len(rs)

manifest = json.loads((ROOT / 'dictionaries/source-manifest.json').read_text())
dictionary = ROOT / 'dictionaries/gb-candidate-words.txt'
words = dictionary.read_text().splitlines()
require(words == sorted(set(words)), 'Dictionary not sorted/unique')
require(all(re.fullmatch('[A-Z]{2,24}', w) for w in words), 'Invalid candidate spelling token')
require(len(words) == manifest['wordCount'], 'Dictionary count mismatch')
require(hashlib.sha256(dictionary.read_bytes()).hexdigest() == manifest['sha256'], 'Dictionary hash mismatch')
require((ROOT / 'dictionaries/ESDB-Copyright.txt').stat().st_size > 100, 'Missing upstream notice')
require(manifest['editoriallyApproved'] is False, 'Candidate list must not claim editorial approval')
birthday = json.loads((ROOT / 'content/birthday-demo.json').read_text())
require(birthday['fictional'] is True and birthday['productionImportAllowed'] is False, 'Birthday demo lacks production guard')

for page in (ROOT / 'ui').glob('*.html'):
    for target in re.findall(r'(?:href|src)=["\']([^"\']+)', page.read_text()):
        if target.startswith(('http:', 'https:', '#', 'data:', 'mailto:')):
            continue
        require((page.parent / target.split('?')[0].split('#')[0]).exists(), f'Broken reference in {page.name}: {target}')

result = {'games': len(catalogue), 'roundsOrTurnFixtures': rounds, 'candidateWords': len(words),
          'htmlScreens': len(list((ROOT / 'ui').glob('*.html'))), 'errors': errors,
          'scope': 'file integrity only; engine/semantic/browser/app release gates are separate'}
print(json.dumps(result, indent=2))
sys.exit(1 if errors else 0)
