/**
 * Splits a SQL script into individual statements.
 *
 * D1's `exec()` requires one statement per line, so multi-line DDL (tables,
 * views, triggers) is applied through `batch()` instead. This splitter tracks
 * string literals, comments, and the BEGIN...END / CASE...END nesting used by
 * trigger bodies, so only real statement terminators split the script.
 */
export function splitSql(source: string): string[] {
  const statements: string[] = []
  let buffer = ''
  let depth = 0
  let inSingle = false
  let inDouble = false
  let inLineComment = false
  let inBlockComment = false
  let word = ''

  const finishWord = () => {
    const keyword = word.toUpperCase()
    if (keyword === 'BEGIN' || keyword === 'CASE') depth += 1
    else if (keyword === 'END') depth -= 1
    word = ''
  }

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    const next = source[i + 1]

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false
        buffer += char
      }
      continue
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false
        i += 1
      }
      continue
    }
    if (inSingle) {
      buffer += char
      if (char === "'") {
        if (next === "'") {
          buffer += next
          i += 1
        } else {
          inSingle = false
        }
      }
      continue
    }
    if (inDouble) {
      buffer += char
      if (char === '"') inDouble = false
      continue
    }
    if (char === '-' && next === '-') {
      inLineComment = true
      i += 1
      continue
    }
    if (char === '/' && next === '*') {
      inBlockComment = true
      i += 1
      continue
    }
    if (char === "'") {
      inSingle = true
      buffer += char
      continue
    }
    if (char === '"') {
      inDouble = true
      buffer += char
      continue
    }
    if (/[A-Za-z_]/.test(char)) {
      word += char
      buffer += char
      continue
    }
    if (word) finishWord()
    if (char === ';') {
      if (depth <= 0) {
        const statement = buffer.trim()
        if (statement) statements.push(statement)
        buffer = ''
        depth = 0
      } else {
        buffer += char
      }
      continue
    }
    buffer += char
  }

  if (word) finishWord()
  const tail = buffer.trim()
  if (tail) statements.push(tail)
  return statements
}
