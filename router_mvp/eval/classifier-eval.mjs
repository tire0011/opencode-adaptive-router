import {classifyTask} from '../src/classifier.mjs'

// Independent phrasing from the embedded training sentences; this is a tiny
// smoke benchmark, NOT evidence of general model-selection accuracy.
const samples = [
  ['simple','Please rename this local constant.'],
  ['simple','Correct a spelling mistake in a comment.'],
  ['simple','Ändere die Beschriftung eines Buttons.'],
  ['simple','Format this short source file.'],
  ['medium','Implement a small REST API with validation.'],
  ['medium','Fix a broken JSON parser and introduce unit tests.'],
  ['medium','Refactor the service method and add error handling.'],
  ['medium','Ergänze einen Endpunkt und teste die Funktion.'],
  ['complex','Design an architecture for several interacting services.'],
  ['complex','Analyze concurrency bugs and deadlocks in our distributed cache.'],
  ['complex','Plan a database migration affecting hundreds of components.'],
  ['complex','Entwirf ein Sicherheitskonzept für verteilte Systeme.'],
]

const counts = {simple:{},medium:{},complex:{}}
for (const [expected,prompt] of samples) {
  const {tier,confidence} = classifyTask(prompt)
  counts[expected][tier] = (counts[expected][tier] ?? 0) + 1
  console.log(`${expected.padEnd(8)} → ${tier.padEnd(8)} (${confidence.toFixed(2)}) ${prompt}`)
}
const correct = Object.entries(counts).reduce((sum,[expected,observed]) => sum + (observed[expected] ?? 0),0)
console.log(`\nSmoke accuracy: ${correct}/${samples.length} (${(correct/samples.length*100).toFixed(1)}%)`)
console.log('Confusion counts:',counts)
