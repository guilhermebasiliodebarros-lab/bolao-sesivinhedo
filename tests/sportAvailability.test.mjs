import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSportAvailable } from '../src/utils/sportAvailability.js'
import { schoolClassPlan } from '../src/utils/schoolClasses.js'

test('RPG and FIFA are unavailable in both shifts and in the combined list', () => {
  for (const name of ['RPG', 'FIFA', ' rpg ', 'fifa']) {
    for (const turno of ['', 'manha', 'tarde']) {
      assert.equal(isSportAvailable(name, turno), false)
      assert.equal(isSportAvailable({ nome: name }, turno), false)
      assert.equal(isSportAvailable({ esporteNome: name, nome: '9º A' }, turno), false)
    }
    assert.deepEqual(schoolClassPlan({ id: name, nome: name }), [])
  }
})

test('Mancala remains available in the morning and the combined list, with only morning school teams', () => {
  assert.equal(isSportAvailable('Mancala'), true)
  assert.equal(isSportAvailable('Mancala', 'manha'), true)
  assert.equal(isSportAvailable('Mancala', 'tarde'), false)
  const plan = schoolClassPlan({ id: 'mancala', nome: 'Mancala' })
  assert.equal(plan.length, 8)
  assert(plan.every((item) => item.data.turno === 'manha'))
})

test('other sports and their existing school shifts remain available', () => {
  for (const nome of ['Futsal', 'Vôlei', 'Basquete', 'Handebol', 'Futmesa', 'Tênis de Mesa', 'Xadrez', 'Outra modalidade']) {
    for (const turno of ['', 'manha', 'tarde']) assert.equal(isSportAvailable({ nome }, turno), true)
    assert.equal(schoolClassPlan({ id: nome, nome }).length, 14)
  }
})
