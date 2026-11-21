// Pure helpers for the worker: parse `git blame --line-porcelain` and validate user input.
import type { BlameLine } from './protocol'

const HEADER = /^([0-9a-f]{40}) (\d+) (\d+)/
const ZERO_SHA = /^0{40}$/

/** Parses `git blame --line-porcelain` output into one entry per source line. */
export function parseBlame(porcelain: string): BlameLine[] {
  const lines: BlameLine[] = []
  let sha = ''
  let n = 0
  let author = ''
  let time = 0
  let summary = ''
  for (const raw of porcelain.split('\n')) {
    if (raw.startsWith('\t')) {
      lines.push({ n, sha, author, time, summary, text: raw.slice(1), uncommitted: ZERO_SHA.test(sha) })
      continue
    }
    const header = HEADER.exec(raw)
    if (header) {
      sha = header[1]
      n = Number(header[3])
    } else if (raw.startsWith('author ')) author = raw.slice(7)
    else if (raw.startsWith('author-time ')) time = Number(raw.slice(12))
    else if (raw.startsWith('summary ')) summary = raw.slice(8)
  }
  return lines
}

/** A repo-relative file path that can't escape the repo or be read as a git option. */
export function isSafeRelativePath(file: string): boolean {
  if (!file || file.length > 1024 || file.startsWith('-') || file.startsWith('/') || file.includes('\0')) return false
  return !file.split(/[\\/]/).includes('..')
}

export function isSha(value: string): boolean {
  return /^[0-9a-f]{7,40}$/.test(value)
}
