import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { selectModel } from '../src/selector.mjs';

const model = (providerID, id, price, extra = {}) => ({
  providerID, id, enabled: true, capabilities: { tools: true },
  cost: [{ input: price, output: price }], limit: { context: 100000 }, ...extra,
});

test('returns undefined with no candidates', () => assert.equal(selectModel([]), undefined));
test('selects lowest known cost', () => {
  assert.equal(selectModel([model('p','expensive',5), model('p','cheap',1)])?.id, 'cheap');
});
test('filters unsupported and disabled models', () => {
  assert.equal(selectModel([model('p','cheap',0,{capabilities:{tools:false}}), model('p','ok',2)])?.id,'ok');
});
test('stays on current provider unless explicitly allowed', () => {
  const models = [model('external','cheap',0), model('internal','safe',2)];
  assert.equal(selectModel(models,{currentProvider:'internal'})?.id,'safe');
  assert.equal(selectModel(models,{currentProvider:'internal',crossProvider:true})?.id,'cheap');
});
test('unknown cost loses to known cost', () => {
  assert.equal(selectModel([model('p','unknown',0,{cost:[]}),model('p','known',2)])?.id,'known');
});
