import {test} from 'node:test'
import assert from 'node:assert/strict'
import {recordFeedback, chooseByFeedback, mergeEvidence, explore} from '../src/feedback.mjs'
import {selectModel} from '../src/selector.mjs'

const models = [['small',1],['large',10]].map(([id,n]) => ({providerID:'mock',id,cost:[{input:n,output:n}],capabilities:{tools:true}}))
const decision = (id, tier='medium') => ({tier,model:{providerID:'mock',id}})

test('manual feedback is aggregated without storing prompt text', () => {
  let stats = {}
  stats = recordFeedback(stats, decision('small'), false)
  stats = recordFeedback(stats, decision('large'), true)
  assert.deepEqual(stats['medium:mock/small'], {positive:0,negative:1})
  assert.deepEqual(stats['medium:mock/large'], {positive:1,negative:0})
  assert(!JSON.stringify(stats).includes('prompt'))
})
test('insufficient and incomplete ratings never change baseline', () => {
  let stats = {}
  for (let i=0;i<3;i++) stats = recordFeedback(stats, decision('large'), true)
  assert.equal(chooseByFeedback(models,'medium',stats),undefined)
  assert.equal(selectModel(models,{currentProvider:'mock',taskTier:'simple',feedbackStats:stats}).id,'small')
})
test('sufficient comparative feedback can override a price-based tier', () => {
  let stats = {}
  for (let i=0;i<4;i++) {
    stats = recordFeedback(stats,decision('small','simple'),false)
    stats = recordFeedback(stats,decision('large','simple'),true)
  }
  assert.equal(selectModel(models,{currentProvider:'mock',taskTier:'simple',feedbackStats:stats}).id,'large')
  assert.equal(selectModel(models,{currentProvider:'mock',taskTier:'complex',feedbackStats:stats}).id,'large')
})
test('malformed decisions cannot poison statistics', () => {
  assert.deepEqual(recordFeedback({}, {tier:'other',model:{id:'x',providerID:'p'}}, true), {})
})
test('verified test/build outcomes count as evidence', () => {
  const verification = {
    'simple:mock/small:test':{passed:0,failed:4},
    'simple:mock/large:build':{passed:4,failed:0},
  }
  assert.deepEqual(mergeEvidence({}, verification)['simple:mock/large'], {positive:4,negative:0})
  assert.equal(selectModel(models,{currentProvider:'mock',taskTier:'simple',verificationStats:verification}).id,'large')
})
test('bounded exploration lets unrated models collect ratings', () => {
  let stats = {}
  for (let i=0;i<3;i++) stats = recordFeedback(stats, decision('small','simple'), true)
  const base = {currentProvider:'mock',taskTier:'simple',feedbackStats:stats}
  assert.equal(selectModel(models,{...base,random:() => 0.05}).id,'large')
  assert.equal(selectModel(models,{...base,random:() => 0.5}).id,'small')
  assert.equal(selectModel(models,{...base,exploration:0,random:() => 0}).id,'small')
  // No exploration before the baseline itself has evidence.
  assert.equal(explore(models,'simple',{},models[0],{random:() => 0}),undefined)
})
