import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {selectModel} from '../src/selector.mjs';

const ids = ['ministral-3-14b-instruct-2512','qwen-3.8-27b','deepseek-v4.1-flash'];
const models = ids.map(id => ({providerID:'siemens',id,capabilities:{tools:true},cost:[],enabled:true}));
const options = {currentProvider:'siemens',allowedModels:ids.map(id=>`siemens/${id}`),fallbackModel:{providerID:'siemens',id:ids[1]}};

test('unpriced Siemens profiles provide provisional task-tier defaults', () => {
  for (const [tier, expected] of [['simple',ids[0]],['medium',ids[1]],['complex',ids[2]]]) {
    assert.equal(selectModel(models,{...options,taskTier:tier})?.id,expected);
  }
});

test('comparative user feedback overrides provisional profiles', () => {
  const stats = Object.fromEntries(ids.map(id=>[`simple:siemens/${id}`,{positive:id===ids[2]?9:0,negative:id===ids[2]?0:9}]));
  assert.equal(selectModel(models,{...options,taskTier:'simple',feedbackStats:stats})?.id,ids[2]);
});

test('insufficient comparative feedback leaves the provisional default intact', () => {
  const stats = {[`simple:siemens/${ids[2]}`]:{positive:8,negative:0}};
  assert.equal(selectModel(models,{...options,taskTier:'simple',feedbackStats:stats})?.id,ids[0]);
});

test('tool support and explicit allowlist override performance profiles', () => {
  const limited = models.map(m=>m.id===ids[0]?{...m,capabilities:{tools:false}}:m);
  assert.equal(selectModel(limited,{...options,taskTier:'simple'})?.id,ids[1]);
  assert.equal(selectModel(models.map(m=>({...m,capabilities:{}})),options),undefined);
  assert.equal(selectModel(models,{...options,allowedModels:[`siemens/${ids[1]}`],taskTier:'complex'})?.id,ids[1]);
  assert.equal(selectModel(models,{...options,currentProvider:'anthropic'}),undefined);
});
