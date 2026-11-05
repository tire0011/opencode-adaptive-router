/** Experimental, offline task assessment. Not wired into live routing. */
const match = (text, expression) => expression.test(text)

// Word boundaries include umlauts, unlike JavaScript's ASCII-oriented \b.
const word = '[\\p{L}\\p{N}_]'
const phrase = source => new RegExp(`(?<!${word})(?:${source})(?!${word})`, 'iu')
const leading = source => new RegExp(`^\\s*(?:please\\s+|bitte\\s+)?(?:${source})(?!${word})`, 'iu')

const patterns = {
  explain:leading('explain|describe|summarize|define|what is|what does|why is|show|give an? example|difference between|erkläre|erklären|beschreibe|was ist|was bedeutet|übersetze|translate|reply|respond|answer'),
  cosmetic:phrase('typo|spelling|punctuation|whitespace|indentation|formatting|comment|readme|documentation|label|caption|tippfehler|rechtschreibung|formatierung|kommentar|dokumentation|beschriftung'),
  implement:leading('implement|add|create|build|write|develop|implementiere|erstelle|füge hinzu'),
  refactor:leading('refactor|rename|replace|update|fix|repair|change|modify|adjust|remove|correct|korrigiere|ändere|umbenennen|aktualisiere'),
  design:leading('design|architect|plan|redesign|entwirf|konzipiere'),
  investigate:leading('investigate|debug|diagnose|analyze|analyse|untersuche|find the cause'),
  local:phrase('one|single|small|local|private|single file|one function|one method|one line|einer|einzelnen|lokal'),
  systemic:phrase('distributed|microservices|across services|multiple services|multiple regions|multi.region|across clusters|cross.service|system.wide|global platform|all tenants|every client|all clients|hundreds of clients|thousands of clients|thousands of devices|multiple datacenters|mehrere rechenzentren|verteiltes system|mehrere systeme|über mehrere dienste'),
  broad:phrase('multiple files|several modules|across modules|across projects|many components|mehrere dateien|mehrere module|mehrere projekte'),
  highRisk:phrase('data loss|deadlock|race condition|encryption|authentication|authorization|security|privacy|payments?|financial transfers?|exactly.once|duplicate transfers?|disaster recovery|protocol upgrade|shared wire format|data migration|database migration|rollback|consistency|concurrency|sicherheit|verschlüsselung|datenverlust|berechtigung|nebenläufigkeit|fehlertolerant(?:es|en|e)?'),
  mediumRisk:phrase('database|schema|api|deployment|dependency|dependencies|tests|parser|thread|performance|datenbank|schnittstelle|abhängigkeiten'),
  lowRisk:phrase('typo|spelling|punctuation|whitespace|formatting|label|caption|comment|readme|documentation|tippfehler|rechtschreibung|formatierung|kommentar|dokumentation'),
  cosmeticEdit:phrase('typo|spelling|punctuation|whitespace|trailing spaces|indentation|formatting|capitalization|heading|documentation link|readme|rechtschreibung|tippfehler|formatierung'),
  boundedRename:phrase('private|local|loop variable|single function|one function|one short function'),
}

export function assessTask(text) {
  const prompt = typeof text === 'string' ? text.slice(0, 4000) : ''
  const has = key => match(prompt, patterns[key])
  const intent = has('explain') ? 'explain'
    : has('investigate') ? 'investigate'
    : has('implement') ? 'implement'
    : has('refactor') ? 'modify'
    : has('design') ? 'design'
    : 'unknown'

  // Scope and risk describe the request separately; neither a cosmetic word
  // nor a large word count automatically determines model complexity.
  const scope = has('systemic') ? 'systemic'
    : has('broad') ? 'multi-component'
    : has('local') || has('cosmetic') ? 'local'
    : 'unknown'
  const risk = has('highRisk') ? 'high'
    : has('mediumRisk') ? 'medium'
    : has('lowRisk') ? 'low'
    : 'unknown'

  const informational = intent === 'explain'
  const cosmetic = has('refactor') && has('cosmeticEdit') && !has('highRisk')
  const boundedRename = has('refactor') && has('boundedRename') && !has('highRisk')
  const tier = informational || cosmetic || boundedRename ? 'simple'
    : scope === 'systemic' || risk === 'high' || (intent === 'design' && scope === 'multi-component') ? 'complex'
    : 'medium'

  const known = Number(intent !== 'unknown') + Number(scope !== 'unknown') + Number(risk !== 'unknown')
  return {
    intent, scope, risk, tier,
    confidence:known === 3 ? 0.75 : known === 2 ? 0.6 : known === 1 ? 0.4 : 0,
    source:'structured-experimental',
  }
}
