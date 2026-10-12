/* Screening engine. Unedited cases are exact cached-workbook reference values.
   Edited cases are modeled sensitivities, NOT a fully re-underwritten model. */
export const dollars=v=>!Number.isFinite(+v)?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
export const mm=v=>!Number.isFinite(+v)?'—':'$'+(v/1e6).toFixed(1)+'M';
export const pct=(v,d=1)=>!Number.isFinite(+v)?'—':(v*100).toFixed(d)+'%';
export const compact=v=>!Number.isFinite(+v)?'—':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(v);
export const fmtNum=v=>!Number.isFinite(+v)?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(v);
export const blankMods=()=>({price:1,capex:1,power:1,ltcOffset:0,delay:0});
export function isModified(mod){return Object.entries(mod||{}).some(([k,v])=>Math.abs(v-(k==='ltcOffset'||k==='delay'?0:1))>1e-7);}
export function priceBase(s){return s.model.includes('Dedicated')?s.assumptions['Dedicated rate']:s.assumptions['Infrastructure rent'];}
export function getLtc(s){return Number(s.assumptions['Facility LTC'])||.6;}
export function scenarioCash(s,mod=blankMods()){
 const m={...blankMods(),...mod};
 const isCompute=s.model.includes('Dedicated');
 const baseHard=(+s.assumptions['MEP hard cost per IT MW']||0)*s.mw;
 const surcharges=['EOR and design','Developer delivery fee','Independent commissioning','Owner engineer / QS','Sponsor development fee','Extra GC margin','Contingency'].reduce((a,k)=>a+(Number(s.assumptions[k])||0),1);
 const eligible=(baseHard*surcharges)+(Number(s.assumptions['External utility works'])||0);
 const capexDelta=baseHard*surcharges*(m.capex-1);
 const oldLtc=getLtc(s);const newLtc=Math.min(.85,Math.max(0.05,oldLtc+m.ltcOffset));
 const newFacilityDebt=eligible*oldLtc+(eligible+capexDelta)*(newLtc-oldLtc)+capexDelta*oldLtc;
 const debtDelta=newFacilityDebt-eligible*oldLtc;
 const initEquity=s.initialEquity+capexDelta-debtDelta;
 const years=s.annual.map((b,i)=>{
   const rentBill=b.infraRent||0; const computeBill=(b.computeBill||0)+(b.ancillary||0);
   const salesBase=isCompute?computeBill:rentBill;
   const revenueDelta=salesBase*(m.price-1)+(b.powerRecovery||0)*(m.power-1);
   const expenseDelta=(b.powerCost||0)*(m.power-1)+(isCompute?(b.sales||0)*(m.price-1):0);
   const operatingDelta=revenueDelta-expenseDelta;
   const facilityVariable=(b.maintenanceCapex||0)*(m.capex-1);
   const rate=Number(s.assumptions['Facility term rate'])||0.08;
   const n=Math.max(1,Number(s.assumptions['Facility amortization'])||20);
   const ann=rate?debtDelta*(rate/(1-Math.pow(1+rate,-n))):debtDelta/n;
   const debtServiceDelta=i===0?debtDelta*rate:ann;
   const netEq=(b.netEquityFlow||0)+operatingDelta-facilityVariable-debtServiceDelta;
   return {...b,revenue:b.revenue+revenueDelta,ebitda:b.ebitda+operatingDelta,netEquityFlow:netEq,equityDistribution:Math.max(0,netEq),newEquityCall:Math.max(0,-netEq),powerCost:b.powerCost*m.power,infraRent:b.infraRent*m.price,computeBill:b.computeBill*m.price,annualOperatingDelta:operatingDelta,debtServiceDelta,extraMaintenance:facilityVariable};
 });
 return {years,initEquity,debtDelta,capexDelta,ltc:newLtc,mods:m,modified:isModified(m)};
}
function annuityRemaining(principal,rate,term,elapsed){
 if(principal===0)return 0;
 const n=Math.max(1,term); const pay=rate?principal*rate/(1-Math.pow(1+rate,-n)):principal/n;
 let bal=principal;
 for(let y=0;y<elapsed;y++)bal=bal*(1+rate)-pay;
 return Math.max(-1e15,Math.min(1e15,bal));
}
function irr(flows,times){
 const npv=r=>flows.reduce((a,f,i)=>a+f/Math.pow(1+r,times[i]),0);
 let lo=-0.95,hi=4,fl=npv(lo),fh=npv(hi);
 if(!Number.isFinite(fl)||!Number.isFinite(fh)||fl*fh>0)return null;
 for(let i=0;i<110;i++){const mid=(lo+hi)/2,fm=npv(mid);if(fl*fm>0){lo=mid;fl=fm;}else hi=mid;}
 return (lo+hi)/2;
}
function calcApproxGross(s,forecast,hold,modified=false){
 let {years,initEquity,mods,debtDelta,capexDelta}=forecast;
 const baseInitial=s.initialEquity;
 // Approximate progress of contributions across the build, anchored as a delta to the workbook's result.
 const shift=(mods.delay||0)/12;
 const series=(adjusted)=>{
  const inv=adjusted?initEquity:baseInitial;
  const flow=[-.01*inv,-.30*inv,-.69*inv];
  const dates=[0,.5,1.5];
  for(let i=0;i<hold;i++){
   const b=s.annual[i], y=adjusted?years[i]:b;
   let sale=b.saleToEquity||0;
   if(adjusted){
    // No merchant GPUaaS goodwill: compute-rate stress changes operational cash only.
    if(!s.model.includes('Dedicated')){
     const capRate=Math.max(.035,Number(s.assumptions['Facility cap rate'])||.075);
     const NOIChange=(y.annualOperatingDelta-y.extraMaintenance);
     sale+=NOIChange/capRate;
    }
    const rate=Number(s.assumptions['Facility term rate'])||.08;
    sale-=annuityRemaining(debtDelta,rate,Number(s.assumptions['Facility amortization'])||20,i+1);
   }
   flow.push((y.netEquityFlow||0)+(i===hold-1?sale:0));dates.push(2+(adjusted?shift:0)+i+1);
  }
  return irr(flow,dates);
 };
 const base=series(false),what=series(true);
 const grossRef=hold===5?s.gross5:hold===10?s.gross10:hold===20?s.gross20:null;
 const interpolated=grossRef;
 const adjusted=(base!==null&&what!==null)?Math.max(-.99,Math.min(5,interpolated+what-base)):null;
 return {base:interpolated,adjusted,shift:what!==null&&base!==null?what-base:null};
}
export function results(s,mod=blankMods(),hold=5){
 const f=scenarioCash(s,mod),modified=f.modified;const annual=f.years;
 const raw=calcApproxGross(s,f,hold,modified);
 const grossIRR=modified?raw.adjusted:raw.base;
 const lpReference=hold===5?s.lpSelected:null;
 const lpIRR=modified&&hold===5&&Number.isFinite(raw.shift)?s.lpSelected+raw.shift:lpReference;
 const sponsorEquity=f.initEquity*0.05;
 const yy=annual[2]||{};
 const sumFuture=annual.reduce((acc,x)=>acc+(x.newEquityCall||0),0);
 return {scenario:s,forecast:f,annual,grossIRR,lpIRR,initialEquity:f.initEquity,totalFunding:s.totalFunding+f.capexDelta,year3EBITDA:yy.ebitda,year3Dist:yy.equityDistribution,year3Yield:yy.equityDistribution/f.initEquity,sponsorEquity,modified,hold,additionalCalls:sumFuture,refType:modified?'Screening estimate':'Exact workbook reference'};
}
export function compareRisk(s,r,taskList){
 const opens=taskList.filter(x=>x.status!=='Approved'&&x.status!=='Waived').length;
 const cs=[];
 if(r.grossIRR!=null&&r.grossIRR<.15)cs.push('Below 15% gross equity return screening hurdle');
 if(s.model.includes('Dedicated'))cs.push('Customer reservation, OEM hardware and equipment financing must be verified');
 if(s.property==='Lease')cs.push('Enforceable leasehold term and lender step-in rights required');
 if(opens)cs.push(`${opens} diligence items remain open in the workspace`);
 if(r.modified)cs.push('Scenario inputs modified; economics are preliminary screening sensitivities');
 return cs;
}
export const SCENARIO_FIELDS={price:{label:'Customer price',unit:'x baseline',min:0.65,max:1.4,step:0.01},capex:{label:'Facility construction cost',unit:'x baseline',min:0.7,max:1.5,step:0.01},power:{label:'Delivered power cost',unit:'x baseline',min:0.65,max:1.6,step:0.01},ltcOffset:{label:'Facility borrowing adjustment',unit:'percentage points',min:-0.3,max:0.2,step:0.01},delay:{label:'Commissioning delay',unit:'months',min:0,max:24,step:1}};
