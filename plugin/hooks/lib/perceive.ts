const TEST_COMMAND =
  /(^|[\s;&|(])((npm|pnpm|yarn|bun)\s+(run\s+)?test\b|npx\s+(jest|vitest|mocha)\b|jest\b|vitest\b|pytest\b|python3?\s+-m\s+(pytest|unittest)\b|go\s+test\b|cargo\s+(test|nextest)\b|mvn\s+(-\S+\s+)*test\b|\.?\/?gradlew?\s+(\S+\s+)*test\b|rspec\b|mocha\b|phpunit\b|dotnet\s+test\b|swift\s+test\b|deno\s+test\b|claude\s+plugin\s+test\b)/

export const isTestCommand = (command: string): boolean => TEST_COMMAND.test(command)

export const testKey = (command: string): string => command.trim().replace(/\s+/g, ' ').slice(0, 120)

export type TestOutcome = { kind: 'test-fail' | 'test-pass'; key: string; summary: string }

const firstFailureLine = (text: string): string => {
  const line = text
    .split('\n')
    .map(row => row.trim())
    .find(row => /(fail|error|✗|✕|assert|expected)/i.test(row))
  return (line ?? text.trim().split('\n')[0] ?? '').slice(0, 140)
}

export const readTestOutcome = (command: string, isError: boolean, text: string): TestOutcome | null => {
  if (!isTestCommand(command)) {
    return null
  }
  const key = testKey(command)
  return isError
    ? { kind: 'test-fail', key, summary: firstFailureLine(text) }
    : { kind: 'test-pass', key, summary: '' }
}

export type GitOperation = {
  commit?: { sha: string; kind: string; branch?: string }
  push?: { branch: string }
  pr?: { number: number; action: string }
}

export type GitEvent = { kind: 'commit' | 'push' | 'pr'; detail: string }

export const readGitEvents = (operation: GitOperation | undefined): readonly GitEvent[] => {
  if (operation === undefined) {
    return []
  }
  const commit: GitEvent[] = operation.commit === undefined ? [] : [{ kind: 'commit', detail: `${operation.commit.sha.slice(0, 7)} ${operation.commit.branch ?? ''}`.trim() }]
  const push: GitEvent[] = operation.push === undefined ? [] : [{ kind: 'push', detail: operation.push.branch }]
  const pr: GitEvent[] = operation.pr === undefined ? [] : [{ kind: 'pr', detail: `#${operation.pr.number} ${operation.pr.action}` }]
  return [...commit, ...push, ...pr]
}

export const failureStreak = (events: readonly { kind: string; detail: string }[], key: string): number => {
  const relevant = events.filter(event => (event.kind === 'test-fail' || event.kind === 'test-pass') && event.detail.startsWith(key))
  const lastPass = relevant.map(event => event.kind).lastIndexOf('test-pass')
  return relevant.length - lastPass - 1
}
