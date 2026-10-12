import {results as workbookResults,blankMods,isModified} from './model.js';
import {effective,workingFm} from './inputs.js';
import FM from './fm-data.json' with {type:'json'};

/* A transparent, workbook-anchored what-if engine. It applies changes to the
   original dated capital and annual schedules. It is NOT a bankable full Excel
   formula port. Unedited scenarios pass through exactly without alterations. */
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const ratio=(a,b)=>b?Math.max(0,a/b):a===b?1:0;
const pv=(p,r,n)=>r? p*r/(1-Math.pow(1+r,-Math.max(1,n))):p/Math.max(1,n);
const yearMult=(from,to,i)=>Math.pow((1+from)/(1+to),i);
function xirr(flows,dates){
 const npv=r=>flows.reduce((sum,x,i)=>sum+x/Math.pow(1+r,dates[i]),0);
 let low=-.95,high=5,a=npv(low),b=npv(high);
 if(!Number.isFinite(a)||!Number.isFinite(b)||a*b>0)return null;
 for(let i=0;i<110;i++){let mid=(low+high)/2,v=npv(mid);if(a*v>0){low=mid;a=v;}else high=mid;}
 return (low+high)/2;
}
function val(controls,overrides,key){return +effective(+controls[key]?.value||0,overrides,key);}
function defaultChanged(obj){return !!obj&&Object.keys(obj).length>0;}

function facilityDebtPlan({principal,yearRows,first,interval,enabled,maturity,initialRate,initialIO,initialAmort,refiRate,refiAmort,refiLTV,refiDSCR,refiFee}){
 let balance=Math.max(0,principal),start=0,rate=initialRate,period=Math.max(1,initialAmort),opening=balance,loanMaturity=maturity;
 let output=[];
 for(let i=0;i<yearRows.length;i++){
  const y=i+1,io=y<=initialIO,interest=balance*rate;
  const payment=io?interest:pv(opening,rate,period),principalPayment=Math.min(balance,Math.max(0,payment-interest));
  balance=Math.max(0,balance-principalPayment);
  let refiCash=0;
  const refinancing=Boolean(enabled)&&(y===first||y>first&&(y-first)%Math.max(1,interval)===0);
  if(refinancing||y===loanMaturity){
   const old=balance;let newLoan=0;
   if(refinancing){const v=Math.max(0,yearRows[i]?.facilityValue||0);const vCeiling=v*refiLTV;
    const cfads=Math.max(0,yearRows[i]?.ebitda-yearRows[i]?.maintenanceCapex);
    const nextDebtPaymentCapacity=cfads/Math.max(1.0,refiDSCR);
    const annuityPerDollar=pv(1,refiRate,refiAmort);
    newLoan=Math.max(0,Math.min(vCeiling,annuityPerDollar?nextDebtPaymentCapacity/annuityPerDollar:0));
   }
   refiCash=newLoan-old-newLoan*(refinancing?refiFee:0);
   balance=newLoan;opening=newLoan;rate=refiRate;period=refiAmort;
   loanMaturity=refinancing?y+Math.max(1,interval):Infinity;
  }
  output.push({debtService:interest+principalPayment,refiCash,netCash:-(interest+principalPayment)+refiCash,balance});
 }
 return output;
}

export function forecastWithInputs(s,allControls,controlEdits={},scenarioEdits={},fmEdits={},mods=blankMods(),hold=5){
 const old=workbookResults(s,blankMods(),hold);
 const touched=defaultChanged(controlEdits)||defaultChanged(scenarioEdits)||defaultChanged(fmEdits)||isModified(mods);
 if(!touched)return {...old,development:s.development,controlChanged:false,inputCounts:{control:0,scenario:0,fm:0}};
 const c=k=>val(allControls,controlEdits,k),a=k=>+effective(+s.assumptions[k]||0,scenarioEdits,k),a0=k=>+s.assumptions[k]||0;
 const oldFm=workingFm(s,FM);const fm=workingFm(s,FM,fmEdits);
 const owner=s.property==='Own',compute=s.model.includes('Dedicated');const baseMW=s.mw;
 const newMW=Math.max(0.1,Math.min(+a('IT override kW')||1e10,c('Utility service MW')*1000/Math.max(1,a('PUE'))*(1-c('Capacity reserve')))/1000);
 const capacityRatio=newMW/baseMW;
 const hardwareRatio=compute?capacityRatio*ratio(a('Billable units/system'),a0('Billable units/system'))*ratio(a0('System power kW'),a('System power kW'))*(1-a('Fabric/storage power'))/Math.max(.01,1-a0('Fabric/storage power')):1;
 const baseHard=baseMW*a0('MEP hard cost per IT MW');
 const softNames=['EOR and design','Developer delivery fee','Independent commissioning','Owner engineer / QS','Sponsor development fee','Extra GC margin','Contingency'];
 const oldSoft=1+softNames.reduce((n,k)=>n+a0(k),0),newSoft=1+softNames.reduce((n,k)=>n+a(k),0);
 const hard=(newMW*a('MEP hard cost per IT MW')*mods.capex*c('Cost stress'));
 const oldFacility=baseHard*oldSoft+a0('External utility works')+c('Additional shell budget')*0;
 const newFacility=hard*newSoft+a('External utility works')+(c('Asset basis')===2?c('Additional shell budget'):0);
 const deltaFacility=newFacility-oldFacility;
 const oldHardware=compute?(a0('System/rack capex')*Math.floor(baseMW*1000*(1-a0('Fabric/storage power'))/Math.max(0.001,a0('System power kW'))))*(1+a0('External fabric capex')+a0('Spares/freight allowance')):0;
 const hardwareUnit=compute?a('System/rack capex')*Math.floor(newMW*1000*(1-a('Fabric/storage power'))/Math.max(.001,a('System power kW'))):0;
 const hardware=hardwareUnit*(1+a('External fabric capex')+a('Spares/freight allowance'));
 const deltaHardware=(hardware-oldHardware)+a('Initial platform setup')-a0('Initial platform setup');
 const oldLease=c('Annual lease rate');const oldPrice=allControls['Purchase price']?.value||0;
 const deltaProperty=owner?(c('Purchase price')-oldPrice)*(1+c('Purchase closing costs')):(c('Building area')/100000-1)*0;
 const oldFacilityDebt=s.initialEquity ? (oldFacility*a0('Facility LTC')) : 0;
 const newFacilityDebt=Math.max(0,newFacility*clamp(a('Facility LTC')+mods.ltcOffset,0,.98));
 const deltaFacilityDebt=newFacilityDebt-oldFacilityDebt;
 const oldEquipmentDebt=oldHardware*a0('Equipment advance');const newEquipmentDebt=hardware*clamp(a('Equipment advance'),0,.98);
 const deltaEquipmentDebt=newEquipmentDebt-oldEquipmentDebt;
 const deltaAcquisitionDebt=owner?(c('Purchase price')*c('Acquisition debt LTV')-oldPrice*(+allControls['Acquisition debt LTV'].value||0)):0;
 const extraCarry=(c('Build months')-24)*(owner?0:c('Building area')*c('Annual lease rate')/12)+((hard-baseHard)/24)*(a('Construction rate')-a0('Construction rate'))*24/2;
 const bufferDiff=(c('Operating cash buffer')-(+allControls['Operating cash buffer'].value||0))+(c('Diligence budget')-(+allControls['Diligence budget'].value||0))+(c('Preopening budget')-(+allControls['Preopening budget'].value||0));
 const financeFeeDelta=(newFacilityDebt*a('Facility finance fee')-oldFacilityDebt*a0('Facility finance fee'))+(newEquipmentDebt*a('Equipment finance fee')-oldEquipmentDebt*a0('Equipment finance fee'));
 const deltaEquity=deltaFacility+deltaHardware+deltaProperty+extraCarry+bufferDiff+financeFeeDelta-deltaFacilityDebt-deltaEquipmentDebt-deltaAcquisitionDebt;
 const initialEquity=Math.max(1000,s.initialEquity+deltaEquity);
 const totalFunding=Math.max(1000,s.totalFunding+deltaFacility+deltaHardware+deltaProperty+extraCarry+bufferDiff+financeFeeDelta);
 const oldRevenueFM=oldFm['ACTIVE ANNUAL FM BUDGET'];
 const inflationControl=+allControls['Operating cost inflation'].value||0.025;
 const baseFMModel=a0('FM service model');
 const billFloor=a('Contract billing floor');
 const powerBase=+allControls['Delivered electricity'].value||.085;
 const baseDays=+allControls['Receivable days'].value||45;
 const billOld=(s.annual[2]?.billedShare||.9);
 let previous={ar:0,ap:0};
 let years=[];
 for(let ix=0;ix<20;ix++){
  const y=ix+1,b=s.annual[ix],age=Math.floor(ix/Math.max(1,a('Hardware replacement years'))),origAge=Math.floor(ix/Math.max(1,a0('Hardware replacement years')));
  const baseBilled=(b.billedShare||0);
  const occup=ix===0?a('Year 1 occupancy'):ix===1?a('Year 2 occupancy'):a('Stabilized occupancy');
  const baselineOcc=ix===0?a0('Year 1 occupancy'):ix===1?a0('Year 2 occupancy'):a0('Stabilized occupancy');
  const newBilled=compute?billFloor:Math.max(occup,billFloor);
  const oldBilled=compute?Math.max(.001,a0('Contract billing floor')):Math.max(baselineOcc,a0('Contract billing floor'));
  const rolloverOld=(ix>=a0('Initial contract term'))?a0('Renewal retention')*a0('Renewal price reset'):1;
  const rolloverNew=(ix>=a('Initial contract term'))?a('Renewal retention')*a('Renewal price reset'):1;
  const roll=ratio(rolloverNew,rolloverOld)*ratio(1-(ix===a('Initial contract term')?a('Rollover downtime'):0),1-(ix===a0('Initial contract term')?a0('Rollover downtime'):0));
  const infraRateRatio=ratio(a('Infrastructure rent'),a0('Infrastructure rent'))*yearMult(a('Rent escalator'),a0('Rent escalator'),ix)*roll*mods.price*c('Price stress');
  const newInfraRent=compute?0:b.infraRent*capacityRatio*ratio(newBilled,oldBilled)*infraRateRatio*ratio(1-a('SLA / collection allowance'),1-a0('SLA / collection allowance'));
  const equipRateRatio=compute?ratio(a('Dedicated rate'),a0('Dedicated rate'))*capacityRatio*ratio(a('Billable units/system'),a0('Billable units/system'))*ratio(a0('System power kW'),a('System power kW'))*ratio(a('Contract billing floor'),a0('Contract billing floor'))*ratio(c('Annual hours'),+allControls['Annual hours'].value||8760)*roll*mods.price*c('Price stress')*(Math.pow(1+a('New generation price growth'),age*a('Hardware replacement years'))/Math.pow(1+a0('New generation price growth'),origAge*a0('Hardware replacement years'))):1;
  const refreshLoss=compute && y>1 && (y-1)%Math.max(1,a('Hardware replacement years'))===0?Math.max(0,1-a('Refresh downtime')):1;
  const baseRefreshLoss=compute&&b.refreshFlag?Math.max(.01,1-a0('Refresh downtime')):1;
  const newCompute=compute?b.computeBill*equipRateRatio*ratio(refreshLoss,baseRefreshLoss)*ratio(1-a('SLA / collection allowance'),1-a0('SLA / collection allowance')):0;
  const newAncillary=compute?newCompute*a('Ancillary service revenue'):0;
  const powerUseOld=a0('Actual reserved power use')||.7,powerUseNew=a('Actual reserved power use')||.7;
  const powerRatio=ratio(c('Delivered electricity'),powerBase)*mods.power*yearMult(c('Energy escalation'),+allControls['Energy escalation'].value||.025,ix)*capacityRatio*ratio(powerUseNew,powerUseOld)*ratio(a('PUE'),a0('PUE'));
  const idleFactor=compute?(1+Math.max(0,a('Idle equipment draw')-a0('Idle equipment draw'))):1;
  const powerCost=b.powerCost*powerRatio*idleFactor;
  const powerRecovery=compute?0:powerCost*(1+a('Power markup'));
  const revenue=newInfraRent+newCompute+newAncillary+powerRecovery;
  const areaRatio=c('Building area')/Math.max(1,+allControls['Building area'].value||100000);
  const propertyRent=owner?0:b.propertyRent*areaRatio*ratio(c('Annual lease rate'),+allControls['Annual lease rate'].value||10.25)*yearMult(c('Lease escalation'),+allControls['Lease escalation'].value||.035,ix);
  const ownOld=oldPrice*((+allControls['Owned property tax'].value||0)+(+allControls['Owned property insurance'].value||0))+(+allControls['Owned shell maintenance'].value||0);
  const ownNew=c('Purchase price')*(c('Owned property tax')+c('Owned property insurance'))+c('Owned shell maintenance');
  const propertyCosts=owner?b.propertyCosts*ratio(ownNew,ownOld)*yearMult(c('Property cost escalation'),+allControls['Property cost escalation'].value||.025,ix):b.propertyCosts*areaRatio*ratio(c('Annual lease NNN'),+allControls['Annual lease NNN'].value||3.5)*yearMult(c('Lease escalation'),+allControls['Lease escalation'].value||.035,ix);
  const newFMModel=a('FM service model');
  const effectiveFmNew=newFMModel===2?a('Fixed-scope FM annual')+(fmEdits['FIXED-SCOPE ALTERNATIVE']!==undefined?fmEdits['FIXED-SCOPE ALTERNATIVE']-(FM[s.model]?.['FIXED-SCOPE ALTERNATIVE']||0):0):fm['OPEN-BOOK TOTAL'];
  const effectiveFmOld=baseFMModel===2?a0('Fixed-scope FM annual'):oldRevenueFM;
  const fmTotal=b.fmCost+b.fmFee+(effectiveFmNew-effectiveFmOld)*Math.pow(1+c('Operating cost inflation'),ix)+(b.fmCost+b.fmFee)*(yearMult(c('Operating cost inflation'),inflationControl,ix)-1);
  const fmFee=newFMModel===2?0:(fm['FM management fee']||0)*Math.pow(1+c('Operating cost inflation'),ix);
  const fmCost=fmTotal-fmFee;
  const mepInsurance=b.mepInsurance*(newFacility/Math.max(1,oldFacility))*ratio(a('Incremental MEP tax insurance'),a0('Incremental MEP tax insurance'));
  const warranty=compute?b.warranty*ratio(hardware,oldHardware)*ratio(a('Warranty maintenance'),a0('Warranty maintenance')):0;
  const ITInsurance=compute?b.ITInsurance*ratio(hardware,oldHardware)*ratio(a('IT tax insurance'),a0('IT tax insurance')):0;
  const networkCost=compute?b.networkCost*hardwareRatio*ratio(a('Platform network operations'),a0('Platform network operations')):0;
  const computeSupport=compute?b.computeSupport*ratio(a('Compute support staff'),a0('Compute support staff')):0;
  const computeOperatorFee=compute?newCompute*a('Compute operator fee'):0;
  const sales=compute?newCompute*a('Sales/account management'):0;
  const admin=b.admin*ratio(a('Project admin'),a0('Project admin'))*yearMult(c('Operating cost inflation'),inflationControl,ix);
  const sponsorFee=c('Sponsor annual asset fee')*Math.pow(1+c('Operating cost inflation'),ix);
  const opex=powerCost+propertyRent+propertyCosts+fmTotal+mepInsurance+warranty+ITInsurance+networkCost+computeSupport+computeOperatorFee+sales+admin+sponsorFee;
  const ebitda=revenue-opex;
  const maintenanceCapex=b.maintenanceCapex*ratio(hard,baseHard)*ratio(a('Sustaining MEP capital'),a0('Sustaining MEP capital'));
  const ar=revenue*c('Receivable days')/365,ap=(opex-powerCost-propertyRent-propertyCosts)*c('Payable days')/365;
  const deltaWC=(ar-ap)-(previous.ar-previous.ap);previous={ar,ap};
  const rawFacilityDebt=s.annual[0].facilityDebtOpening||0;
  const debtRatio=ratio(rawFacilityDebt+deltaFacilityDebt+deltaAcquisitionDebt,rawFacilityDebt);
  const rateDiff=a('Facility term rate')-a0('Facility term rate');
  const facilityService=(b.facilityDebtService||0)*debtRatio*(1+rateDiff/(a0('Facility term rate')||.075))*(1+(a0('Facility amortization')-a('Facility amortization'))/Math.max(5,a('Facility amortization'))*.25);
  const initialEqDebt=s.annual[0].equipmentDebtService||0;
  const newEquipService=compute?b.equipmentDebtService*ratio(newEquipmentDebt,oldEquipmentDebt)*(1+(a('Equipment rate')-a0('Equipment rate'))/Math.max(.01,a0('Equipment rate'))*.5)*ratio(a0('Equipment term'),a('Equipment term')):0;
  const totalDebtService=facilityService+newEquipService;
  const overhaulYear=y%Math.max(1,a('Overhaul cycle'))===0;
  const overhaul=overhaulYear?newFacility*a('Overhaul fraction')*Math.pow(1+c('Operating cost inflation'),ix):0;
  const oldOverhaul=b.overhaul||0;
  const changeOverhaul=overhaul-oldOverhaul;
  const newRefresh=compute&&y>1&&(y-1)%Math.max(1,a('Hardware replacement years'))===0;
  const oldRefresh=b.replacementFleetCapex>0;
  const oldRefreshNeed=(b.replacementFundingNeed||0);
  const replacementCapex=newRefresh?hardware*Math.pow(1+a('Replacement cost growth'),(y-1)):0;
  const salvage=newRefresh?hardware*a('Hardware salvage'):0;
  const replaceNeed=newRefresh?Math.max(0,replacementCapex*(1-clamp(a('Replacement advance'),0,.95))-salvage):0;
  const refreshDifference=replaceNeed-oldRefreshNeed;
  const baseReserved=(b.equipmentReserve||0),baseInfrastructure=b.infrastructureReserve||0;
  const equipmentDeposit=compute&&c('Refresh reserve enabled')?replaceNeed/Math.max(1,a('Hardware replacement years')):0;
  const infrastructureDeposit=c('Overhaul reserve enabled')?overhaul/Math.max(1,a('Overhaul cycle')):0;
  const baselineEquipmentDeposit=compute&&(+allControls['Refresh reserve enabled'].value)?oldRefreshNeed/Math.max(1,a0('Hardware replacement years')):0;
  const baselineInfrastructureDeposit=(+allControls['Overhaul reserve enabled'].value)?oldOverhaul/Math.max(1,a0('Overhaul cycle')):0;
  const reserveDelta=equipmentDeposit-baselineEquipmentDeposit+infrastructureDeposit-baselineInfrastructureDeposit;
  const newEquityFlow=b.netEquityFlow+(ebitda-b.ebitda)-(maintenanceCapex-b.maintenanceCapex)-(deltaWC-b.workingCapitalDelta)-(totalDebtService-b.totalDebtService)-changeOverhaul-refreshDifference-reserveDelta;
  const netEquityFlow=newEquityFlow;
  const cashAfter=netEquityFlow;
  const year={...b,revenue,infraRent:newInfraRent,computeBill:newCompute,ancillary:newAncillary,powerCost,powerRecovery,propertyRent,propertyCosts,fmCost,fmFee,mepInsurance,warranty,ITInsurance,networkCost,computeSupport,computeOperatorFee,sales,admin,sponsorFee,opex,ebitda,maintenanceCapex,workingCapitalDelta:deltaWC,overhaul,replacementFleetCapex:replacementCapex,replacementFundingNeed:replaceNeed,totalDebtService,facilityDebtService:facilityService,equipmentDebtService:newEquipService,equityDistribution:Math.max(0,cashAfter),newEquityCall:Math.max(0,-cashAfter),netEquityFlow,economicFlow:b.economicFlow+(ebitda-b.ebitda)-(maintenanceCapex-b.maintenanceCapex),dscr:totalDebtService>0?Math.max(0,(ebitda-maintenanceCapex)/totalDebtService):0,billedShare:newBilled,usage:powerUseNew,assetEstimated:true};
  years.push(year);
 }
 // Calibrate proceeds and dated IRRs as deltas to the source reference model.
 const changeCapRate=ratio(a0('Facility cap rate'),a('Facility cap rate'));
 const saleCostChange=ratio(1-c('Disposition cost'),1-(+allControls['Disposition cost'].value||0));
 years=years.map((y,i)=>{
   const b=s.annual[i],priorNoi=(b.economicFlow||b.ebitda),nextNoi=(y.economicFlow||y.ebitda);
   const leaseTail=owner?1:clamp((c('Lease control years')-c('Build months')/12-i-1)/( (+allControls['Lease control years'].value||30)-24/12-i-1),0,1.8);
   let newValue=b.grossAssetValue*changeCapRate*leaseTail*ratio(Math.max(0,nextNoi),Math.max(1000,priorNoi));
   if(compute)newValue*=ratio(1-a('Internal lease value haircut'),1-a0('Internal lease value haircut'));
   if(compute)newValue+=(b.grossAssetValue-b.facilityValue)*(a('Hardware liquidation multiplier')-a0('Hardware liquidation multiplier'));
   const soldDebtDiff=(deltaFacilityDebt+deltaEquipmentDebt+deltaAcquisitionDebt)*Math.max(0,1-(i+1)/20);
   return {...y,grossAssetValue:newValue,saleToEquity:b.saleToEquity+(newValue-b.grossAssetValue)*saleCostChange-soldDebtDiff};
 });
 // Refinance alternatives are modeled separately, and applied as a delta to the
 // workbook's existing debt schedule to avoid replacing its unedited numbers.
 const args={first:c('First refinance year'),interval:c('Refinance interval'),enabled:c('Refinance enabled'),maturity:a('Facility maturity'),initialRate:a('Facility term rate'),initialIO:a('Interest-only years'),initialAmort:a('Facility amortization'),refiRate:c('Refinance rate'),refiAmort:c('Refinance amortization'),refiLTV:c('Refinance LTV'),refiDSCR:c('Minimum DSCR'),refiFee:c('Refinance fee')};
 const baselineArgs={first:allControls['First refinance year'].value,interval:allControls['Refinance interval'].value,enabled:allControls['Refinance enabled'].value,maturity:a0('Facility maturity'),initialRate:a0('Facility term rate'),initialIO:a0('Interest-only years'),initialAmort:a0('Facility amortization'),refiRate:allControls['Refinance rate'].value,refiAmort:allControls['Refinance amortization'].value,refiLTV:allControls['Refinance LTV'].value,refiDSCR:allControls['Minimum DSCR'].value,refiFee:allControls['Refinance fee'].value};
 const baselinePlan=facilityDebtPlan({...baselineArgs,principal:s.annual[0].facilityDebtOpening,yearRows:s.annual});
 const newPlan=facilityDebtPlan({...args,principal:Math.max(0,s.annual[0].facilityDebtOpening+deltaFacilityDebt+deltaAcquisitionDebt),yearRows:years});
 years=years.map((y,i)=>{
  const b=s.annual[i],loanDelta=(newPlan[i].netCash-baselinePlan[i].netCash)+(y.facilityDebtService-b.facilityDebtService);
  const netEquityFlow=y.netEquityFlow+loanDelta;
  const totalDebtService=newPlan[i].debtService+y.equipmentDebtService;
  return {...y,netEquityFlow,equityDistribution:Math.max(0,netEquityFlow),newEquityCall:Math.max(0,-netEquityFlow),totalDebtService,facilityDebtService:newPlan[i].debtService,facilityDebtClosing:newPlan[i].balance,dscr:totalDebtService?Math.max(0,(y.ebitda-y.maintenanceCapex)/totalDebtService):0,saleToEquity:y.saleToEquity-(newPlan[i].balance-b.facilityDebtClosing)};
 });
 const delay=(c('Build months')-24+mods.delay)/12;
 let development=s.development.map(row=>{
  const normal=row.equity/Math.max(1,s.initialEquity),extraDebt=deltaFacilityDebt+deltaEquipmentDebt+deltaAcquisitionDebt;
  return {...row,equity:row.equity+normal*deltaEquity,debt:row.debt+row.debt/Math.max(1,s.totalFunding-s.initialEquity)*extraDebt,uses:row.uses+normal*deltaEquity+row.debt/Math.max(1,s.totalFunding-s.initialEquity)*extraDebt,construction:row.construction+row.construction/Math.max(1,oldFacility)*deltaFacility,hardware:row.hardware+row.hardware/Math.max(1,oldHardware)*deltaHardware};
 });
 // Rephase monthly draws when build months / contractor retainage / draw curve changes.
 // This is a cash-timing proxy; vendor-specific milestones must replace it.
 const buildN=Math.round(clamp(c('Build months'),1,48));
 const changedFunding=buildN!==24||c('Draw curve exponent')!==(allControls['Draw curve exponent'].value)||c('Hardware procurement months')!==(allControls['Hardware procurement months'].value)||c('Retainage')!==(allControls['Retainage'].value);
 if(changedFunding){
  const first=s.development[0],basePrice=+allControls['Purchase price'].value||0;
  const propClosingEquity=owner?(c('Purchase price')-basePrice)*(1-c('Acquisition debt LTV')):0;
  const propClosingDebt=owner?deltaAcquisitionDebt:0;
  const eqAtClose=Math.max(0,first.equity+propClosingEquity);
  const debtAtClose=Math.max(0,first.debt+propClosingDebt);
  const equityRemain=initialEquity-eqAtClose,borrowRemain=(totalFunding-initialEquity)-debtAtClose;
  const e=clamp(c('Draw curve exponent'),.2,5),originalHard=s.development.reduce((n,r)=>n+r.construction,0);
  const hardSum=originalHard+deltaFacility;const hardwareSum=s.development.reduce((n,r)=>n+r.hardware,0)+deltaHardware;
  development=[{month:0,equity:eqAtClose,debt:debtAtClose,uses:eqAtClose+debtAtClose,construction:0,hardware:0}];
  const preHardware=Math.max(1,Math.min(buildN,Math.round(c('Hardware procurement months'))));
  const hardwareStart=Math.max(1,buildN-preHardware+1);
  for(let n=1;n<=buildN;n++){
   const w=Math.pow(n/buildN,e)-Math.pow((n-1)/buildN,e);
   let construction=Math.max(0,hardSum)*w;
   const origRet=+allControls['Retainage'].value||0,chgRet=c('Retainage');
   if(n<buildN)construction-=Math.max(0,hardSum)*Math.max(-.5,chgRet-origRet)*w;
   if(n===buildN)construction+=Math.max(0,hardSum)*Math.max(-.5,chgRet-origRet)*(1-w);
   const hardware=(n>=hardwareStart?Math.max(0,hardwareSum)/preHardware:0);
   const equity=equityRemain*w,debt=borrowRemain*w;
   development.push({month:n,equity,debt,uses:equity+debt,construction,hardware});
  }
 }
 const estimatedReturn=(n)=>{
  const ref=n===5?s.gross5:n===10?s.gross10:s.gross20;
  const baseSchedule=[-.01*s.initialEquity,-.30*s.initialEquity,-.69*s.initialEquity,...s.annual.slice(0,n).map((v,i)=>v.netEquityFlow+(i===n-1?v.saleToEquity:0))];
  const newSchedule=[-.01*initialEquity,-.30*initialEquity,-.69*initialEquity,...years.slice(0,n).map((v,i)=>v.netEquityFlow+(i===n-1?v.saleToEquity:0))];
  const t0=[0,.5,1.5,...Array.from({length:n},(_,i)=>3+i)];
  const t1=[0,.5*(c('Build months')/24),1.5*(c('Build months')/24),...Array.from({length:n},(_,i)=>3+i+delay)];
  const b=xirr(baseSchedule,t0),w=xirr(newSchedule,t1);
  return b===null||w===null?null:ref+w-b;
 };
 const grossIRR=estimatedReturn(hold);
 const gross5=estimatedReturn(5);
 const lpIRR=hold===5&&gross5!==null?s.lpSelected+(gross5-s.gross5)-(c('Sponsor promote')-(+allControls['Sponsor promote'].value||0))*Math.max(0,gross5-c('Preferred hurdle')):null;
 const sponsorEquity=initialEquity*c('Sponsor co-invest');
 const yy=years[2];
 return {scenario:s,forecast:{years,initEquity:initialEquity,debtDelta:deltaFacilityDebt+deltaEquipmentDebt+deltaAcquisitionDebt,capexDelta:deltaFacility+deltaHardware+deltaProperty,modified:true,mods},development,annual:years,grossIRR,lpIRR,initialEquity,totalFunding,sponsorEquity,year3EBITDA:yy.ebitda,year3Dist:yy.equityDistribution,year3Yield:yy.equityDistribution/initialEquity,modified:true,additionalCalls:years.reduce((n,y)=>n+y.newEquityCall,0),hold,refType:'Illustrative reforecast · not independently reconciled to every workbook formula',inputCounts:{control:Object.keys(controlEdits).length,scenario:Object.keys(scenarioEdits).length,fm:Object.keys(fmEdits).length}};
}
