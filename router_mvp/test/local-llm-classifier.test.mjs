import {test} from 'node:test'
import assert from 'node:assert/strict'
import {classifyLocally,validateAssessment} from '../eval/local-llm-classifier.mjs'

const valid = {intent:'implement',scope:'local',risk:'medium',tier:'medium'}
test('strict assessment schema rejects unexpected fields', () => {
  assert.equal(validateAssessment(valid),true)
  assert.equal(validateAssessment({...valid,secret:'value'}),false)
  assert.equal(validateAssessment({...valid,tier:'expensive'}),false)
})
test('benchmark only calls a loopback API and returns timings', async () => {
  let request
  const fetcher = async (url,init) => {
    request = {url,body:JSON.parse(init.body)}
    return {ok:true,json:async()=>({message:{content:JSON.stringify(valid)}})}
  }
  const result = await classifyLocally('Implement an endpoint',{fetcher})
  assert.equal(request.url,'http://127.0.0.1:11434/api/chat')
  assert.equal(request.body.stream,false)
  assert.equal(request.body.think,false)
  assert.equal(result.assessment.tier,'medium')
  assert.ok(Number.isInteger(result.latencyMs))
})
test('invalid responses fail closed in benchmark evaluation', async () => {
  const fetcher = async()=>({ok:true,json:async()=>({message:{content:'not json'}})})
  await assert.rejects(classifyLocally('Hello',{fetcher}),/invalid JSON/)
})
