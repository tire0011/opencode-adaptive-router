/** Tiny, offline multinomial Naive Bayes classifier. No LLM, GPU or runtime download. */
const training = {
  simple: [
    'fix typo spelling rename variable comment documentation',
    'format lint prettier adjust whitespace indentation',
    'change label string color button text',
    'correct simple error small bug one line',
    'korrigiere tippfehler umbenennen kommentar dokumentation',
    'ändere text formatierung kleine einfache anpassung',
    'rename a field in one file',
    'update docs and typos',
  ],
  medium: [
    'implement feature add endpoint validation tests',
    'refactor function extract method add unit tests',
    'debug failing test fix api behavior',
    'add parser new route handle errors',
    'implementiere funktion ergänze test und validierung',
    'behebe fehler refaktoriere methode und ergänze tests',
    'repair parsing of invalid input',
    'add new rest route with tests',
    'implement endpoint and validation for input handling',
  ],
  complex: [
    'design distributed system architecture across services',
    'migrate entire codebase redesign database schema',
    'investigate concurrency deadlock race condition distributed',
    'security threat model authentication authorization architecture',
    'optimize system performance bottleneck across modules',
    'entwirf architektur verteiltes system migration vieler projekte',
    'analysiere race condition parallelität transaktion sicherheit',
    'plan a multi service migration with deadlocks',
    'review distributed security architecture',
    'redesign multiple interconnected services and system',
  ],
}
const labels = Object.keys(training)
const tokens = value => (value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(x => x.length > 2)
const counts = new Map(labels.map(label => [label, new Map()]))
const totals = new Map(labels.map(label => [label, 0]))
const vocabulary = new Set()
for (const label of labels) for (const sample of training[label]) for (const word of tokens(sample)) {
  vocabulary.add(word)
  counts.get(label).set(word, (counts.get(label).get(word) ?? 0) + 1)
  totals.set(label, totals.get(label) + 1)
}

export function classifyTask(text) {
  const words = tokens(typeof text === 'string' ? text.slice(0, 4000) : '')
  const recognized = words.filter(word => vocabulary.has(word))
  if (recognized.length < 2) return { tier: 'simple', confidence: 0, source: 'fallback' }
  const scores = labels.map(label => {
    const count = counts.get(label)
    const denominator = totals.get(label) + vocabulary.size
    return recognized.reduce((sum, word) => sum + Math.log(((count.get(word) ?? 0) + 1) / denominator), 0)
  })
  const probabilities = scores.map(score => Math.exp(score - Math.max(...scores)))
  const sum = probabilities.reduce((a, b) => a + b, 0)
  const ranked = labels.map((tier, i) => ({tier, confidence: probabilities[i] / sum})).sort((a,b) => b.confidence - a.confidence)
  return {...ranked[0], source: 'naive-bayes'}
}
