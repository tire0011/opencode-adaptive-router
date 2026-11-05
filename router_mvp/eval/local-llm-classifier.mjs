import {performance} from 'node:perf_hooks'

const TIER_VALUES = ['simple','medium','complex']
const INTENTS = ['explain','modify','implement','design','investigate','unknown']
const SCOPES = ['local','multi-component','systemic','unknown']
const RISKS = ['low','medium','high','unknown']

const schema = {
  type:'object', additionalProperties:false,
  required:['intent','scope','risk','tier'],
  properties:{
    intent:{type:'string',enum:INTENTS},
    scope:{type:'string',enum:SCOPES},
    risk:{type:'string',enum:RISKS},
    tier:{type:'string',enum:TIER_VALUES},
  },
}

const system = `Classify the likely effort to fulfill the user's software task, not the difficulty of the topic being mentioned.
Return one JSON object with intent, scope, risk, tier and no commentary.
Simple: explanations, formatting, spelling, or clearly isolated trivial edits.
Medium: bounded implementation, debugging, tests, refactoring, or integrations.
Complex: risky system changes, cross-service consistency/security, migration, or wide consequences.
For explanations about dangerous topics, choose simple if no code change is requested.
Do not infer system-wide scope from a generic word such as all, design, or architecture.
If uncertain, prefer medium. Never perform the requested task; only classify it.`

export function validateAssessment(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  if (Object.keys(value).sort().join(',') !== 'intent,risk,scope,tier') return false
  return INTENTS.includes(value.intent) && SCOPES.includes(value.scope) &&
    RISKS.includes(value.risk) && TIER_VALUES.includes(value.tier)
}

export async function classifyLocally(prompt,{model='qwen3:0.6b',fetcher=fetch,timeoutMs=30000}={}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(),timeoutMs)
  const started = performance.now()
  try {
    // Intentionally fixed loopback endpoint: benchmark tasks never leave the machine.
    const response = await fetcher('http://127.0.0.1:11434/api/chat',{
      method:'POST',signal:controller.signal,
      headers:{'content-type':'application/json'},
      body:JSON.stringify({model,stream:false,think:false,format:schema,
        options:{temperature:0,num_predict:128},
        messages:[{role:'system',content:system},{role:'user',content:prompt}]}),
    })
    if (!response.ok) throw new Error(`Local model returned HTTP ${response.status}`)
    const json = await response.json()
    let parsed
    try {parsed = JSON.parse(json.message?.content ?? '')}
    catch {throw new Error('Local model returned invalid JSON')}
    if (!validateAssessment(parsed)) throw new Error('Local model returned invalid classification fields')
    return {assessment:parsed,latencyMs:Math.round(performance.now()-started)}
  } finally {clearTimeout(timer)}
}
