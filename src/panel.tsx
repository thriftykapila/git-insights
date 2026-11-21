// Git Insights panel: pick a workspace and a file, read who wrote each line. Hover a line's author
// button for the full commit info; press it to load that commit's stat. No build step.
import {
  atom, Badge, Button, Code, derived, Heading, Input, List, ListItem, plugin, read, Row, Select,
  set, Stack, Text, type PanelContext
} from 'orca'
import type { BlameLine, WorkspaceRef } from './protocol'

const PAGE = 100

const workspaces = atom<WorkspaceRef[]>([])
const workspaceId = atom('workspace', '', { persist: 'plugin' })
const query = atom('')
const suggestions = atom<string[]>([])
const file = atom('')
const start = atom(1)
const lines = atom<BlameLine[]>([])
const hasMore = atom(false)
const busy = atom(false)
const error = atom('')
const picked = atom<BlameLine | null>(null)
const commitText = atom('')

const workspaceOptions = derived(() =>
  read(workspaces).map((w) => ({ value: w.id, label: `${w.name}${w.branch ? ` (${w.branch})` : ''}` }))
)

/** "3d ago" style age from unix seconds. */
function age(seconds: number): string {
  const diff = Math.max(0, Date.now() / 1000 - seconds)
  const units: [string, number][] = [['y', 31536000], ['mo', 2592000], ['d', 86400], ['h', 3600], ['m', 60]]
  for (const [label, size] of units) if (diff >= size) return `${Math.floor(diff / size)}${label} ago`
  return 'just now'
}

function tooltipFor(l: BlameLine): string {
  if (l.uncommitted) return 'Not committed yet (local changes)'
  const when = new Date(l.time * 1000).toISOString().slice(0, 16).replace('T', ' ')
  return `${l.author}\n${when} UTC (${age(l.time)})\n${l.sha.slice(0, 8)}: ${l.summary}`
}

async function guarded(work: () => Promise<void>): Promise<void> {
  set(busy, true)
  set(error, '')
  try {
    await work()
  } catch (e) {
    set(error, (e as Error).message)
  } finally {
    set(busy, false)
  }
}

async function suggest(text: string): Promise<void> {
  set(query, text)
  const id = read(workspaceId)
  if (!id || text.trim().length < 2) return set(suggestions, [])
  try {
    set(suggestions, (await plugin.request('git.files', { workspaceId: id, query: text })).files)
  } catch (e) {
    set(error, (e as Error).message)
  }
}

async function loadBlame(path: string, from: number): Promise<void> {
  await guarded(async () => {
    const answer = await plugin.request('git.blame', { workspaceId: read(workspaceId), file: path, start: from, count: PAGE })
    set(file, path)
    set(start, from)
    set(lines, answer.lines)
    set(hasMore, answer.hasMore)
    set(picked, null)
    set(commitText, '')
    set(suggestions, [])
  })
}

async function showCommit(l: BlameLine): Promise<void> {
  set(picked, l)
  set(commitText, '')
  if (l.uncommitted) return
  await guarded(async () => {
    set(commitText, (await plugin.request('git.commit', { workspaceId: read(workspaceId), sha: l.sha })).text)
  })
}

export function setup(_ctx: PanelContext): void {
  void guarded(async () => {
    const { workspaces: list } = await plugin.request('git.workspaces')
    set(workspaces, list)
    if (!list.some((w) => w.id === read(workspaceId)) && list[0]) set(workspaceId, list[0].id)
  })
}

export default function Panel() {
  const rows = read(lines)
  const current = read(file)
  const selected = read(picked)
  const failure = read(error)
  return (
    <Stack gap="md">
      <Row justify="between">
        <Heading>Git Insights</Heading>
        {read(busy) ? <Badge tone="accent">working…</Badge> : null}
      </Row>
      <Select
        label="Workspace"
        value={read(workspaceId)}
        options={read(workspaceOptions)}
        onChange={(id) => { set(workspaceId, id); set(lines, []); set(file, ''); set(suggestions, []) }}
      />
      <Input
        label="File"
        type="search"
        placeholder="Type part of a path, e.g. UsersPage"
        value={read(query)}
        onChange={(text) => void suggest(text)}
      />
      {read(suggestions).length > 0 ? (
        <List label="Matching files">
          {read(suggestions).map((f) => (
            <ListItem key={f} title={f} onPress={() => void loadBlame(f, 1)} />
          ))}
        </List>
      ) : null}
      {failure ? <Text tone="danger">{failure}</Text> : null}

      {current ? (
        <Stack gap="xs">
          <Row justify="between">
            <Text weight="semibold" truncate>{current}</Text>
            <Text muted size="xs">lines {read(start)}–{read(start) + Math.max(rows.length - 1, 0)}</Text>
          </Row>
          <Row gap="xs">
            <Button size="xs" variant="outline" disabled={read(start) <= 1} onPress={() => void loadBlame(current, Math.max(1, read(start) - PAGE))}>
              Previous {PAGE}
            </Button>
            <Button size="xs" variant="outline" disabled={!read(hasMore)} onPress={() => void loadBlame(current, read(start) + PAGE)}>
              Next {PAGE}
            </Button>
          </Row>
          {rows.map((l) => (
            <Row key={l.n} gap="xs" align="center">
              <Button
                size="xs"
                variant="ghost"
                tone={l.uncommitted ? 'warning' : 'neutral'}
                tooltip={tooltipFor(l)}
                onPress={() => void showCommit(l)}
              >
                {l.uncommitted ? 'You · local' : `${l.author} · ${age(l.time)}`}
              </Button>
              <Text muted size="xs">{l.n}</Text>
              <Code>{l.text || ' '}</Code>
            </Row>
          ))}
        </Stack>
      ) : (
        <Text muted size="xs">Pick a workspace, then search for a file to see who wrote each line. Hover an author for details.</Text>
      )}

      {selected ? (
        <Stack gap="xs">
          <Text weight="semibold">
            {selected.uncommitted ? 'Local changes' : `${selected.sha.slice(0, 8)} · ${selected.author}`}
          </Text>
          <Text size="xs">{selected.uncommitted ? 'This line has not been committed yet.' : selected.summary}</Text>
          {read(commitText) ? <Code block>{read(commitText)}</Code> : null}
        </Stack>
      ) : null}
    </Stack>
  )
}
