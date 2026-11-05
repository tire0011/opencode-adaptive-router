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
  assert.equal(classifyTask('Rename an API field used by hundreds of external clients.').tier, 'complex')
  assert.equal(classifyTask('Change a single lock that coordinates multiple processes.').tier, 'complex')
})
test('short explanations stay simple and bounded implementation stays medium', () => {
  assert.equal(classifyTask('What does HTTP 404 mean?').tier, 'simple')
  assert.equal(classifyTask('Explain the difference between let and const briefly.').tier, 'simple')
  assert.equal(classifyTask('Add optimistic concurrency checks to one update operation.').tier, 'medium')
})
test('generic scope words and documentation context do not force complex', () => {
  for (const prompt of [
    'Fix the typo in all project files',
    'Rename the variable in every service file',
    'Fix typo in the architecture section of the README',
  ]) assert.equal(classifyTask(prompt).tier,'simple',prompt)
  assert.notEqual(classifyTask('Update all project dependencies to latest patch').tier,'complex')
  assert.notEqual(classifyTask('Plan the sprint review').tier,'complex')
  assert.equal(classifyTask('Migrating the database across services').tier,'complex')
  assert.equal(classifyTask('Update protocol for all external clients').tier,'complex')
  assert.notEqual(classifyTask('Überarchitektur im Kommentar korrigieren').tier,'complex')
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
