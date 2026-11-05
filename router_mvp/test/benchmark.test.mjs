import {test} from 'node:test'
import assert from 'node:assert/strict'
import {cases} from '../eval/task-cases.mjs'
import {cases as holdoutCases} from '../eval/holdout-cases.mjs'
import {classifyTask} from '../src/classifier.mjs'

test('benchmark has 100 unique, nonempty prompts with fixed tier counts', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(cases).map(([tier, samples]) => [tier, samples.length])),
    {simple:30, medium:40, complex:30})
  const all = Object.values(cases).flat()
  assert.equal(new Set(all.map(x => x.trim().toLowerCase())).size, 100)
  assert.ok(all.every(x => x.trim().length > 12))
})
test('holdout fixture is distinct from development examples', () => {
  assert.deepEqual(Object.values(holdoutCases).map(samples => samples.length),[10,10,10])
  const development = new Set(Object.values(cases).flat().map(x => x.toLowerCase()))
  const holdout = Object.values(holdoutCases).flat()
  assert.equal(new Set(holdout.map(x => x.toLowerCase())).size,30)
  assert.ok(holdout.every(x => !development.has(x.toLowerCase())))
})
test('development benchmark maintains a conservative minimum baseline', () => {
  const rows = Object.entries(cases).flatMap(([tier,prompts]) =>
    prompts.map(prompt => ({expected:tier,actual:classifyTask(prompt).tier})))
  const correct = rows.filter(row => row.expected === row.actual).length
  // This is a regression floor on development data, NOT independent accuracy.
  assert.ok(correct >= 80, `development classification regressed to ${correct}/100`)
  const complexRows = rows.filter(row => row.expected === 'complex')
  assert.ok(complexRows.filter(row => row.actual === 'complex').length >= 24)
})
