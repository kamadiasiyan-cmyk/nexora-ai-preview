/* Browser-local WatchTower watchlist helpers; no backend or credentials. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.WatchlistUtils=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const WATCH_KEY='watchtower-watchlist-v1', HISTORY_KEY='watchtower-price-history-v1', ALERTS_KEY='watchtower-local-alerts-v1';
const validPrice=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e9;
const SUPPORTED_CURRENCIES=new Set(['USD','EUR','GBP','CAD','AUD','JPY','INR','CHF','NZD']);
function currencyOf(item){
  const value=item?.currency;
  if(value===undefined||value===null||value==='')return 'USD'; // Legacy saved products
  if(typeof value!=='string')return null;
  const code=value.trim().toUpperCase();
  return SUPPORTED_CURRENCIES.has(code)?code:null;
}
function matchingCurrency(saved,offer){
  const a=currencyOf(saved),b=currencyOf(offer);
  return a!==null&&a===b;
}
function price(x){
  if(typeof x==='number')return validPrice(x)?x:null;
  if(typeof x!=='string'||!/^(?:\d{1,9})(?:\.\d{1,2})?$/.test(x.trim()))return null;
  const n=Number(x.trim());return validPrice(n)?n:null;
}
function safeUrl(x){
  try{const u=new URL(x);if(u.protocol!=='https:'||u.username||u.password)return null;
    u.hash='';for(const k of [...u.searchParams.keys()])if(k.toLowerCase().startsWith('utm_')||['gclid','fbclid','gbraid','wbraid','msclkid'].includes(k.toLowerCase()))u.searchParams.delete(k);
    return u.href}catch{return null}
}
function validItem(x){return !!(x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.title==='string'&&x.title.trim()&&x.title.length<=250&&(!x.url||safeUrl(x.url)))}
function loadItems(storage){
  try{const a=JSON.parse(storage.getItem(WATCH_KEY)||'[]');return Array.isArray(a)?a.filter(x=>x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.title==='string'&&x.title.trim()&&x.title.length<=250).slice(0,500).map(x=>x.url&&!safeUrl(x.url)?{...x,url:undefined}:x):[]}catch{return []}
}
function keyFor(item){return encodeURIComponent((item.url&&safeUrl(item.url))||[item.mode||'products',item.merchant||'',item.query||item.title].join('|'))}
function loadHistory(storage){
  const out=Object.create(null);
  try{const data=JSON.parse(storage.getItem(HISTORY_KEY)||'{}');if(!data||typeof data!=='object'||Array.isArray(data))return out;
    for(const [k,rows] of Object.entries(data).slice(0,500)){if(k.length<=2000&&Array.isArray(rows))out[k]=rows.filter(x=>x&&Number.isFinite(x.at)&&x.at>0&&validPrice(x.price)&&(x.stock===true||x.stock===false||x.stock===null)).slice(-60)}
  }catch{}return out;
}
function observe(history,item,amount,stock,at=Date.now()){
  if(!validPrice(amount)||!Number.isFinite(at)||at<=0)throw Error('Invalid observation');
  const k=keyFor(item),rows=Array.isArray(history[k])?history[k]:[],prev=rows[rows.length-1],state=stock===true?true:stock===false?false:null;
  const target=price(item.targetPrice),dropped=!!prev&&amount<prev.price,restocked=!!prev&&prev.stock===false&&state===true,reached=target!==null&&amount<=target&&(!prev||prev.price>target);
  if(!prev||prev.price!==amount||prev.stock!==state)history[k]=rows.concat([{at,price:amount,stock:state}]).slice(-60);
  return {dropped,restocked,reached,previousPrice:prev?.price??null};
}
function historyStats(rows){
  const valid=Array.isArray(rows)?rows.filter(x=>x&&Number.isFinite(x.at)&&x.at>0&&validPrice(x.price)).sort((a,b)=>a.at-b.at):[];
  if(!valid.length)return null;
  const first=valid[0].price,last=valid[valid.length-1].price;
  const lowest=Math.min(...valid.map(x=>x.price)),highest=Math.max(...valid.map(x=>x.price));
  return {count:valid.length,first,last,lowest,highest,change:last-first,percentChange:first>0?Math.round((last-first)/first*10000)/100:null};
}
function priceRanges(offers){
  const groups=new Map();
  for(const offer of Array.isArray(offers)?offers:[]){
    if(!offer||typeof offer!=='object')continue;
    const amount=price(offer.price);
    if(amount===null)continue;
    const currency=currencyOf(offer);if(currency===null)continue;
    const old=groups.get(currency)||{currency,min:amount,max:amount,count:0};
    old.min=Math.min(old.min,amount);old.max=Math.max(old.max,amount);old.count++;
    groups.set(currency,old);
  }
  return [...groups.values()].sort((a,b)=>a.currency.localeCompare(b.currency));
}
function mergeItems(current,incoming){
  const result=current.filter(validItem).slice(0,500),seen=new Set(result.map(keyFor));
  for(const item of Array.isArray(incoming)?incoming:[]){if(!validItem(item))continue;const k=keyFor(item);if(!seen.has(k)&&result.length<500){result.push(item);seen.add(k)}}
  return result;
}
function mergeHistory(current,incoming){
  const out=Object.assign(Object.create(null),current);
  if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))return out;
  for(const [k,rows] of Object.entries(incoming).slice(0,500)){
    if(k.length>2000||!Array.isArray(rows))continue;
    const valid=rows.filter(x=>x&&Number.isFinite(x.at)&&x.at>0&&validPrice(x.price)&&(x.stock===true||x.stock===false||x.stock===null));
    if(valid.length)out[k]=[...(out[k]||[]),...valid].sort((a,b)=>a.at-b.at).filter((x,i,a)=>i===0||x.at!==a[i-1].at).slice(-60);
  }return out;
}

/* Manual-check activity only. These browser-local events are not push notifications. */
const ALERT_TYPES=new Set(['price_drop','target_reached','restock']);
function validAlert(x){
  return !!(x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.id==='string'&&x.id.length<=2200&&
    typeof x.key==='string'&&x.key.length<=2000&&typeof x.title==='string'&&x.title.trim()&&x.title.length<=250&&
    ALERT_TYPES.has(x.type)&&Number.isSafeInteger(x.at)&&x.at>0&&x.at<=8640000000000000&&
    validPrice(x.price)&&currencyOf(x)!==null);
}
function mergeAlerts(current,incoming){
  const out=[],seen=new Set();
  for(const x of [...(Array.isArray(current)?current:[]),...(Array.isArray(incoming)?incoming:[])]){
    if(!validAlert(x)||seen.has(x.id))continue;
    seen.add(x.id);
    out.push({id:x.id,key:x.key,title:x.title,type:x.type,at:x.at,price:x.price,currency:currencyOf(x)});
  }
  return out.sort((a,b)=>b.at-a.at).slice(0,100);
}
function loadAlerts(storage){
  try{return mergeAlerts([],JSON.parse(storage.getItem(ALERTS_KEY)||'[]'))}catch{return []}
}
function recordAlerts(current,item,event,amount,at=Date.now()){
  if(!validItem(item)||!validPrice(amount)||!Number.isSafeInteger(at)||at<=0||at>8640000000000000)return mergeAlerts(current,[]);
  const currency=currencyOf(item);if(currency===null)return mergeAlerts(current,[]);
  const key=keyFor(item),added=[];
  for(const [flag,type] of [['dropped','price_drop'],['reached','target_reached'],['restocked','restock']]){
    if(event&&event[flag]===true)added.push({id:at+':'+key+':'+type,key,title:item.title.trim(),type,at,price:amount,currency});
  }
  return mergeAlerts(current,added);
}

return {WATCH_KEY,HISTORY_KEY,ALERTS_KEY,price,currencyOf,matchingCurrency,safeUrl,validItem,loadItems,keyFor,loadHistory,observe,mergeItems,mergeHistory,historyStats,priceRanges,validAlert,mergeAlerts,loadAlerts,recordAlerts};
});