/**
 * Synthetic assessment set authored and labeled before its first evaluation.
 * These labels are judgments about likely effort, not observed model success.
 * Do not tune classifiers on this set and then call it independent.
 */
export const cases = {
  simple: [
    'Correct the spelling of the help tooltip in the settings dialog.',
    'Explain how a hash map handles collisions in plain language.',
    'Remove trailing spaces from the example configuration file.',
    'Respond with a single sentence about why tests matter.',
    'Adjust the heading capitalization in a design document.',
    'Translate the error message into German without changing code.',
    'Show a small example of array destructuring.',
    'Korrigiere die Rechtschreibung im Kommentar zur API.',
    'Explain what a database transaction means for a beginner.',
    'Update the documentation link to the new guide URL.',
    'Rename a private loop variable inside one short function.',
    'Format the sample JSON with consistent indentation.',
  ],
  medium: [
    'Implement CSV export for a single report endpoint with unit tests.',
    'Fix pagination when the last page has exactly one record.',
    'Add validation and friendly errors to an existing input form.',
    'Refactor two duplicated parsers into one shared helper.',
    'Create a retry policy for one outbound HTTP integration.',
    'Replace a deprecated library API in a standalone utility.',
    'Implement incremental file scanning in a desktop application.',
    'Add a configurable timeout to the local cache client.',
    'Schreibe Tests für den Import einer CSV-Datei mit ungültigen Zeilen.',
    'Investigate a failed JSON deserialization in one service.',
    'Add a command line option for selecting an output directory.',
    'Implement a small dashboard widget using existing API data.',
  ],
  complex: [
    'Coordinate an API protocol upgrade for thousands of deployed devices.',
    'Design safe failover for a geographically distributed message broker.',
    'Prevent duplicate financial transfers across retrying services.',
    'Migrate tenant records between databases with no downtime or data loss.',
    'Investigate deadlocks spanning two distributed transaction coordinators.',
    'Redesign authorization boundaries across independently deployed services.',
    'Plan disaster recovery for a multi-region event-processing platform.',
    'Change a shared wire format consumed by every external integration.',
    'Safely rotate encryption keys across persistent storage clusters.',
    'Entwirf ein fehlertolerantes System für mehrere Rechenzentren.',
    'Guarantee exactly-once effects when several consumers race to process events.',
    'Untangle a cascading outage caused by dependencies among microservices.',
  ],
}
