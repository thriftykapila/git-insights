// The panel <-> worker contract, declared once: src/panel.tsx and src/worker.ts both read it.
export {}

export interface WorkspaceRef {
  id: string
  name: string
  branch: string | null
}

/** One blamed line. `time` is the author time in unix seconds. */
export interface BlameLine {
  n: number
  sha: string
  author: string
  time: number
  summary: string
  text: string
  /** Not committed yet (local edits). */
  uncommitted: boolean
}

declare module 'orca' {
  interface PluginRequests {
    /** Local git worktrees Orca knows, to pick one. */
    'git.workspaces': { output: { workspaces: WorkspaceRef[] } }
    /** Tracked files whose path contains `query` (case-insensitive), at most 12. */
    'git.files': { input: { workspaceId: string; query: string }; output: { files: string[]; total: number } }
    /** `git blame` for `count` lines from line `start` (1-based). */
    'git.blame': {
      input: { workspaceId: string; file: string; start: number; count: number }
      output: { lines: BlameLine[]; hasMore: boolean }
    }
    /** `git show --stat` text for one commit. */
    'git.commit': { input: { workspaceId: string; sha: string }; output: { text: string } }
  }
}
