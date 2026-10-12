import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const d=JSON.parse(await readFile(new URL('../src/model-data.json',import.meta.url),'utf8'));
const handlers={}; const elem={innerHTML:'',addEventListener(name,fn){handlers[name]=fn;}};
const storage=new Map();
globalThis.document={getElementById(id){if(id==='app')return elem;return null;},createElement(){return {hidden:true,className:'',id:'',style:{},setAttribute(){},getBoundingClientRect(){return {height:240};}}},body:{appendChild(){}},addEventListener(){}};
globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
globalThis.window={scrollTo(){},print(){},addEventListener(){}};
globalThis.fetch=async()=>({ok:true,json:async()=>d});
await import('../src/app.js?render-validation');
function goto(nav){handlers.click({target:{closest:()=>({dataset:{nav}})}});}
function change(dataset,value){handlers.change({target:{dataset,value}});}
test('default dashboard renders without an exception',()=>{
 assert.match(elem.innerHTML,/One view of the investment decision/);assert.match(elem.innerHTML,/Partner Colo/);
 assert.match(elem.innerHTML,/Equity through commissioning/);
});
test('all navigation pages render and contain controls',()=>{
 for(const [page,needle] of [
  ['options','Compare all 12 structures'],['compare','Compare two structures'],['funding','When capital is actually required'],['cash','Where the cash goes'],
  ['assumptions','Quick sensitivity tests'],['controls','Controls'],['scenarioInputs','Scenario Inputs'],['fmBudget','FM Budget'],['delivery','Who builds, who runs, who pays'],
  ['diligence','Evidence before authorization'],['workspace','Save, share and export']]){
    goto(page);assert.match(elem.innerHTML,new RegExp(needle),page);
  }
});
test('case selections update the scenario by readable name',()=>{
 goto('overview');change({scenarioSelect:''},8);
 assert.match(elem.innerHTML,/GB300 Dedicated — Purchase/);
});
test('assumption sliders trigger visible screening-only change warnings',()=>{
 goto('assumptions');change({edit:'price'},1.1);
 assert.match(elem.innerHTML,/Inputs have been edited/);
});
test('diligence approvals can be changed and persisted',()=>{
 goto('diligence');change({taskStatus:'A01'},'Approved');
 assert.match(elem.innerHTML,/4% approved/);
 assert.ok(storage.has('dc-decision-studio-v1'));
});


test('shared Controls input edits affect the overview and persist',()=>{
 goto('controls'); assert.match(elem.innerHTML,/Delivered electricity/);
 change({editInput:'control',key:'Delivered electricity'},'.105');
 assert.match(elem.innerHTML,/PROVISIONAL FORECAST/);
 assert.match(storage.get('dc-decision-studio-v1'),/Delivered electricity/);
 goto('overview');assert.match(elem.innerHTML,/Inputs have been edited/);
});
test('Scenario Inputs allow numeric edits and reflect a changed capital requirement',()=>{
 goto('scenarioInputs'); assert.match(elem.innerHTML,/MEP hard cost per IT MW/);
 change({editInput:'scenario',key:'MEP hard cost per IT MW'},'16000000');
 assert.match(elem.innerHTML,/matrix-edited/); assert.match(elem.innerHTML,/Project equity/);
});
test('FM Budget updates wage and annual open-book totals',()=>{
 goto('fmBudget'); assert.match(elem.innerHTML,/Concurrent technician posts/);
 const old=elem.innerHTML; change({editInput:'fm',key:'Loaded technician pay'},'175000');
 assert.match(elem.innerHTML,/175,000/); assert.notEqual(elem.innerHTML,old);
});

test('scenario matrix presents every named scenario and edits a nonselected column only',()=>{
 goto('scenarioInputs');
 for(const row of d.scenarios)assert.match(elem.innerHTML,new RegExp(row.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 change({editInput:'scenario',key:'MEP hard cost per IT MW',caseId:'1'},'14,250,000');
 const saved=JSON.parse(storage.get('dc-decision-studio-v1'));
 assert.equal(saved.scenarioEdits['1']['MEP hard cost per IT MW'],14250000);
 assert.match(elem.innerHTML,/14,250,000/);
});
test('FM matrix edits one model even when a different scenario is selected',()=>{
 goto('fmBudget');
 change({editInput:'fm',key:'Loaded technician pay',fmModel:'Traditional Colo'},'195,000');
 const saved=JSON.parse(storage.get('dc-decision-studio-v1'));
 assert.equal(saved.fmEdits['Traditional Colo']['Loaded technician pay'],195000);
 assert.match(elem.innerHTML,/195,000/);
});
test('ranking charts share the sorted scenario order',()=>{
 goto('options');change({rank:''},'equity');
 assert.match(elem.innerHTML,/same top-to-bottom order as the ranking table/i);
 const rowNames=[...elem.innerHTML.matchAll(/<span class="rank-plot-name"><em>\d+\.<\/em> ([^<]+)/g)].map(x=>x[1]);
 const tableNames=[...elem.innerHTML.matchAll(/class="btn ghost small case-name" data-pick="\d+">([^<]+)/g)].map(x=>x[1].split(' ↗')[0]);
 assert.equal(rowNames.length,12);assert.deepEqual(rowNames,tableNames);
});

test('both input matrices have the intended comparison columns',()=>{
 goto('scenarioInputs');assert.equal((elem.innerHTML.match(/class="matrix-col-head/g)||[]).length,12);
 assert.equal((elem.innerHTML.match(/data-case-id="\d+"/g)||[]).length>12,true);
 goto('fmBudget');assert.equal((elem.innerHTML.match(/class="matrix-col-head/g)||[]).length,6);
 assert.match(elem.innerHTML,/OPEN-BOOK TOTAL/);
});

function action(act){handlers.click({target:{closest:()=>({dataset:{action:act}})}});}

test('local personal defaults store independently from current editable state',()=>{
 goto('controls');
 change({editInput:'control',key:'Delivered electricity'},'0.118');
 goto('workspace');assert.match(elem.innerHTML,/Save current as my defaults/);
 action('save-personal-defaults');
 assert.equal(JSON.parse(storage.get('dc-decision-studio-personal-defaults-v1')).controlEdits['Delivered electricity'],0.118);
 goto('controls');change({editInput:'control',key:'Delivered electricity'},'0.145');
 goto('workspace');action('load-personal-defaults');
 assert.equal(JSON.parse(storage.get('dc-decision-studio-v1')).controlEdits['Delivered electricity'],0.118);
});

test('clearing this browser removes private workspace and personal default snapshot',()=>{
 goto('workspace');action('clear-local-workspace');
 assert.equal(storage.has('dc-decision-studio-v1'),false);
 assert.equal(storage.has('dc-decision-studio-personal-defaults-v1'),false);
 assert.match(elem.innerHTML,/One view of the investment decision/);
});
