import {test} from 'node:test'
import assert from 'node:assert/strict'
import {cases as unseen} from '../eval/unseen-task-cases.mjs'
import {cases as development} from '../eval/task-cases.mjs'
import {cases as holdout} from '../eval/holdout-cases.mjs'
import {cases as fresh} from '../eval/fresh-task-cases.mjs'

test('unseen synthetic fixture has balanced, distinct tasks', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(unseen).map(([tier,rows]) => [tier,rows.length])),
    {simple:12,medium:12,complex:12})
  const normalize = prompt => prompt.trim().toLowerCase()
  const prior = new Set([...Object.values(development).flat(),...Object.values(holdout).flat()].map(normalize))
  const fresh = Object.values(unseen).flat().map(normalize)
  assert.equal(new Set(fresh).size,36)
  assert.ok(fresh.every(prompt => prompt.length > 20 && !prior.has(prompt)))
})

test('fresh v2 checkpoint remains distinct from previous synthetic fixtures', () => {
  assert.deepEqual(Object.values(fresh).map(rows => rows.length),[10,10,10])
  const normalize = prompt => prompt.trim().toLowerCase()
  const prior = new Set([...Object.values(development).flat(),...Object.values(holdout).flat(),
    ...Object.values(unseen).flat()].map(normalize))
  const next = Object.values(fresh).flat().map(normalize)
  assert.equal(new Set(next).size,30)
  assert.ok(next.every(prompt => !prior.has(prompt)))
})
