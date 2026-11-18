import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Commits must be ordered newest first, as returned by git log.
export function decideBump(commits, revertBump) {
  if (revertBump !== undefined && !['none', 'patch', 'minor', 'major'].includes(revertBump)) {
    throw new Error('Invalid Release-Bump override')
  }
  const ignored = new Set()
  const inRange = new Set(commits.map(commit => commit.hash))
  const messages = []
  const decisions = []
  for (const commit of commits) {
    if (ignored.has(commit.hash)) continue
    const reverted = commit.message.match(/^This reverts commit ([a-f0-9]{40})\.$/m)?.[1]
    const isRevert = reverted || /^revert(?:\([^)]+\))?(?:!?:|\s)/i.test(commit.message)
    const footers = [...commit.message.matchAll(/^Release-Bump:[ \t]*(.*)$/gm)]
    if (footers.length > 1 || (footers.length === 1 && !['none', 'patch', 'minor', 'major'].includes(footers[0][1].trim()))) {
      throw new Error(`Invalid or duplicate Release-Bump footer in ${commit.hash}`)
    }
    const unresolved = isRevert && (!reverted || !inRange.has(reverted))
    const decision = footers[0]?.[1].trim() ?? (unresolved ? revertBump : undefined)
    if (isRevert && decision === undefined && (!reverted || !inRange.has(reverted))) {
      throw new Error(`Revert ${commit.hash} cannot be cancelled within this release. Review compatibility and add Release-Bump: none|patch|minor|major to its squash commit message, or manually run Auto Release with revert_bump selected.`)
    }
    // An explicit decision opts out of automatic cancellation (e.g. partial reverts).
    if (reverted && decision === undefined) {
      ignored.add(reverted)
      continue
    }
    if (decision !== undefined) decisions.push(decision)
    messages.push(commit.message)
  }
  if (decisions.includes('major') || messages.some(message => /^[a-z]+(?:\([^)]+\))?!:/.test(message) || /^BREAKING[ -]CHANGE:/m.test(message))) return 'major'
  if (decisions.includes('minor') || messages.some(message => /^feat(?:\([^)]+\))?:/.test(message))) return 'minor'
  if (decisions.includes('patch') || messages.some(message => /^fix(?:\([^)]+\))?:/.test(message))) return 'patch'
  return 'none'
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim()
  let tag = ''
  try { tag = git(['describe', '--tags', '--abbrev=0']) } catch { /* First release. */ }
  const range = tag ? [`${tag}..HEAD`] : []
  const hashes = git(['log', ...range, '--format=%H']).split('\n').filter(Boolean)
  const commits = hashes.map(hash => ({ hash, message: git(['show', '-s', '--format=%B', hash]) }))
  const bump = decideBump(commits, process.env.RELEASE_REVERT_BUMP || undefined)
  console.log(`Analysing commits since ${tag || 'start'}; selected bump: ${bump}`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `bump=${bump}\n`)
}
