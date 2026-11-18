import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Commits must be ordered newest first, as returned by git log.
export function decideBump(commits) {
  const ignored = new Set()
  const inRange = new Set(commits.map(commit => commit.hash))
  const messages = []
  for (const commit of commits) {
    if (ignored.has(commit.hash)) continue
    const reverted = commit.message.match(/^This reverts commit ([a-f0-9]{40})\.$/m)?.[1]
    if (reverted) {
      ignored.add(reverted)
      // Undoing an earlier release changes shipped behavior and needs a patch.
      if (!inRange.has(reverted)) messages.push('fix: revert released change')
      continue
    }
    messages.push(commit.message)
  }
  if (messages.some(message => /^[a-z]+(?:\([^)]+\))?!:/.test(message) || /^BREAKING[ -]CHANGE:/m.test(message))) return 'major'
  if (messages.some(message => /^feat(?:\([^)]+\))?:/.test(message))) return 'minor'
  if (messages.some(message => /^fix(?:\([^)]+\))?:/.test(message))) return 'patch'
  return 'none'
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim()
  let tag = ''
  try { tag = git(['describe', '--tags', '--abbrev=0']) } catch { /* First release. */ }
  const range = tag ? [`${tag}..HEAD`] : []
  const hashes = git(['log', ...range, '--format=%H']).split('\n').filter(Boolean)
  const commits = hashes.map(hash => ({ hash, message: git(['show', '-s', '--format=%B', hash]) }))
  const bump = decideBump(commits)
  console.log(`Analysing commits since ${tag || 'start'}; selected bump: ${bump}`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `bump=${bump}\n`)
}
