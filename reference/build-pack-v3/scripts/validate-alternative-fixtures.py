#!/usr/bin/env python3
"""Mechanical original-demo checks. Does not establish editorial or release approval."""
from pathlib import Path
import json
from collections import Counter, deque
ROOT=Path(__file__).resolve().parents[1]
SLUGS=['word-ladder','clue-pairs','cryptic-workshop','word-fragments','missing-links','definition-detective','word-weave','shrinking-staircase','anagram-relay','phrase-repair']
def require(condition, message):
    if not condition: raise ValueError(message)
def same_step(x,y):return len(x)==len(y) and sum(a!=b for a,b in zip(x,y))==1
def validate_round(slug,r):
    b,s=r['board'],r['solution']; label=f"{slug}/{r['id']}"
    def check(c,m):require(c,label+': '+m)
    check(r['status']=='demo','must remain demo pending editorial approval')
    check(bool(r['hints']) and bool(r['explanation']),'hints and explanation required')
    check(bool(r['rulesVersion']) and bool(r['dictionaryVersion']),'version metadata required')
    if slug=='word-ladder':
        words=b['roundDictionary'];dist={b['start']:0};q=deque([b['start']])
        check(len(words)==len(set(words)),'duplicate dictionary entries')
        check(all(len(x)==len(b['start']) for x in words),'dictionary word length')
        while q:
            x=q.popleft()
            for y in words:
                if y not in dist and same_step(x,y):dist[y]=dist[x]+1;q.append(y)
        check(dist.get(b['target'])==s['optimalMoves'],'BFS optimal distance')
        path=s['examplePath'];check(path[0]==b['start'] and path[-1]==b['target'],'route endpoints')
        check(all(x in words for x in path),'route membership')
        check(all(same_step(x,y) for x,y in zip(path,path[1:])),'route edge')
        check(len(path)-1==s['optimalMoves'],'example shortest distance')
    elif slug=='clue-pairs':
        for c in b['cards']:
            check(len(c['clues'])==2,'two definitions required')
            check(all(len(x)==c['length'] and x.isalpha() for x in s['acceptedAnswers'][c['id']]),'enumeration/spelling')
    elif slug=='cryptic-workshop':
        for c in b['clues']:
            answer=s['answers'][c['id']][0];parse=s['parses'][c['id']]
            check(len(answer)==c['length'],'enumeration')
            check(parse['operation']==c['mechanism'],'mechanism label')
            if parse['operation']=='anagram':check(Counter(answer)==Counter(parse['fodder']),'anagram fodder')
            elif parse['operation']=='reversal':check(answer==parse['fodder'][::-1],'reversal fodder')
            elif parse['operation']=='hidden':check(parse['fodder'][parse['start']:parse['start']+len(answer)]==answer,'hidden substring')
            elif parse['operation']=='homophone':check(bool(parse.get('pronunciationNote')),'homophone requires human pronunciation review')
            else:check(False,'unknown mechanism')
    elif slug=='word-fragments':
        tiles={t['id']:t['text'] for t in b['tiles']};check(len(tiles)==len(b['tiles']),'unique tile IDs')
        for allocation in s['allocations']:
            used=[]
            for lane in b['lanes']:
                ids=allocation[lane['id']];check(all(t in tiles for t in ids),'unknown tile')
                answer=''.join(tiles[t] for t in ids);used+=ids
                check(answer in s['acceptedAnswers'][lane['id']] and len(answer)==lane['length'],'assembled answer')
            check(Counter(used)==Counter(tiles.keys()),'each tile consumed once')
    elif slug=='missing-links':
        for link in s['acceptedLinks']:
            check(len(link)==b['linkLength'],'link enumeration')
            for branch in b['branches']:check(branch['prefix']+link+branch['suffix']==s['compounds'][branch['id']],'compound substitution')
        check(all(len(x)==b['linkLength'] for x in b['candidates']),'candidate length')
        check(len(b['candidates'])==len(set(b['candidates'])),'candidate uniqueness')
    elif slug=='definition-detective':
        for c in b['cases']:
            answer=s['answers'][c['id']]
            check(len(c['definitions'])==4 and len(c['evidence'])>=3,'choice counts')
            check(answer['definitionId'] in [x['id'] for x in c['definitions']],'definition ID')
            check(answer['evidenceId'] in [x['id'] for x in c['evidence']],'evidence ID')
            check(all(x['text'] in c['sentence'] for x in c['evidence']),'exact evidence span')
    elif slug=='word-weave':
        for grid in s['acceptedGrids']:
            cells={};members={};expected=set()
            for lane in b['lanes']:
                word=grid[lane['id']];check(len(word)==lane['length'],'lane enumeration');coords=[]
                for i,ch in enumerate(word):
                    coord=(lane['row']+(i if lane['direction']=='down' else 0),lane['col']+(i if lane['direction']=='across' else 0))
                    check(0<=coord[0]<b['rows'] and 0<=coord[1]<b['cols'],'cell bounds')
                    check(coord not in cells or cells[coord]==ch,'crossing consistency')
                    cells[coord]=ch;members.setdefault(coord,[]).append(lane['id']);coords.append(coord)
                expected.add(tuple(coords))
            actual=set()
            for dr,dc in [(0,1),(1,0)]:
                for cell in cells:
                    if (cell[0]-dr,cell[1]-dc) in cells:continue
                    run=[];pos=cell
                    while pos in cells:run.append(pos);pos=(pos[0]+dr,pos[1]+dc)
                    if len(run)>1:actual.add(tuple(run))
            check(actual==expected,'uncued or malformed maximal grid run')
            graph={l['id']:set() for l in b['lanes']}
            for ids in members.values():
                for a in ids:graph[a].update(set(ids)-{a})
            seen=set();queue=[next(iter(graph))]
            while queue:
                x=queue.pop()
                if x not in seen:seen.add(x);queue.extend(graph[x]-seen)
            check(len(seen)==len(graph),'disconnected lanes')
    elif slug=='shrinking-staircase':
        for chain in s['acceptedChains']:
            check(chain[0]==b['start'] and len(chain)==len(b['rungs'])+1,'chain endpoints/count')
            for idx,(x,y) in enumerate(zip(chain,chain[1:])):
                check(len(x)-len(y)==1 and sum((Counter(x)-Counter(y)).values())==1 and not(Counter(y)-Counter(x)),'one removed occurrence, no additions')
                check(len(y)==b['rungs'][idx]['length'],'rung enumeration')
    elif slug=='anagram-relay':
        for chain in s['acceptedChains']:
            check(chain[0]==b['start'] and len(chain)==len(b['stages'])+1,'chain endpoints/count')
            for idx,(x,y) in enumerate(zip(chain,chain[1:])):
                minus=Counter(x)-Counter(y);plus=Counter(y)-Counter(x)
                check(len(y)==len(x)+1 and not minus and sum(plus.values())==1,'all previous letters plus exactly one added occurrence')
                check(next(iter(plus))==s['addedLetters'][idx],'computed added letter')
                check(len(y)==b['stages'][idx]['length'],'stage enumeration')
    elif slug=='phrase-repair':
        source=[t['text'] for t in b['tokens']]
        check(len({t['id'] for t in b['tokens']})==len(source),'unique tile IDs')
        distances=[]
        for target in s['acceptedTargets']:
            check(Counter(source)==Counter(target),'source/target token multisets')
            check([len(x) for x in target]==b['enumeration'],'target enumeration')
            # Stable occurrence matching yields minimum adjacent swaps with duplicate tokens.
            positions={}
            for i,x in enumerate(target):positions.setdefault(x,deque()).append(i)
            seq=[positions[x].popleft() for x in source]
            distances.append(sum(seq[i]>seq[j] for i in range(len(seq)) for j in range(i+1,len(seq))))
        check(min(distances)==s['minimumAdjacentSwaps'],'minimal adjacent-swap distance')
    return 1

def main():
    total=0
    for slug in SLUGS:
        data=json.loads((ROOT/'content'/f'{slug}.json').read_text())
        require(data['gameId']==slug,slug+': gameId mismatch')
        require(len(data['rounds'])>=2,slug+': needs two demo rounds')
        require(len({r['id'] for r in data['rounds']})==len(data['rounds']),slug+': round IDs')
        for r in data['rounds']:total+=validate_round(slug,r)
        print('PASS',slug,len(data['rounds']),'rounds')
    print(f'PASS {total} rounds across {len(SLUGS)} alternative games.')
    print('Limits: dictionary licensing/membership, clue fairness, semantic alternatives, homophones, user enjoyment and application behaviour require separate checks.')
if __name__=='__main__':main()
