import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {forecastWithInputs} from '../src/reforecast.js';
import {workingFm,FM_GROUPS,SCENARIO_GROUPS,CONTROL_GROUPS,fmtInput,parseInput,READONLY_CONTROLS} from '../src/inputs.js';
const d=JSON.parse(await readFile(new URL('../src/model-data.json',import.meta.url),'utf8'));
const fm=JSON.parse(await readFile(new URL('../src/fm-data.json',import.meta.url),'utf8'));
const s=d.scenarios.find(x=>x.model==='Partner Colo'&&x.property==='Lease');
test('input pages account for every editable workbook field',()=>{
 const cs=new Set(CONTROL_GROUPS.flatMap(x=>x[1]));const ss=new Set(SCENARIO_GROUPS.flatMap(x=>x[1]));const fs=new Set(FM_GROUPS.flatMap(x=>x[1]));
 for(const key of Object.keys(d.controls))assert.ok(cs.has(key)||['Selected scenario — from Decision','Selected hold'].includes(key),'control: '+key);
 for(const key of Object.keys(s.assumptions))assert.ok(ss.has(key)||key==='Business code','scenario: '+key);
 for(const key of Object.keys(fm[s.model]))assert.ok(fs.has(key),'FM: '+key);
});
test('percentage inputs accept human readable percentage and preserve fractional model values',()=>{
 assert.equal(parseInput('7.5','scenario','Facility cap rate'),.075);
 assert.equal(fmtInput(.075,'scenario','Facility cap rate'),'7.5');
 assert.equal(parseInput('0.105','control','Delivered electricity'),.105);
 assert.equal(parseInput('1,250,000','scenario','MEP hard cost per IT MW'),1250000);
 assert.equal(fmtInput(1250000,'scenario','MEP hard cost per IT MW'),'1,250,000');
});
test('change in FM technician payroll reduces year-three EBITDA',()=>{
 const b=forecastWithInputs(s,d.controls),r=forecastWithInputs(s,d.controls,{}, {}, {'Loaded technician pay':175000});
 assert.ok(r.year3EBITDA<b.year3EBITDA);
 assert.equal(r.initialEquity,b.initialEquity);
});
test('open book and fixed scope never sum as additive vendor cost',()=>{
 const f=workingFm(s,fm);assert.equal(f['DIRECT REIMBURSABLE O&M'],5000000);
 assert.equal(f['OPEN-BOOK TOTAL'],5600000);
 const fixed=forecastWithInputs(s,d.controls,{}, {'FM service model':2});
 const base=forecastWithInputs(s,d.controls);
 assert.ok(fixed.year3EBITDA<base.year3EBITDA);
 assert.ok(Math.abs((base.year3EBITDA-fixed.year3EBITDA)-400000*(1.025**2))<1000);
});
test('landlord shell pricing increases operating expense only for lease cases',()=>{
 const base=forecastWithInputs(s,d.controls);const high=forecastWithInputs(s,d.controls,{'Annual lease rate':18});
 assert.ok(high.year3EBITDA<base.year3EBITDA);
 const own=d.scenarios.find(x=>x.model==='Partner Colo'&&x.property==='Own');
 assert.equal(forecastWithInputs(own,d.controls,{'Annual lease rate':18}).year3EBITDA,forecastWithInputs(own,d.controls).year3EBITDA);
});
test('refinancing disabled can require extra equity at maturity',()=>{
 const r=forecastWithInputs(s,d.controls,{'Refinance enabled':0});
 assert.ok(r.annual[6].newEquityCall>0);
});
test('construction schedule changes preserve cash sources and project funding',()=>{
 for(const n of [12,30,48]){
  const r=forecastWithInputs(s,d.controls,{'Build months':n});
  const eq=r.development.reduce((v,row)=>v+row.equity,0),debt=r.development.reduce((v,row)=>v+row.debt,0);
  assert.equal(r.development.length,n+1);
  assert.ok(Math.abs(eq-r.initialEquity)<2);
  assert.ok(Math.abs(eq+debt-r.totalFunding)<2);
 }
});


import {TOOLTIPS,missingTooltips} from '../src/tooltips.js';
import {FM_DERIVED} from '../src/inputs.js';
test('every displayed financial input and FM calculated field has detailed tooltip content',()=>{
 for(const [section,groups] of [['control',CONTROL_GROUPS],['scenario',SCENARIO_GROUPS],['fm',FM_GROUPS],['fm',[['Derived',FM_DERIVED]]]]){
  assert.deepEqual(missingTooltips(groups,section),[]);
  for(const [,keys] of groups)for(const key of keys){const entry=TOOLTIPS[section][key];assert.equal(entry.length,3);for(const paragraph of entry)assert.ok(paragraph.length>20,`${section}:${key} too short`);}
 }
});
