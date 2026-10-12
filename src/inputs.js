/** All financial inputs extracted from the workbook. Conventions and computed headings are intentionally read-only. */
export const RECORDED_ONLY={control:new Set(['Financial close','DSRA months','Equity hurdle','Project hurdle','Lease tail','Sponsor overhead','Sponsor build overhead','Maximum approved pre-NTP']),scenario:new Set(['Strategic partner equity share']),fm:new Set([])};
export const READONLY_CONTROLS = new Set(['Selected scenario — from Decision','Annual hours','Months per year','Days per year','Forecast years','Tolerance','Selected hold']);
export const READONLY_SCENARIO = new Set(['Business code']);
export const FM_DERIVED = ['Required technical FTE','Technical staffing','Site manager staffing','DIRECT REIMBURSABLE O&M','OPEN-BOOK TOTAL','ACTIVE ANNUAL FM BUDGET'];
export const CONTROL_GROUPS = [
 ['Site & power',['Financial close','Build months','Utility service MW','Capacity reserve','Building area','Asset basis','Additional shell budget','Delivered electricity','Energy escalation']],
 ['Lease vs ownership',['Lease control years','Annual lease rate','Annual lease NNN','Lease escalation','Purchase price','Purchase closing costs','Acquisition debt LTV','Owned property tax','Owned property insurance','Owned shell maintenance','Property cost escalation']],
 ['Development & working capital',['Preopening budget','Diligence budget','Operating cash buffer','Receivable days','Payable days','DSRA months','Draw curve exponent','Retainage','Hardware procurement months']],
 ['Debt & refinancing',['Refinance enabled','First refinance year','Refinance interval','Refinance amortization','Refinance rate','Refinance LTV','Minimum DSCR','Refinance fee','Lease tail']],
 ['Sponsor & governance',['Equity hurdle','Project hurdle','Disposition cost','Refresh reserve enabled','Overhaul reserve enabled','Operating cost inflation','Sponsor co-invest','Preferred hurdle','Sponsor promote','Sponsor annual asset fee','Sponsor overhead','Sponsor build overhead','Price stress','Cost stress','Maximum approved pre-NTP']],
 ['Model conventions',['Annual hours','Months per year','Days per year','Forecast years','Tolerance','Monthly budget year']]
];
export const SCENARIO_GROUPS = [
 ['Capacity & delivery',['PUE','IT override kW','MEP hard cost per IT MW','EOR and design','Developer delivery fee','Independent commissioning','Owner engineer / QS','Sponsor development fee','Extra GC margin','Contingency','External utility works']],
 ['Facility operation & customer',['Sustaining MEP capital','Overhaul fraction','Overhaul cycle','Incremental MEP tax insurance','Infrastructure rent','Rent escalator','Power markup','Year 1 occupancy','Year 2 occupancy','Stabilized occupancy','Contract billing floor','Initial contract term','Renewal retention','Renewal price reset','Rollover downtime','Actual reserved power use','Idle equipment draw']],
 ['Hardware & dedicated compute',['Fabric/storage power','Billable units/system','System power kW','System/rack capex','External fabric capex','Spares/freight allowance','Initial platform setup','Dedicated rate','SLA / collection allowance','Ancillary service revenue','Warranty maintenance','IT tax insurance','Platform network operations','Compute support staff','Sales/account management','Project admin','Compute operator fee','Hardware replacement years','Hardware salvage','Replacement cost growth','New generation price growth','Refresh downtime']],
 ['Facility & equipment finance',['Facility LTC','Construction rate','Facility term rate','Facility amortization','Interest-only years','Facility maturity','Facility finance fee','Equipment advance','Equipment rate','Equipment term','Equipment finance fee','Replacement advance','Facility cap rate','Internal lease value haircut','Hardware liquidation multiplier','Strategic partner equity share']],
 ['Facility management contract',['FM service model','Fixed-scope FM annual']]
];
export const FM_GROUPS=[
 ['Staffing',['Concurrent technician posts','Productive hours per FTE','Loaded technician pay','Facility management staff','Loaded manager pay']],
 ['Vendor and routine operating expenses',['Outsourced security','Cooling / mechanical maintenance','Electrical maintenance','Fire and life safety','BMS / EPMS / DCIM','Water / treatment / routine fuel','Routine spares / consumables']],
 ['Commercial agreement',['FM management fee','FIXED-SCOPE ALTERNATIVE']]
];
export const FRACTION_CONTROLS=new Set(['Capacity reserve','Lease escalation','Purchase closing costs','Acquisition debt LTV','Owned property tax','Owned property insurance','Property cost escalation','Energy escalation','Operating cost inflation','Equity hurdle','Project hurdle','Disposition cost','Refinance rate','Refinance LTV','Refinance fee','Retainage','Sponsor co-invest','Preferred hurdle','Sponsor promote']);
export const FRACTION_SCENARIO=new Set(['EOR and design','Developer delivery fee','Independent commissioning','Owner engineer / QS','Sponsor development fee','Extra GC margin','Contingency','Sustaining MEP capital','Overhaul fraction','Incremental MEP tax insurance','Rent escalator','Power markup','Year 1 occupancy','Year 2 occupancy','Stabilized occupancy','Contract billing floor','Renewal retention','Renewal price reset','Rollover downtime','Actual reserved power use','Idle equipment draw','Fabric/storage power','External fabric capex','Spares/freight allowance','SLA / collection allowance','Ancillary service revenue','Warranty maintenance','IT tax insurance','Sales/account management','Compute operator fee','Hardware salvage','Replacement cost growth','New generation price growth','Refresh downtime','Facility LTC','Construction rate','Facility term rate','Facility finance fee','Equipment advance','Equipment rate','Equipment finance fee','Replacement advance','Facility cap rate','Internal lease value haircut','Hardware liquidation multiplier','Strategic partner equity share']);
export const EDITORS={
 'Financial close':{type:'date'},'Asset basis':{choices:[[1,'Existing shell retrofit'],[2,'Greenfield + new shell']]},'Refinance enabled':{choices:[[1,'Enabled'],[0,'Disabled']]},'Refresh reserve enabled':{choices:[[1,'Enabled'],[0,'Disabled']]},'Overhaul reserve enabled':{choices:[[1,'Enabled'],[0,'Disabled']]},'FM service model':{choices:[[1,'Open-book + separate fee'],[2,'Fixed inclusive fee']]}
};
export const SCENARIO_UNITS={
 'PUE':'PUE','IT override kW':'kW','MEP hard cost per IT MW':'$/IT MW','System power kW':'kW/system','Dedicated rate':'$/unit-hour or month','Infrastructure rent':'$/kW-month','Contract billing floor':'% of capacity','FM service model':'contract structure','Fixed-scope FM annual':'$/year','Initial contract term':'years','Hardware replacement years':'years','Overhaul cycle':'years','Facility maturity':'years','Facility amortization':'years','Equipment term':'years', 'Productive hours per FTE':'hours/FTE-year'
};
export const isFraction=(section,key)=>section==='control'?FRACTION_CONTROLS.has(key):section==='scenario'?FRACTION_SCENARIO.has(key):false;
export const inputBase=(section,key,s,controls,fm)=>section==='control'?controls[key]?.value:section==='scenario'?s.assumptions[key]:fm[s.model]?.[key];
export const effective=(base,overrides,key)=>Object.hasOwn(overrides||{},key)?overrides[key]:base;
export function fmtInput(value,section,key){if(value===null||value===undefined)return '';const v=Number(value)*(isFraction(section,key)?100:1);if(!Number.isFinite(v))return String(value);return new Intl.NumberFormat('en-US',{useGrouping:true,maximumFractionDigits:8}).format(v);}
export function parseInput(raw,section,key){if(raw===''||raw==null)return null;const cleaned=String(raw).trim().replace(/[,\s$]/g,'').replace(/%$/,'');if(!cleaned)return null;const n=Number(cleaned);if(!Number.isFinite(n))return NaN;return isFraction(section,key)?n/100:n;}
export const workingFm=(s,fmDefaults,edits={})=>{
 const base=fmDefaults[s.model]||fmDefaults['AI Colo'];const f={...base,...edits};
 const tech=+(f['Concurrent technician posts']||0)*8760/Math.max(1,+f['Productive hours per FTE']||1752);
 const techCost=tech*(+f['Loaded technician pay']||0),manager=(+f['Facility management staff']||0)*(+f['Loaded manager pay']||0);
 const vendor=['Outsourced security','Cooling / mechanical maintenance','Electrical maintenance','Fire and life safety','BMS / EPMS / DCIM','Water / treatment / routine fuel','Routine spares / consumables'].reduce((a,k)=>a+(+f[k]||0),0);
 const direct=techCost+manager+vendor;const management=+f['FM management fee']||0;const fixed=+f['FIXED-SCOPE ALTERNATIVE']||0;
 return {...f,'Required technical FTE':tech,'Technical staffing':techCost,'Site manager staffing':manager,'DIRECT REIMBURSABLE O&M':direct,'OPEN-BOOK TOTAL':direct+management,'ACTIVE ANNUAL FM BUDGET':+effective(s.assumptions['FM service model'],edits,'FM service model')===2?fixed:direct+management};
};
export const countChanges=(o={})=>Object.values(o||{}).filter(x=>x&&typeof x==='object').reduce((n,x)=>n+Object.keys(x).length,0);
