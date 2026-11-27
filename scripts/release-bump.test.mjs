import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decideBump } from './release-bump.mjs'
const feat = { hash: 'a'.repeat(40), message: 'feat: banner' }
const revert = { hash: 'b'.repeat(40), message: `Revert "feat: banner"\n\nThis reverts commit ${feat.hash}.` }
const fix = { hash: 'c'.repeat(40), message: 'fix(ci): runtime' }
test('ignores an unreleased feature and its revert', () => assert.equal(decideBump([fix, revert, feat]), 'patch'))
test('a reverted feature alone needs no release', () => assert.equal(decideBump([revert, feat]), 'none'))
test('reverting a revert restores the feature', () => assert.equal(decideBump([{ hash: 'd'.repeat(40), message: `Revert revert\n\nThis reverts commit ${revert.hash}.` }, revert, feat]), 'minor'))
test('keeps unrelated features', () => assert.equal(decideBump([revert, feat, { hash: 'e'.repeat(40), message: 'feat: other' }]), 'minor'))
test('ignores reverted breaking changes', () => assert.equal(decideBump([fix, revert, { ...feat, message: 'feat!: breaking' }]), 'patch'))
test('retains major priority', () => assert.equal(decideBump([fix, { ...feat, message: 'feat!: breaking' }]), 'major'))
test('blocks a released revert without an explicit decision, even alongside fixes', () => {
  assert.throws(() => decideBump([fix, revert]), /Release-Bump/)
})
test('accepts explicit release levels for released reverts', () => {
  for (const level of ['none', 'patch', 'minor', 'major']) {
    assert.equal(decideBump([{ ...revert, message: `${revert.message}\n\nRelease-Bump: ${level}` }]), level)
  }
})
test('an explicit decision cannot suppress unrelated changes', () => {
  assert.equal(decideBump([feat, { ...revert, message: 'Revert published change\n\nThis reverts commit ' + 'f'.repeat(40) + '.\n\nRelease-Bump: none' }]), 'minor')
})
test('blocks malformed or conflicting decisions', () => {
  for (const footer of ['Release-Bump: typo', 'Release-Bump: patch\nRelease-Bump: major']) {
    assert.throws(() => decideBump([{ ...revert, message: `${revert.message}\n\n${footer}` }]), /Release-Bump/)
  }
})
test('a revert without a standard target also requires a decision', () => {
  assert.throws(() => decideBump([{ ...revert, message: 'revert: manually undo API' }]), /Release-Bump/)
  assert.equal(decideBump([{ ...revert, message: 'revert: manually undo API\n\nRelease-Bump: major' }]), 'major')
})
test('an explicit decision prevents automatic cancellation of a partial revert', () => {
  assert.equal(decideBump([{ ...revert, message: `${revert.message}\n\nRelease-Bump: patch` }, feat]), 'minor')
})
test('manual recovery classifies unresolved reverts without lowering other changes', () => {
  assert.equal(decideBump([revert], 'patch'), 'patch')
  assert.equal(decideBump([fix, revert], 'none'), 'patch')
  assert.equal(decideBump([revert, feat], 'major'), 'none')
  assert.equal(decideBump([{ ...revert, message: `${revert.message}\n\nRelease-Bump: major` }], 'patch'), 'major')
  assert.throws(() => decideBump([revert], 'invalid'), /Release-Bump/)
})
test('recognizes breaking footers', () => assert.equal(decideBump([{ ...feat, message: 'refactor: api\n\nBREAKING CHANGE: removed API' }]), 'major'))

test('CLI stops before output on a published revert and permits reviewed recovery', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'voice-builder-release-'))
  const git = (...args) => execFileSync('git', args, { cwd, stdio: 'pipe' })
  try {
    git('init')
    git('config', 'user.name', 'Release Test')
    git('config', 'user.email', 'release-test@example.invalid')
    git('config', 'commit.gpgsign', 'false')
    writeFileSync(join(cwd, 'feature.txt'), 'feature')
    git('add', '.')
    git('-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'feat: shipped feature')
    git('tag', 'v1.0.0')
    git('-c', 'core.hooksPath=/dev/null', 'revert', '--no-edit', 'HEAD')
    const output = join(cwd, 'output')
    const script = fileURLToPath(new URL('./release-bump.mjs', import.meta.url))
    const env = { ...process.env, GITHUB_OUTPUT: output, RELEASE_REVERT_BUMP: '' }
    const blocked = spawnSync(process.execPath, [script], { cwd, env, encoding: 'utf8' })
    assert.equal(blocked.status, 1)
    assert.match(blocked.stderr, /Release-Bump/)
    assert.equal(existsSync(output), false)
    const recovered = spawnSync(process.execPath, [script], { cwd, env: { ...env, RELEASE_REVERT_BUMP: 'patch' }, encoding: 'utf8' })
    assert.equal(recovered.status, 0, recovered.stderr)
    assert.equal(readFileSync(output, 'utf8'), 'bump=patch\n')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
