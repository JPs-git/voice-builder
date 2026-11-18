import { test } from 'node:test'
import assert from 'node:assert/strict'
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
test('reverting an already released feature is a patch', () => assert.equal(decideBump([revert]), 'patch'))
test('recognizes breaking footers', () => assert.equal(decideBump([{ ...feat, message: 'refactor: api\n\nBREAKING CHANGE: removed API' }]), 'major'))
