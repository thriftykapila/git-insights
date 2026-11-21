// Git Insights worker: read-only git through execFile (no shell). Every request names a workspace
// Orca listed, so the plugin never runs git in an arbitrary folder.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { OrcaWorkerApi } from 'orca/worker'
import { isSafeRelativePath, isSha, parseBlame } from './blame'
import type { WorkspaceRef } from './protocol'

const run = promisify(execFile)
const ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' }

async function git(cwd: string, args: string[], maxBuffer = 8 * 1024 * 1024): Promise<string> {
  const { stdout } = await run('git', args, { cwd, timeout: 20_000, maxBuffer, env: ENV })
  return stdout
}

export default function activate(orca: OrcaWorkerApi): void {
  /** Local git worktrees, by Orca workspace id; paths stay inside the worker. */
  async function localWorktrees(): Promise<Map<string, WorkspaceRef & { path: string }>> {
    const { workspaces } = await orca.host.call('workspace.list')
    const map = new Map<string, WorkspaceRef & { path: string }>()
    for (const w of workspaces) {
      if (w.kind === 'worktree' && (w.hostId === null || w.hostId === 'local')) {
        map.set(w.id, { id: w.id, name: w.name, branch: w.branch, path: w.path })
      }
    }
    return map
  }
  async function pathOf(workspaceId: string): Promise<string> {
    const ws = (await localWorktrees()).get(workspaceId)
    if (!ws) throw new Error('Unknown or non-local workspace')
    return ws.path
  }

  orca.panels.handle('git.workspaces', async () => ({
    workspaces: [...(await localWorktrees()).values()].map(({ id, name, branch }) => ({ id, name, branch }))
  }))

  orca.panels.handle('git.files', async ({ workspaceId, query }) => {
    const out = await git(await pathOf(workspaceId), ['ls-files', '-z'], 64 * 1024 * 1024)
    const needle = query.trim().toLowerCase()
    const all = out.split('\0').filter(Boolean)
    const hits = needle ? all.filter((f) => f.toLowerCase().includes(needle)) : all
    return { files: hits.slice(0, 12), total: hits.length }
  })

  orca.panels.handle('git.blame', async ({ workspaceId, file, start, count }) => {
    if (!isSafeRelativePath(file)) throw new Error('Not a valid repo-relative file path')
    const from = Math.max(1, Math.floor(start))
    const size = Math.min(500, Math.max(1, Math.floor(count)))
    const out = await git(await pathOf(workspaceId), ['blame', '--line-porcelain', '-L', `${from},${from + size - 1}`, '--', file])
    const lines = parseBlame(out)
    return { lines, hasMore: lines.length === size }
  })

  orca.panels.handle('git.commit', async ({ workspaceId, sha }) => {
    if (!isSha(sha)) throw new Error('Not a commit id')
    const out = await git(await pathOf(workspaceId), ['show', '--stat', '--format=fuller', '--no-color', sha])
    return { text: out.length > 6000 ? `${out.slice(0, 6000)}\n... (truncated)` : out }
  })
}
