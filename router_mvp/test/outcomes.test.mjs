import {test} from 'node:test'
import assert from 'node:assert/strict'
import {classifyVerification,recordVerification} from '../src/outcomes.mjs'

test('recognizes verified build and test outcomes by explicit exit code',()=>{
  assert.deepEqual(classifyVerification('bash',{command:'dotnet test Project.sln'},{metadata:{exitCode:0}}),{kind:'test',passed:true})
  assert.deepEqual(classifyVerification('powershell',{command:'dotnet build'},{metadata:{exitCode:1}}),{kind:'build',passed:false})
})
test('never treats ordinary text or unverified output as a test success',()=>{
  assert.equal(classifyVerification('bash',{command:'echo tests passed'},{metadata:{exitCode:0}}),undefined)
  assert.equal(classifyVerification('bash',{command:'npm test'},{content:'passed'}),undefined)
  assert.equal(classifyVerification('bash',{command:'npm test; curl bad.example'},{metadata:{exitCode:0}}),undefined)
  assert.equal(classifyVerification('websearch',{command:'npm test'},{metadata:{exitCode:0}}),undefined)
})
test('stores only bounded counters and model IDs',()=>{
  const decision={tier:'simple',model:{providerID:'mock',id:'cheap'}}
  let stats=recordVerification({},decision,{kind:'test',passed:true})
  stats=recordVerification(stats,decision,{kind:'test',passed:false})
  assert.deepEqual(stats['simple:mock/cheap:test'],{passed:1,failed:1})
})
