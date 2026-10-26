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
/* Compact, browser-only chart coordinates from observed prices; never estimates missing prices. */
function sparklinePoints(rows,width=160,height=44){
  if(!Array.isArray(rows))return null;
  const valid=rows.filter(x=>x&&Number.isSafeInteger(x.at)&&x.at>0&&validPrice(x.price)).sort((a,b)=>a.at-b.at).slice(-60);
  if(valid.length<2)return null;
  const w=Number.isFinite(width)?Math.max(20,Math.min(800,width)):160;
  const h=Number.isFinite(height)?Math.max(20,Math.min(400,height)):44;
  const min=Math.min(...valid.map(x=>x.price)),max=Math.max(...valid.map(x=>x.price));
  const start=valid[0].at,end=valid[valid.length-1].at;
  const round=n=>Number(n.toFixed(2));
  return valid.map((x,i)=>{
    const horizontal=end>start?(x.at-start)/(end-start):i/(valid.length-1);
    const vertical=max>min?(max-x.price)/(max-min):0.5;
    return round(5+horizontal*(w-10))+','+round(5+vertical*(h-10));
  }).join(' ');
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
/* Pure filtering of provider-returned offers. Currency groups are never converted
   or compared numerically against each other. Does not mutate source offers. */
function browseOffers(items,options={}){
  const {stockOnly=false,maxPrice='',merchant='',query='',sort='price'}=options;
  const term=String(query??'').trim().toLocaleLowerCase().slice(0,140);
  const selectedMerchant=String(merchant??'').toLocaleLowerCase();
  const hasMax=maxPrice!==''&&maxPrice!==null&&maxPrice!==undefined;
  const ceiling=hasMax?price(maxPrice):null;
  if(hasMax&&ceiling===null)return [];
  const filtered=(Array.isArray(items)?items:[]).filter(item=>{
    if(!item||typeof item!=='object'||!safeUrl(item.url)||price(item.price)===null||currencyOf(item)===null)return false;
    if(stockOnly&&item.inStock!==true)return false;
    if(selectedMerchant&&String(item.merchant||'').toLocaleLowerCase()!==selectedMerchant)return false;
    if(term&&![item.title,item.merchant].some(value=>typeof value==='string'&&value.toLocaleLowerCase().includes(term)))return false;
    if(hasMax&&(currencyOf(item)!=='USD'||price(item.price)>ceiling))return false;
    return true;
  });
  const byCurrency=(a,b)=>currencyOf(a).localeCompare(currencyOf(b));
  if(sort==='high')filtered.sort((a,b)=>byCurrency(a,b)||price(b.price)-price(a.price));
  else if(sort==='store')filtered.sort((a,b)=>String(a.merchant||'').localeCompare(String(b.merchant||'')));
  else filtered.sort((a,b)=>byCurrency(a,b)||price(a.price)-price(b.price));
  return filtered;
}

/* Browser-only filtering of results already returned by website search.
   Derive domains from validated destination URLs, never provider display labels. */
function webDomain(raw){
  const url=safeUrl(raw);
  if(!url)return null;
  try{return new URL(url).hostname.toLowerCase().replace(/^www\./,'')}catch{return null}
}
function browseWebResults(items,options={}){
  const term=String(options.query??'').trim().toLocaleLowerCase().slice(0,140);
  const selected=String(options.domain??'').trim().toLowerCase();
  const sort=options.sort||'relevance',seen=new Set(),results=[];
  for(const item of Array.isArray(items)?items:[]){
    if(!item||typeof item!=='object'||typeof item.title!=='string'||!item.title.trim())continue;
    const url=safeUrl(item.url),domain=webDomain(item.url);
    if(!url||!domain||seen.has(url))continue;
    seen.add(url);
    const title=item.title.trim().slice(0,250);
    const snippet=typeof item.snippet==='string'?item.snippet.slice(0,400):'';
    if(selected&&domain!==selected)continue;
    if(term&&![title,snippet,domain].some(value=>value.toLocaleLowerCase().includes(term)))continue;
    results.push({title,url,domain,snippet});
  }
  if(sort==='title')results.sort((a,b)=>a.title.localeCompare(b.title));
  else if(sort==='domain')results.sort((a,b)=>a.domain.localeCompare(b.domain)||a.title.localeCompare(b.title));
  return results.slice(0,30);
}

/* A review queue is a reminder for MANUAL checks, not background monitoring.
   Future, malformed, and missing timestamps are unverified, never fresh. */
function checkFreshness(item,now=Date.now(),maxAgeDays=7){
  if(!validItem(item)||!item.url||!safeUrl(item.url))return 'not_applicable';
  const at=typeof item.lastChecked==='string'?Date.parse(item.lastChecked):NaN;
  if(!Number.isFinite(now)||now<=0||!Number.isFinite(at)||at<=0||at>now)return 'never';
  const age=Number.isFinite(maxAgeDays)&&maxAgeDays>0?maxAgeDays*86400000:7*86400000;
  return now-at>=age?'stale':'recent';
}
function reviewSummary(items,now=Date.now()){
  const summary={products:0,never:0,stale:0,recent:0,due:0};
  for(const item of Array.isArray(items)?items:[]){
    const state=checkFreshness(item,now);
    if(state==='not_applicable')continue;
    summary.products++;summary[state]++;
    if(state!=='recent')summary.due++;
  }
  return summary;
}
/* Pure browser-local watchlist browsing; never changes stored items or their indices. */
function browseItems(items,query='',filter='all',sort='recent',now=Date.now()){
  const term=String(query??'').trim().toLocaleLowerCase().slice(0,140);
  const entries=(Array.isArray(items)?items:[]).map((item,index)=>({item,index})).filter(({item})=>{
    if(!validItem(item))return false;
    if(term&&![item.title,item.merchant,item.query].some(value=>typeof value==='string'&&value.toLocaleLowerCase().includes(term)))return false;
    const tracked=price(item.targetPrice)!==null,amount=price(item.price),target=price(item.targetPrice);
    switch(filter){
      case 'products':return !!(item.url&&safeUrl(item.url));
      case 'searches':return !item.url;
      case 'target':return tracked;
      case 'reached':return tracked&&amount!==null&&amount<=target;
      case 'out_of_stock':return item.inStock===false;
      case 'unchecked':return !item.lastChecked;
      case 'due':return ['never','stale'].includes(checkFreshness(item,now));
      default:return true;
    }
  });
  if(sort==='check-oldest'){
    const rank={never:0,stale:1,recent:2,not_applicable:3};
    entries.sort((a,b)=>{
      const sa=checkFreshness(a.item,now),sb=checkFreshness(b.item,now);
      const group=rank[sa]-rank[sb];
      if(group)return group;
      if(sa==='stale'||sa==='recent')return Date.parse(a.item.lastChecked)-Date.parse(b.item.lastChecked)||a.index-b.index;
      return a.index-b.index;
    });
  }
  else if(sort==='name')entries.sort((a,b)=>a.item.title.localeCompare(b.item.title)||a.index-b.index);
  else if(sort==='price-low'||sort==='price-high'){
    const direction=sort==='price-low'?1:-1;
    entries.sort((a,b)=>{
      const pa=price(a.item.price),pb=price(b.item.price);
      if(pa===null||pb===null)return pa===null?(pb===null?a.index-b.index:1):-1;
      const ca=currencyOf(a.item)||'',cb=currencyOf(b.item)||'';
      return ca.localeCompare(cb)||direction*(pa-pb)||a.index-b.index;
    });
  }
  return entries;
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


/* Portable, browser-local CSV exports. Every cell is quoted and spreadsheet
   formula prefixes are neutralized to protect people opening exports in Excel. */
function csvCell(value){
  let text=String(value??'').replace(/\u0000/g,'');
  if(/^\s*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
function csvRow(cells){return cells.map(csvCell).join(',')+'\r\n'}
function historyCsv(items,history){
  let out=csvRow(['Observed at (UTC)','Product','Retailer','Product URL','Currency','Observed price','Stock status']);
  for(const item of (Array.isArray(items)?items:[]).slice(0,500)){
    if(!validItem(item))continue;
    const currency=currencyOf(item);
    if(!currency)continue;
    const rows=history&&typeof history==='object'&&Array.isArray(history[keyFor(item)])?history[keyFor(item)]:[];
    for(const x of rows.slice(-60)){
      if(!x||!Number.isSafeInteger(x.at)||x.at<=0||x.at>8640000000000000||!validPrice(x.price))continue;
      if(x.stock!==true&&x.stock!==false&&x.stock!==null)continue;
      out+=csvRow([new Date(x.at).toISOString(),item.title,item.merchant||'',item.url?safeUrl(item.url)||'':'',currency,x.price,x.stock===true?'In stock':x.stock===false?'Out of stock':'Unknown']);
    }
  }
  return out;
}
function alertsCsv(items){
  let out=csvRow(['Observed at (UTC)','Event','Product','Currency','Observed price']);
  for(const x of mergeAlerts([],items)){
    out+=csvRow([new Date(x.at).toISOString(),x.type,x.title,x.currency,x.price]);
  }
  return out;
}
function browseAlerts(items,query='',type='all'){
  const term=String(query??'').trim().toLocaleLowerCase().slice(0,140);
  return mergeAlerts([],items).filter(x=>(type==='all'||x.type===type)&&(!term||x.title.toLocaleLowerCase().includes(term)||x.type.replace(/_/g,' ').includes(term)));
}

return {WATCH_KEY,HISTORY_KEY,ALERTS_KEY,price,currencyOf,matchingCurrency,safeUrl,validItem,loadItems,keyFor,loadHistory,observe,mergeItems,mergeHistory,historyStats,sparklinePoints,priceRanges,browseOffers,webDomain,browseWebResults,browseItems,checkFreshness,reviewSummary,validAlert,mergeAlerts,loadAlerts,recordAlerts,csvCell,historyCsv,alertsCsv,browseAlerts};
});