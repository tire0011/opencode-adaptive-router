import {classifyTask} from '../src/classifier.mjs'
import {cases} from './task-cases.mjs'

const tiers = ['simple', 'medium', 'complex']
const rows = Object.entries(cases).flatMap(([expected, prompts]) =>
  prompts.map(prompt => ({expected, prompt, ...classifyTask(prompt)})))
const confusion = Object.fromEntries(tiers.map(expected => [expected,
  Object.fromEntries(tiers.map(actual => [actual, rows.filter(r => r.expected === expected && r.tier === actual).length]))]))
const count = rows.length
const correct = rows.filter(r => r.expected === r.tier).length
const fallback = rows.filter(r => r.source === 'fallback').length
const byTier = Object.fromEntries(tiers.map(tier => {
  const tp = confusion[tier][tier]
  const predicted = rows.filter(r => r.tier === tier).length
  const expected = cases[tier].length
  return [tier, {count:expected,precision:predicted ? tp / predicted : 0,recall:tp / expected}]
}))
const report = {
  count, correct, accuracy:correct / count, fallback,
  fallbackRate:fallback / count, confusion, byTier,
  misclassified:rows.filter(r => r.expected !== r.tier).map(({expected,tier,source,prompt}) => ({expected,actual:tier,source,prompt})),
}

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(report,null,2)}\n`)
} else {
  console.log(`Accuracy: ${correct}/${count} (${(report.accuracy * 100).toFixed(1)}%)`)
  console.log(`Fallback: ${fallback}/${count} (${(report.fallbackRate * 100).toFixed(1)}%)`)
  console.log('Confusion matrix (expected rows / predicted columns):')
  console.log('           simple medium complex')
  for (const tier of tiers) console.log(`${tier.padEnd(10)} ${tiers.map(t => String(confusion[tier][t]).padStart(6)).join(' ')}`)
  for (const tier of tiers) console.log(`${tier}: precision ${(byTier[tier].precision*100).toFixed(1)}%, recall ${(byTier[tier].recall*100).toFixed(1)}%`)
  console.log('\nMisclassified:')
  for (const {expected,actual,prompt} of report.misclassified) console.log(`  ${expected} -> ${actual}: ${prompt}`)
}
