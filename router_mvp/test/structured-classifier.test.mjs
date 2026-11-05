import {test} from 'node:test'
import assert from 'node:assert/strict'
import {assessTask} from '../src/structured-classifier.mjs'

test('assessment separates intent, scope and risk', () => {
  assert.deepEqual(Object.fromEntries(['intent','scope','risk','tier'].map(key =>
    [key,assessTask('Design a distributed authentication system across services')[key]])),
    {intent:'design',scope:'systemic',risk:'high',tier:'complex'})
  assert.equal(assessTask('Explain distributed systems briefly').tier,'simple')
  assert.equal(assessTask('Fix the typo in all project files').tier,'simple')
  assert.equal(assessTask('Change authentication in one function').tier,'complex')
  assert.equal(assessTask('Implement a small parser').tier,'medium')
})

test('unknown prompts receive conservative classification', () => {
  const result=assessTask('xyzzy plugh')
  assert.deepEqual([result.intent,result.scope,result.risk,result.tier,result.confidence],
    ['unknown','unknown','unknown','medium',0])
})

test('Unicode words do not match partial fragments', () => {
  assert.equal(assessTask('Überarchitektur ist ein ungewöhnliches Wort').tier,'medium')
  assert.equal(assessTask('Korrigiere einen Tippfehler im Kommentar').tier,'simple')
})
