// Worker guard tests over a mock host: a request must name a workspace Orca listed.
import { assert, mockHost, mountWorker, test } from 'orca/testing'
import * as main from './worker'

test('refuses unsafe input before running git', async () => {
  const host = mockHost({})
  const worker = await mountWorker(main, { host })
  await assert.rejects(() => worker.request('git.blame', { workspaceId: 'nope', file: '../x', start: 1, count: 10 }))
  await assert.rejects(() => worker.request('git.commit', { workspaceId: 'nope', sha: '--help' }))
  await worker.deactivate()
})
