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
const signals = {
  simple: [
    /\b(?:reply|respond|answer|say|print|output)\s+(?:with\s+)?(?:exactly\s+)?(?:ok|yes|no|hello|one word|a single word)\b/i,
    /\b(?:return|reply|respond|output)\b.{0,35}\b(?:single|one)\s+word\b/i,
    /\b(?:what (?:is|does)|explain|define|definition|difference between|list (?:two|three|four|five)|translate|sort)\b.{0,95}\b(?:briefly|sentence|short|mean|commands?|boolean|http|readme|unit test|const|names?|label)\b/i,
    /\b(?:format|reformat|replace|change|add|remove|update|make)\b.{0,75}\b(?:short json|imports|markdown title|greeting string|missing newline|one icon|one line|single label)\b/i,
    /\b(?:typo|spelling|punctuation|whitespace|indentation|formatting|rename|comment|readme)\b/i,
    /\b(?:tippfehler|rechtschreibung|formatierung|umbenennen|beschriftung)\b/i,
  ],
  medium: [
    /\b(?:cancellation tokens?|optimistic concurrency|debounce|dependency injection|injectable|binary.search|off.by.one|file watcher)\b/i,
    /\b(?:implement|implementiere|refactor|refaktoriere|fix|debug|behebe|repair|add|ergänze)\b.{0,65}\b(?:feature|endpoint|api|parser|validation|tests?|function|method|funktion|methode|test|validierung)\b/i,
    /\b(?:unit tests?|integration tests?|error handling|rest api|json parser|endpunkt)\b/i,
  ],
  complex: [
    /\b(?:hundreds|thousands|\d{2,})\b.{0,65}\b(?:clients?|consumers?|repositories|systems?|services?|projects?)\b/i,
    /\b(?:all|every)\b.{0,65}\b(?:clients?|consumers?)\b/i,
    /\b(?:global failover|shared across services|multiple processes|replicated data|microservices|cascading failures)\b/i,
    /\b(?:distributed|verteilte[ns]?|multi[- ]service|system[- ]wide|codebase[- ]wide|race condition|deadlocks?|threat model)\b/i,
    /\b(?:migrat(?:e|ing|ion)|redesign|neugestaltung|übergreifend)\b.{0,85}\b(?:database|schema|services?|projects?|codebase|datenbank|projekte|system)\b/i,
    /\b(?:across|über|mehrere)\b.{0,50}\b(?:services?|modules?|projects?|systeme|projekte|module)\b/i,
  ],
}

// JavaScript's \b uses ASCII word characters, splitting words with umlauts.
// Replace it with a boundary based on Unicode letters, digits, and underscore.
const word = '[\\p{L}\\p{N}_]'
const boundary = `(?:(?<=${word})(?!${word})|(?<!${word})(?=${word}))`
for (const tier of labels) signals[tier] = signals[tier].map(pattern =>
  new RegExp(pattern.source.replaceAll('\\b', boundary), `${pattern.flags}u`))

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
  // A couple of generic words such as "plan" and "review" do not establish
  // system-wide scope; explicit complexity signals remain authoritative.
  if (ranked[0].tier === 'complex' && new Set(recognized).size < 3)
    return {tier:'medium',confidence:0,source:'fallback'}
  return {...ranked[0], source: 'naive-bayes'}
}
