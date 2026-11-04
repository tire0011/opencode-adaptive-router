import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyTask } from '../src/classifier.mjs'
import { selectModel } from '../src/selector.mjs'

test('classifies simple, medium and complex work locally', () => {
  assert.equal(classifyTask('fix typo rename variable').tier, 'simple')
  assert.equal(classifyTask('implement feature add endpoint tests').tier, 'medium')
  assert.equal(classifyTask('design distributed system architecture across services').tier, 'complex')
})
test('unrecognized prompts use a conservative medium fallback', () => {
  assert.deepEqual(classifyTask(''), {tier:'medium',confidence:0,source:'fallback'})
  assert.equal(classifyTask('xyzzy plugh').source, 'fallback')
})
test('recognizes common short prompts without a fallback', () => {
  for (const prompt of ['Reply with exactly OK. Do not use tools.', 'Korrigiere den Tippfehler im Kommentar.']) {
    const result = classifyTask(prompt)
    assert.equal(result.tier, 'simple')
    assert.equal(result.source, 'signals')
    assert.ok(result.confidence > 0)
  }
  assert.equal(classifyTask('Implement a REST API with unit tests.').tier, 'medium')
  assert.equal(classifyTask('Redesign database schema across multiple services.').tier, 'complex')
})
test('system-wide scope takes priority over a trivial keyword', () => {
  assert.equal(classifyTask('Fix a typo across services in a distributed system.').tier, 'complex')
})
test('tier routing excludes no-tool models at all complexity levels', () => {
  const models = [
    {providerID:'mock',id:'notools',capabilities:{tools:false},cost:[{input:.01,output:.01}]},
    ...[['ultra',.25],['cheap',1],['pricey',10]].map(([id,price]) => ({providerID:'mock',id,cost:[{input:price,output:price}],capabilities:{tools:true}})),
  ]
  assert.equal(selectModel(models,{currentProvider:'mock',taskTier:'simple'}).id,'ultra')
  assert.equal(selectModel(models,{currentProvider:'mock',taskTier:'medium'}).id,'cheap')
  assert.equal(selectModel(models,{currentProvider:'mock',taskTier:'complex'}).id,'pricey')
})
test('umlauts at word start are matched', () => {
  assert.equal(classifyTask('Refaktoriere übergreifend für alle Projekte').tier, 'complex')
  assert.equal(classifyTask('Übergreifende Neugestaltung der Datenbank').tier, 'complex')
})
test('single topic words do not decide the tier', () => {
  assert.equal(classifyTask('Fix typo in the architecture section of the README').tier, 'simple')
  assert.notEqual(classifyTask('Update the README').source, 'signals')
})
