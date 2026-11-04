import {test} from 'node:test'
import assert from 'node:assert/strict'
import {recordTransport} from '../src/telemetry.mjs'
import {selectModel} from '../src/selector.mjs'

const model = {providerID:'mock',id:'cheap'}
test('records transport counts without text or URLs', () => {
  let stats = recordTransport({}, model, 200, 50, 100)
  stats = recordTransport(stats, model, 503, 120, 200)
  assert.deepEqual(stats['mock/cheap'], {responses:2,httpErrors:1,latencySumMs:170,lastErrorAt:200})
  assert.deepEqual(Object.keys(stats), ['mock/cheap'])
})
test('ignores invalid statuses and bounds huge durations', () => {
  assert.deepEqual(recordTransport({},model,0,50), {})
  assert.equal(recordTransport({},model,200,Infinity)['mock/cheap'].latencySumMs,0)
  assert.equal(recordTransport({},model,200,2000000)['mock/cheap'].latencySumMs,600000)
})
test('saturates record count', () => {
  const stats = {'mock/cheap':{responses:100000,httpErrors:0,latencySumMs:0}}
  assert.strictEqual(recordTransport(stats,model,200,1),stats)
})
test('repeated model HTTP failures trigger a healthy-model fallback', () => {
  const models = [['sick',1],['healthy',2]].map(([id,n])=>({providerID:'mock',id,cost:[{input:n,output:n}],capabilities:{tools:true}}))
  let stats={}
  for(let i=0;i<3;i++) stats=recordTransport(stats,{providerID:'mock',id:'sick'},503,30)
  assert.equal(selectModel(models,{currentProvider:'mock',transportStats:stats}).id,'healthy')
  assert.equal(selectModel(models,{currentProvider:'mock',transportStats:{'mock/sick':{responses:1,httpErrors:1,lastErrorAt:Date.now()}}}).id,'sick')
  const expired={'mock/sick':{responses:3,httpErrors:3,lastErrorAt:Date.now()-360000}}
  assert.equal(selectModel(models,{currentProvider:'mock',transportStats:expired}).id,'sick')
})
test('unpriced configured profile fails over only within approved models and recovers', () => {
  const models = ['small','mid','large'].map(id => ({
    providerID:'local', id, capabilities:{tools:true}, enabled:true,
  }))
  const options = {
    currentProvider:'local', taskTier:'simple',
    modelProfiles:{'local/small':'simple','local/mid':'medium','local/large':'complex'},
    allowedModels:models.map(model => `${model.providerID}/${model.id}`),
  }
  const first = selectModel(models, options)
  assert.equal(first.id, 'small')
  let stats = {}
  for (let i=0;i<3;i++) stats = recordTransport(stats, first, 503, 10)
  assert.equal(selectModel(models, {...options,transportStats:stats}).id, 'mid')
  const second = models[1]
  for (let i=0;i<3;i++) stats = recordTransport(stats, second, 429, 10)
  assert.equal(selectModel(models, {...options,transportStats:stats}).id, 'large')
  const expired = Object.fromEntries(Object.entries(stats).map(([id, value]) =>
    [id, {...value,lastErrorAt:Date.now()-360000}]))
  assert.equal(selectModel(models, {...options,transportStats:expired}).id, first.id)
})
