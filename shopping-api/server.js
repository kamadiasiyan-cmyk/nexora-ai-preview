'use strict';
/* WatchTower shopping and general website search API. Deploy separately from GitHub Pages. Node 20+. */
const http=require('node:http');
const {URL}=require('node:url');
const PORT=Number(process.env.PORT||3000);
const SEARCHAPI_KEY=process.env.SEARCHAPI_KEY||'';
const ALLOWED_ORIGIN=process.env.ALLOWED_ORIGIN||'https://kamadiasiyan-cmyk.github.io';
const cache=new Map(),hits=new Map(),pending=new Map();
const MAX_PROVIDER_CONCURRENCY=8;
let requestCount=0;
const {cleanUrl,parsePrice,stockState,normalizeOffer:normalize,normalizeOffers,normalizeWebResults}=require('./offer-utils');
const {summarizeOffers}=require('./comparison-utils');
const json=(res,code,obj,origin)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':origin,'vary':'Origin','x-content-type-options':'nosniff'});res.end(JSON.stringify(obj))};

const server=http.createServer(async(req,res)=>{const origin=req.headers.origin||'',allowed=origin===ALLOWED_ORIGIN||(!origin&&process.env.ALLOW_NO_ORIGIN==='1');if(req.method==='OPTIONS'){if(origin&&!allowed)return json(res,403,{error:'Origin not allowed'},ALLOWED_ORIGIN);res.writeHead(204,{'access-control-allow-origin':allowed?origin:ALLOWED_ORIGIN,'access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':'Content-Type','vary':'Origin'});return res.end()}if(origin&&!allowed)return json(res,403,{error:'Origin not allowed'},ALLOWED_ORIGIN);const corsOrigin=origin||ALLOWED_ORIGIN;
let u;try{u=new URL(req.url,'http://localhost')}catch{return json(res,400,{error:'Bad URL'},corsOrigin)}
if(u.pathname==='/health')return json(res,200,{ok:true,configured:!!SEARCHAPI_KEY},corsOrigin);
if(req.method!=='GET'||u.pathname!=='/api/search')return json(res,404,{error:'Not found'},corsOrigin);
const ip=req.socket.remoteAddress||'unknown',now=Date.now(),bucket=hits.get(ip)||{start:now,count:0};
requestCount++;
if(requestCount%100===0||hits.size>10000){for(const [key,value] of hits)if(now-value.start>60000)hits.delete(key);if(hits.size>10000){for(const key of hits.keys()){hits.delete(key);if(hits.size<=9000)break}}}if(now-bucket.start>60000){bucket.start=now;bucket.count=0}bucket.count++;hits.set(ip,bucket);if(bucket.count>25)return json(res,429,{error:'Rate limit exceeded'},corsOrigin);
const q=String(u.searchParams.get('q')||'').trim();if(q.length<2||q.length>140)return json(res,400,{error:'Search must contain 2 to 140 characters'},corsOrigin);
if(!SEARCHAPI_KEY)return json(res,503,{error:'Search API not configured. Set SEARCHAPI_KEY on the server.'},corsOrigin);
const rawMode=u.searchParams.get('mode')||'products';if(!['products','web'].includes(rawMode))return json(res,400,{error:'Unsupported search mode'},corsOrigin);const mode=rawMode;const key=mode+':'+q.toLowerCase(),cached=cache.get(key);if(cached&&now-cached.time<300000)return json(res,200,{query:q,mode,offers:cached.offers,results:cached.results||[],comparison:mode==='products'?summarizeOffers(cached.offers):null,cached:true},corsOrigin);
try{
  let work=pending.get(key);
  if(!work){
    if(pending.size>=MAX_PROVIDER_CONCURRENCY)return json(res,503,{error:'Search service busy; retry shortly'},corsOrigin);
    work=(async()=>{
      const target=new URL('https://www.searchapi.io/api/v1/search');
      target.searchParams.set('engine',mode==='web'?'google':'google_shopping');
      target.searchParams.set('q',q);
      target.searchParams.set('gl','us');
      target.searchParams.set('hl','en');
      target.searchParams.set('api_key',SEARCHAPI_KEY);
      const response=await fetch(target,{signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw Error('Provider unavailable');
      const data=await response.json();
      if(!data||typeof data!=='object'||data.error)throw Error('Invalid provider response');
      return {offers:mode==='products'?normalizeOffers(data.shopping_results):[],results:mode==='web'?normalizeWebResults(data.organic_results):[]};
    })();
    pending.set(key,work);
    work.finally(()=>{if(pending.get(key)===work)pending.delete(key)}).catch(()=>{});
  }
  const data=await work;
  cache.set(key,{time:Date.now(),...data});
  if(cache.size>200)cache.delete(cache.keys().next().value);
  return json(res,200,{query:q,mode,...data,comparison:mode==='products'?summarizeOffers(data.offers):null,cached:false},corsOrigin);
}catch{return json(res,502,{error:'Upstream search unavailable'},corsOrigin)}

});
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log('WatchTower search API listening on '+PORT));
module.exports={server,cleanUrl,parsePrice,stockState,normalize,normalizeOffers,normalizeWebResults};
