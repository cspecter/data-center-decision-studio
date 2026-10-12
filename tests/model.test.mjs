import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {results,scenarioCash,blankMods,isModified,mm,pct} from '../src/model.js';
const data=JSON.parse(await readFile(new URL('../src/model-data.json',import.meta.url),'utf8'));
test('twelve scenario sheets and twenty full operating years are extracted',()=>{
 assert.equal(data.scenarios.length,12);
 for(const s of data.scenarios){assert.equal(s.annual.length,20);assert.deepEqual(s.annual.map(x=>x.year),Array.from({length:20},(_,i)=>i+1));assert.ok(s.initialEquity>0);}
});
test('unmodified outputs preserve exact workbook baseline comparison and annual rows',()=>{
 for(const s of data.scenarios){const r=results(s,blankMods(),5);assert.equal(r.initialEquity,s.initialEquity);assert.equal(r.grossIRR,s.gross5);assert.equal(r.lpIRR,s.lpSelected);assert.equal(r.annual[2].ebitda,s.year3ebitda);assert.equal(r.annual[2].equityDistribution,s.year3distribution);assert.ok(!r.modified);}
});
test('positive customer pricing sensitivity increases year three earnings',()=>{
 for(const s of data.scenarios){const base=results(s),hi=results(s,{...blankMods(),price:1.10});assert.ok(hi.year3EBITDA>base.year3EBITDA,s.shortName);assert.ok(hi.modified);}
});
test('higher facility cost increases total development funding',()=>{
 for(const s of data.scenarios){const base=results(s),hi=results(s,{...blankMods(),capex:1.2});assert.ok(hi.totalFunding>base.totalFunding);assert.ok(hi.initialEquity>base.initialEquity);}
});
test('borrowed percentage changes sponsor initial equity opposite direction',()=>{
 for(const s of data.scenarios){const base=results(s),hi=results(s,{...blankMods(),ltcOffset:.05});assert.ok(hi.initialEquity<base.initialEquity);}
});
test('negative equity calls do not become positive distributions',()=>{
 const s=data.scenarios.find(x=>x.shortName==='Partner Colo - Lease');const f=scenarioCash(s);
 for(const y of f.years){assert.ok(y.equityDistribution>=0);assert.ok(y.newEquityCall>=0);assert.equal(y.equityDistribution*y.newEquityCall,0);}
});
test('formatting distinguishes millions and percentages',()=>{assert.equal(mm(12500000),'$12.5M');assert.equal(pct(.24),'24.0%');assert.equal(isModified(blankMods()),false);});
test('monthly development source uses and financing reconcile for each structure',()=>{
 for(const s of data.scenarios){
   assert.equal(s.development.length,25);
   const totalEq=s.development.reduce((sum,m)=>sum+m.equity,0);
   const totalSources=s.development.reduce((sum,m)=>sum+m.equity+m.debt,0);
   assert.ok(Math.abs(totalEq-s.initialEquity)<1,s.name);
   assert.ok(Math.abs(totalSources-s.totalFunding)<1,s.name);
 }
});
test('construction delay lowers approximate IRR without altering annual revenue amount',()=>{
 const s=data.scenarios.find(s=>s.shortName==='GB300 Dedicated - Lease');
 const orig=results(s),late=results(s,{...blankMods(),delay:12});
 assert.ok(late.grossIRR<orig.grossIRR);
 assert.equal(late.annual[2].revenue,orig.annual[2].revenue);
});
