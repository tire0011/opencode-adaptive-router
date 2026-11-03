import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { autoMode } from '../src/auto-state.mjs'

const ref = (providerID, id) => ({ providerID, id })

test('selecting Auto enables routing', () => assert.equal(autoMode(ref('adaptive-router','auto')), 'start'))
test('plugin-selected real model keeps Auto active', () => {
  assert.equal(autoMode(ref('mock','cheap'), {enabled:true,lastSelected:ref('mock','cheap')}), 'continue')
})
test('manual model change disables Auto', () => {
  assert.equal(autoMode(ref('mock','pricey'), {enabled:true,lastSelected:ref('mock','cheap')}), 'stop')
})
test('manual selection without Auto state stays manual', () => {
  assert.equal(autoMode(ref('mock','pricey')), 'off')
})
test('legacy on command enables routing before first selection', () => {
  assert.equal(autoMode(ref('mock','pricey'), {enabled:true}), 'continue')
})
test('missing session model does not drop already enabled Auto state', () => {
  assert.equal(autoMode(undefined, {enabled:true,lastSelected:ref('mock','cheap')}), 'continue')
})
