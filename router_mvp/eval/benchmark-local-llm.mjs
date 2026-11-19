import {classifyLocally} from './local-llm-classifier.mjs'
import {classifyTask} from '../src/classifier.mjs'
import {assessTask} from '../src/structured-classifier.mjs'
import {cases} from './unseen-task-cases.mjs'

const modelArg = process.argv.find(arg => arg.startsWith('--model='))
const model = modelArg ? modelArg.slice('--model='.length) : 'qwen3:0.6b'
if (!/^[\w.:-]{1,80}$/.test(model)) throw new Error('Invalid local model name')
try {
  const response = await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(5000)})
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const tags = await response.json()
  if (!tags.models?.some(item => item.name === model))
    throw new Error(`Model ${model} is not installed; run: ollama pull ${model}`)
} catch(error) {
  console.error(`Local Ollama check failed: ${error instanceof Error?error.message:'Unknown error'}`)
  process.exit(1)
}
const rows = Object.entries(cases).flatMap(([expected,prompts]) => prompts.map(prompt => ({expected,prompt})))
const results=[]
for (const [index,row] of rows.entries()) {
  try {
    const result = await classifyLocally(row.prompt,{model})
    results.push({...row,old:classifyTask(row.prompt).tier,structured:assessTask(row.prompt).tier,
      llm:result.assessment.tier,latencyMs:result.latencyMs})
    console.log(`${index+1}/${rows.length}: ${result.assessment.tier} (${result.latencyMs} ms)`)
  } catch(error) {
    results.push({...row,llm:null,error:error instanceof Error?error.message:'Unknown failure'})
    console.warn(`${index+1}/${rows.length}: unavailable (${results.at(-1).error})`)
  }
}

const valid = results.filter(row => row.llm)
const misses = (field,subset=valid) => subset.filter(row => row[field] !== row.expected).length
const timings = valid.map(row => row.latencyMs).sort((a,b) => a-b)
const p50 = timings.length ? timings[Math.floor((timings.length-1)*0.5)] : null
const p95 = timings.length ? timings[Math.floor((timings.length-1)*0.95)] : null
const summary={model,total:rows.length,valid:valid.length,
  correct:valid.length-misses('llm'),baselineCorrect:valid.length-misses('old'),
  structuredCorrect:valid.length-misses('structured'),p50Ms:p50,p95Ms:p95}
console.log(JSON.stringify(summary,null,2))
if (process.argv.includes('--json')) console.log(JSON.stringify({summary,results},null,2))
if (valid.length !== rows.length) process.exitCode = 1
