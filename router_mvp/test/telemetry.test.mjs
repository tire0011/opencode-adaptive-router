import {test} from 'node:test'
import assert from 'node:assert/strict'
import {recordTransport} from '../src/telemetry.mjs'

const model = {providerID:'mock',id:'cheap'}
test('records transport counts without text or URLs', () => {
  let stats = recordTransport({}, model, 200, 50)
  stats = recordTransport(stats, model, 503, 120)
  assert.deepEqual(stats['mock/cheap'], {responses:2,httpErrors:1,latencySumMs:170})
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
