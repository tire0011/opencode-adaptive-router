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

// High-signal intent patterns complement the tiny word-frequency model. They
// keep commonplace prompts out of the unknown-word fallback without an LLM call.
// `\b` does not treat umlauts as word characters in JS regex, so patterns use
// Unicode-aware boundaries: B = start of word, E = end of word.
const B = '(?<![\\p{L}\\p{N}])', E = '(?![\\p{L}\\p{N}])'
const w = (...parts) => new RegExp(parts.join(''), 'iu')

// Single topic words (e.g. "architecture", "readme") must not decide the tier
// alone; complex signals need scope or a design/migration intent.
const signals = {
  simple: [
    w(B, '(?:reply|respond|answer|say|print|output)\\s+(?:with\\s+)?(?:exactly\\s+)?(?:ok|yes|no|hello|one word|a single word)', E),
    w(B, '(?:typos?|spelling|punctuation|whitespace|indentation|formatting|rename|tippfehler|rechtschreibung|formatierung|umbenennen|beschriftung)', E),
  ],
  medium: [
    w(B, '(?:implement|implementiere|refactor|refaktoriere|fix|debug|behebe|repair|add|ergänze)', E, '.{0,65}', B, '(?:feature|endpoint|api|parser|validation|tests?|function|method|funktion|methode|validierung)', E),
    w(B, '(?:unit tests?|integration tests?|error handling|rest api|json parser|endpunkt)', E),
  ],
  complex: [
    w(B, '(?:distributed|verteilte[ns]?|multi[- ]service|system[- ]wide|codebase[- ]wide|race conditions?|deadlocks?|threat model)', E),
    w(B, '(?:design|redesign|entwirf|entwerfe|plan|review)', E, '.{0,40}', B, '(?:architecture|architektur)', E),
    w(B, '(?:migrat(?:e|ion)|redesign|neugestaltung|übergreifende?[nrs]?)', E, '.{0,85}', B, '(?:database|schema|services?|projects?|codebase|datenbank|projekte|system)', E),
    w(B, '(?:across|mehrere|übergreifende?[nrs]?)', E, '.{0,50}', B, '(?:services?|modules?|projects?|systeme|projekte|module)', E),
  ],
}

function classifySignals(text) {
  const matches = Object.fromEntries(labels.map(tier => [tier, signals[tier].filter(pattern => pattern.test(text)).length]))
  // Complexity wins conflicting scopes: e.g. "fix a typo across 300 services".
  if (matches.complex) return {tier:'complex',confidence:0.85,source:'signals'}
  if (matches.medium) return {tier:'medium',confidence:0.8,source:'signals'}
  if (matches.simple) return {tier:'simple',confidence:0.8,source:'signals'}
  return null
}

export function classifyTask(text) {
  const prompt = typeof text === 'string' ? text.slice(0, 4000) : ''
  const signal = classifySignals(prompt)
  if (signal) return signal
  const words = tokens(prompt)
  const recognized = words.filter(word => vocabulary.has(word))
  // Unknown work must not silently be treated as a trivial change.
  if (recognized.length < 2) return { tier: 'medium', confidence: 0, source: 'fallback' }
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
