/**
 * Embeds db/schema.sql into a TypeScript module so the Worker bundle stays
 * self-contained (no separate text module at deploy time).
 *
 * Run automatically by `npm run dev`, `npm run build` and `npm run worker:dev`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const sql = readFileSync(join(root, 'db', 'schema.sql'), 'utf8')
const output = `// Generated from db/schema.sql — do not edit by hand.
// Regenerate with: npm run schema:generate
const SCHEMA_SQL: string = ${JSON.stringify(sql)}
export default SCHEMA_SQL
`

writeFileSync(join(root, 'worker', 'schema.generated.ts'), output)
console.log(`schema.generated.ts written (${sql.length} bytes)`)
