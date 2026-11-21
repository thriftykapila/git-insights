# Git Insights

Created by [Thrifty Kapila](https://www.linkedin.com/in/thriftykapila/), owner and core maintainer. Open source under the [MIT License](LICENSE).

An Orca sidebar panel that shows who wrote each line of a file, GitLens-style, using read-only `git`.

- Pick a workspace and search for a tracked file; the panel lists `git blame` for 100 lines at a time.
- Hover a line's author button for the author, date and commit message; press it to load that commit's `git show --stat`.
- Lines with local, uncommitted edits are marked "You · local".

Hovering lines in Orca's own editor is not possible: the plugin API has no editor hover/decoration or active-file API, so everything lives in this panel.

## How it works

`src/worker.ts` runs `git` with `execFile` (no shell) in worktrees Orca lists through `workspace.list`; it never runs git in a folder Orca didn't list. File paths are checked (`src/blame.ts`) so they can't escape the repo or be read as git options. `src/panel.tsx` renders the results. `src/protocol.ts` types the requests between them. It needs `trusted-worker` access (runs as you) and the `workspace:read` capability. Nothing is written to the repo.

## Develop

```sh
orca plugin validate .
orca plugin test .
orca plugin dev watch .   # loads this folder into Orca, reloads on save
```
