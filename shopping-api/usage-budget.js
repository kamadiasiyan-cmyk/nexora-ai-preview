'use strict';
// Per-process SearchApi.io spending guard, not a distributed billing limit.
const DEFAULT_DAILY_LIMIT=200;
function parseDailyLimit(raw){
  if(raw===undefined||raw===null||raw==='')return DEFAULT_DAILY_LIMIT;
  const value=String(raw).trim();
  if(!/^(0|[1-9][0-9]{0,4})$/.test(value))return DEFAULT_DAILY_LIMIT;
  return Number(value);
}
function createDailyBudget(rawLimit,clock=Date.now){
  const limit=parseDailyLimit(rawLimit);let day='',used=0;
  function snapshot(){
    const now=clock(),today=new Date(now).toISOString().slice(0,10);
    if(day!==today){day=today;used=0}
    const nextMidnight=Date.parse(today+'T00:00:00Z')+86400000;
    return {limit,used,remaining:Math.max(0,limit-used),retryAfterSeconds:Math.max(1,Math.ceil((nextMidnight-now)/1000))};
  }
  return {snapshot,take(){if(snapshot().remaining===0)return false;used++;return true}};
}
module.exports={DEFAULT_DAILY_LIMIT,parseDailyLimit,createDailyBudget};
