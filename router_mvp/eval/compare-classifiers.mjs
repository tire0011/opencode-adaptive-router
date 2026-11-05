import {classifyTask} from '../src/classifier.mjs'
import {assessTask} from '../src/structured-classifier.mjs'
import {cases as development} from './task-cases.mjs'
import {cases as holdout} from './holdout-cases.mjs'
import {cases as unseen} from './unseen-task-cases.mjs'

const dataset = process.argv.includes('--unseen') ? 'unseen-synthetic'
  : process.argv.includes('--holdout') ? 'holdout-synthetic' : 'development-synthetic'
const cases = dataset === 'unseen-synthetic' ? unseen
  : dataset === 'holdout-synthetic' ? holdout : development
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
// These are *relative penalty units*, not prices or calibrated probabilities.
// Underestimating difficult work is deliberately penalized more heavily.
const penalties = {
  simple:{simple:0,medium:1,complex:4},
  medium:{simple:3,medium:0,complex:2},
  complex:{simple:8,medium:5,complex:0},
}
const errorCosts = choose => {
  const totals = {underestimated:0,overestimated:0,weightedPenalty:0}
  const order = {simple:0,medium:1,complex:2}
  for (const row of rows) {
    const predicted = choose(row)
    totals.weightedPenalty += penalties[row.expected][predicted]
    if (order[predicted] < order[row.expected]) totals.underestimated++
    if (order[predicted] > order[row.expected]) totals.overestimated++
  }
  return totals
}
const condensed = rows.map(({expected,prompt,old,next}) => ({expected,prompt,old,new:next.tier,
  intent:next.intent,scope:next.scope,risk:next.risk}))
const report = {dataset,
  old:{...summarize(row => row.old),...errorCosts(row => row.old)},
  next:{...summarize(row => row.next.tier),...errorCosts(row => row.next.tier)},
  disagreements:condensed.filter(row => row.old !== row.new)}
if (process.argv.includes('--json')) console.log(JSON.stringify(report,null,2))
else {
  console.log(`Dataset: ${dataset}`)
  console.log(`Current: ${report.old.correct}/${rows.length} (${JSON.stringify(report.old.byTier)})`)
  console.log(`Structured: ${report.next.correct}/${rows.length} (${JSON.stringify(report.next.byTier)})`)
  console.log(`Current errors: underestimated=${report.old.underestimated}, overestimated=${report.old.overestimated}, penalty=${report.old.weightedPenalty}`)
  console.log(`Structured errors: underestimated=${report.next.underestimated}, overestimated=${report.next.overestimated}, penalty=${report.next.weightedPenalty}`)
  console.log(`Disagreements: ${report.disagreements.length}`)
}
