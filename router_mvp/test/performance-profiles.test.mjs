import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {selectModel} from '../src/selector.mjs';

const ids = ['small','mid','large'];
const models = ids.map(id => ({providerID:'local',id,capabilities:{tools:true},cost:[],enabled:true}));
const options = {currentProvider:'local',allowedModels:ids.map(id=>`local/${id}`),fallbackModel:{providerID:'local',id:ids[1]}};

test('unpriced internal profiles provide provisional task-tier defaults', () => {
  for (const [tier, expected] of [['simple',ids[0]],['medium',ids[1]],['complex',ids[2]]]) {
    assert.equal(selectModel(models,{...options,taskTier:tier})?.id,expected);
  }
});

test('comparative user feedback overrides provisional profiles', () => {
  const stats = Object.fromEntries(ids.map(id=>[`simple:local/${id}`,{positive:id===ids[2]?9:0,negative:id===ids[2]?0:9}]));
  assert.equal(selectModel(models,{...options,taskTier:'simple',feedbackStats:stats})?.id,ids[2]);
});

test('insufficient comparative feedback leaves the provisional default intact', () => {
  const stats = {[`simple:local/${ids[2]}`]:{positive:8,negative:0}};
  assert.equal(selectModel(models,{...options,taskTier:'simple',feedbackStats:stats})?.id,ids[0]);
});

test('tool support and explicit allowlist override performance profiles', () => {
  const limited = models.map(m=>m.id===ids[0]?{...m,capabilities:{tools:false}}:m);
  assert.equal(selectModel(limited,{...options,taskTier:'simple'})?.id,ids[1]);
  assert.equal(selectModel(models.map(m=>({...m,capabilities:{}})),options),undefined);
  assert.equal(selectModel(models,{...options,allowedModels:[`local/${ids[1]}`],taskTier:'complex'})?.id,ids[1]);
  assert.equal(selectModel(models,{...options,currentProvider:'anthropic'}),undefined);
});
