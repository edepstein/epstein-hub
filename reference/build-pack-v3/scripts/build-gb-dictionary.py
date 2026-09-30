#!/usr/bin/env python3
"""Reproduce the bundled ESDB GB candidate list. Never marks words editorially approved."""
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REVISION = '1e5b7d3a72f47a71da5d28686c1dd4b397178485'
REPOSITORY = 'https://github.com/en-wl/wordlist.git'

def main():
    destination = Path(sys.argv[1] if len(sys.argv) > 1 else 'dictionaries-rebuilt').resolve()
    destination.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='wordclub-esdb-') as temp:
        source = Path(temp) / 'source'
        subprocess.run(['git', 'clone', '--branch', 'v2', REPOSITORY, str(source)], check=True)
        subprocess.run(['git', 'checkout', REVISION], cwd=source, check=True)
        with (destination / 'upstream-build.log').open('w') as log:
            subprocess.run(['make'], cwd=source, stdout=log, stderr=subprocess.STDOUT, check=True)
        result = subprocess.run(['./scowl', 'word-list', '60', 'B,Z', '5', '--wo-poses=abbr', '--categories='],
                                cwd=source, capture_output=True, text=True, check=True)
        (destination / 'upstream-export.log').write_text(result.stderr)
        words = sorted({w.upper() for w in result.stdout.splitlines() if re.fullmatch(r'[a-z]{2,24}', w)})
        output = destination / 'gb-candidate-words.txt'
        output.write_text('\n'.join(words) + '\n')
        shutil.copy(source / 'Copyright', destination / 'ESDB-Copyright.txt')
        print(json.dumps({'revision': REVISION, 'wordCount': len(words),
                          'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                          'editoriallyApproved': False}, indent=2))

if __name__ == '__main__':
    main()
