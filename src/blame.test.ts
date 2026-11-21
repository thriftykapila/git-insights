// Pure-helper tests: run with `orca plugin test .`
import { assert, test } from 'orca/testing'
import { isSafeRelativePath, isSha, parseBlame } from './blame'

const A = 'a'.repeat(40)
const Z = '0'.repeat(40)
const PORCELAIN = [
  `${A} 1 1 1`, 'author Asha Rao', 'author-mail <asha@example.in>', 'author-time 1700000000', 'author-tz +0530',
  'committer Asha Rao', 'summary Add users page', 'filename src/a.ts', '\tconst a = 1',
  `${Z} 2 2 1`, 'author Not Committed Yet', 'author-time 1700000500', 'summary Version of src/a.ts from src/a.ts', 'filename src/a.ts', '\tconst b = 2'
].join('\n')

test('parses committed and uncommitted lines', () => {
  const [one, two] = parseBlame(PORCELAIN)
  assert.deepEqual(
    { n: one.n, sha: one.sha, author: one.author, time: one.time, summary: one.summary, text: one.text, uncommitted: one.uncommitted },
    { n: 1, sha: A, author: 'Asha Rao', time: 1700000000, summary: 'Add users page', text: 'const a = 1', uncommitted: false }
  )
  assert.equal(two.uncommitted, true)
  assert.equal(two.text, 'const b = 2')
})

test('rejects paths that escape the repo or look like options', () => {
  assert.equal(isSafeRelativePath('src/features/a.ts'), true)
  for (const bad of ['', '../x', 'a/../../b', '/etc/passwd', '--output=x', 'a\0b']) assert.equal(isSafeRelativePath(bad), false)
})

test('accepts only hex commit ids', () => {
  assert.equal(isSha('0610b8fd6'), true)
  assert.equal(isSha('--help'), false)
  assert.equal(isSha('HEAD'), false)
})
