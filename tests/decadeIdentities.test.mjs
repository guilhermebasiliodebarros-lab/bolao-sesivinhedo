import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLASS_DECADE_IDENTITIES, DECADE_STYLES, NEUTRAL_DECADE_IDENTITY, classDecadeIdentity, decadeTeamStyle, matchDecadeIdentities } from '../src/utils/decadeIdentities.js'
import { SCHOOL_CLASSES } from '../src/utils/schoolClasses.js'
import { scorePresentation } from '../src/utils/scorePresentation.js'

test('all fourteen classes receive exactly the requested decade, color and school shift', () => {
  const expected = [
    ['6º A', 70, 'gold', 'tarde'], ['6º B', 60, 'orange', 'tarde'],
    ['7º A', 50, 'red', 'tarde'], ['7º B', 90, 'olive', 'tarde'],
    ['8º A', 80, 'blue', 'tarde'], ['8º B', 2000, 'pink', 'tarde'],
    ['9º A', 60, 'orange', 'manha'], ['9º B', 70, 'ink', 'manha'],
    ['1º A', 20, 'gold', 'manha'], ['1º B', 50, 'red', 'manha'],
    ['2º A', 90, 'olive', 'manha'], ['2º B', 80, 'blue', 'manha'],
    ['3º A', 2000, 'pink', 'manha'], ['3º B', 40, 'purple', 'manha'],
  ]
  assert.equal(Object.keys(CLASS_DECADE_IDENTITIES).length, SCHOOL_CLASSES.length)
  for (const [name, decade, palette, shift] of expected) {
    const identity = classDecadeIdentity(name)
    assert.deepEqual([identity.className, identity.decade, identity.palette, identity.shift, identity.known], [name, decade, palette, shift, true])
    assert(Object.isFrozen(identity))
  }
})

test('each of the eight periods has a distinct visual motif while black and gold share the 70s style', () => {
  assert.equal(new Set(Object.values(DECADE_STYLES).map((value) => value.motif)).size, 8)
  const gold = classDecadeIdentity('6º A'), black = classDecadeIdentity('9º B')
  assert.equal(gold.decade, black.decade)
  assert.equal(gold.motif, black.motif)
  assert.notEqual(gold.background, black.background)
  assert.notEqual(gold.accent, black.accent)
  assert.equal(black.color, 'Preto')
})

test('legacy names, explicit class metadata and automatic school IDs resolve consistently', () => {
  for (const name of ['9A', '9ºA', '9º ano A', 'Turma 9 A', '9° A']) assert.equal(classDecadeIdentity(name).code, '9-a')
  const result = matchDecadeIdentities({ timeA: 'Equipe da manhã', turmaA: '3º ano B', timeB: '8B' })
  assert.equal(result.A.decade, 40)
  assert.equal(result.B.decade, 2000)
  assert.equal(matchDecadeIdentities({ timeA: 'Equipe azul', teamIdA: 'school_volei_2-b' }).A.decade, 80)
  assert.equal(matchDecadeIdentities({ timeA: '9º A', turmaA: '9º B' }).A.palette, 'ink')
})

test('unresolved qualifiers and unknown teams stay neutral rather than borrowing another class identity', () => {
  for (const name of ['', 'A definir', 'Equipe azul', 'Vencedor 9º A', '4º A']) assert.equal(classDecadeIdentity(name), NEUTRAL_DECADE_IDENTITY)
  const result = matchDecadeIdentities({ timeA: '9º A', turmaA: '9º A', seedLabelA: 'Vencedor da semifinal', timeB: '7º B' })
  assert.equal(result.A.known, false)
  assert.equal(result.B.decade, 90)
})

test('swapping the teams swaps their identities symmetrically and never changes scores, events or clock data', () => {
  const game = { timeA: '1º A', timeB: '3º B', liveScoreA: 21, liveScoreB: 18, status: 'encerrado', liveStatus: 'live', esporteNome: 'Vôlei', scoringMode: 'sets', volleyballBestOf: 3, currentSet: { a: 21, b: 18 }, clock: { elapsedMs: 90000 }, liveEvents: [{ id: 'event', side: 'A' }] }
  const before = structuredClone(game), score = scorePresentation(game)
  const identity = matchDecadeIdentities(game)
  const swapped = matchDecadeIdentities({ ...game, timeA: game.timeB, timeB: game.timeA })
  assert.deepEqual(identity.A, swapped.B)
  assert.deepEqual(identity.B, swapped.A)
  assert.deepEqual(decadeTeamStyle(identity.A), decadeTeamStyle(swapped.B))
  assert.deepEqual(game, before)
  assert.deepEqual(scorePresentation(game), score)
})
