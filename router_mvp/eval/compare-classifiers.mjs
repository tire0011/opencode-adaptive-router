import {classifyTask} from '../src/classifier.mjs'
import {assessTask} from '../src/structured-classifier.mjs'
import {cases as development} from './task-cases.mjs'
import {cases as holdout} from './holdout-cases.mjs'

const dataset = process.argv.includes('--holdout') ? 'holdout-synthetic' : 'development-synthetic'
const cases = dataset === 'holdout-synthetic' ? holdout : development
const rows = Object.entries(cases).flatMap(([expected,prompts]) => prompts.map(prompt => ({
  expected, prompt, old:classifyTask(prompt).tier, next:assessTask(prompt),
})))
const summarize = choose => ({
  correct:rows.filter(row => choose(row) === row.expected).length,
  total:rows.length,
  byTier:Object.fromEntries(Object.keys(cases).map(tier => {
    const matching = rows.filter(row => row.expected === tier)
    return [tier,`${matching.filter(row => choose(row) === tier).length}/${matching.length}`]
  })),
})
const condensed = rows.map(({expected,prompt,old,next}) => ({expected,prompt,old,new:next.tier,
  intent:next.intent,scope:next.scope,risk:next.risk}))
const report = {dataset,old:summarize(row => row.old),next:summarize(row => row.next.tier),
  disagreements:condensed.filter(row => row.old !== row.new)}
if (process.argv.includes('--json')) console.log(JSON.stringify(report,null,2))
else {
  console.log(`Dataset: ${dataset}`)
  console.log(`Current: ${report.old.correct}/${rows.length} (${JSON.stringify(report.old.byTier)})`)
  console.log(`Structured: ${report.next.correct}/${rows.length} (${JSON.stringify(report.next.byTier)})`)
  console.log(`Disagreements: ${report.disagreements.length}`)
}
