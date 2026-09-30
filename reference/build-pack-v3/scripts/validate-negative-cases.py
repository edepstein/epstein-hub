#!/usr/bin/env python3
"""Demonstrate that five deliberately corrupt demo fixtures are rejected."""
import copy
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('alternative_checks', ROOT / 'scripts/validate-alternative-fixtures.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def original(slug):
    return copy.deepcopy(json.loads((ROOT / 'content' / (slug + '.json')).read_text())['rounds'][0])

cases = []
r = original('word-ladder'); r['solution']['optimalMoves'] += 1
cases.append(('incorrect ladder minimum', 'word-ladder', r))
r = original('anagram-relay'); r['solution']['acceptedChains'][0][1] = 'ALERT'
cases.append(('old exchange-one relay under add-one rules', 'anagram-relay', r))
r = original('shrinking-staircase'); r['solution']['acceptedChains'][0][1] = 'TUNE'
cases.append(('new letter introduced while shrinking', 'shrinking-staircase', r))
r = original('word-weave'); r['solution']['acceptedGrids'][0]['b'] = 'BOAT'
cases.append(('inconsistent weave crossing', 'word-weave', r))
r = original('phrase-repair'); r['solution']['minimumAdjacentSwaps'] += 1
cases.append(('incorrect adjacent-swap minimum', 'phrase-repair', r))

for label, slug, fixture in cases:
    try:
        module.validate_round(slug, fixture)
    except (ValueError, AssertionError):
        print('PASS rejected:', label)
    else:
        raise AssertionError('Broken fixture was accepted: ' + label)
print('PASS all five deliberately broken fixtures rejected. No production-engine claim.')
