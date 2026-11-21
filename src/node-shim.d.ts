// Minimal typings for the few Node builtins the worker uses (the plugin ships no @types/node).
declare module 'node:child_process' {
  export function execFile(
    file: string,
    args: readonly string[],
    options: { cwd?: string; timeout?: number; maxBuffer?: number; env?: Record<string, string | undefined> },
    callback: (error: Error | null, stdout: string, stderr: string) => void
  ): unknown
}
declare module 'node:util' {
  export function promisify(
    fn: typeof import('node:child_process').execFile
  ): (
    file: string,
    args: readonly string[],
    options: { cwd?: string; timeout?: number; maxBuffer?: number; env?: Record<string, string | undefined> }
  ) => Promise<{ stdout: string; stderr: string }>
}
declare const process: { cwd(): string; env: Record<string, string | undefined> }
