'use strict';
/* WatchTower shopping and general website search API. Deploy separately from GitHub Pages. Node 20+. */
const http=require('node:http');
const {URL}=require('node:url');
const PORT=Number(process.env.PORT||3000);
const SEARCHAPI_KEY=process.env.SEARCHAPI_KEY||'';
const ALLOWED_ORIGIN=process.env.ALLOWED_ORIGIN||'https://kamadiasiyan-cmyk.github.io';
const cache=new Map(),hits=new Map();
const json=(res,code,obj,origin)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':origin,'vary':'Origin','x-content-type-options':'nosniff'});res.end(JSON.stringify(obj))};
function cleanUrl(raw){try{const u=new URL(raw);return u.protocol==='https:'?u.href:null}catch{return null}}
function normalize(x){const title=String(x.title||'').slice(0,250),merchant=String(x.source||x.merchant||'Retailer').slice(0,90),rawPrice=x.extracted_price??x.price,price=typeof rawPrice==='number'?rawPrice:Number(String(rawPrice??'').replace(/[^0-9.]/g,'')),url=cleanUrl(x.link||x.product_link||x.url);if(!title||!url||rawPrice==null||String(rawPrice).trim()===''||!Number.isFinite(price)||price<0)return null;return {title,merchant,price,currency:'USD',url,shipping:String(x.delivery||'').slice(0,140)}}
const server=http.createServer(async(req,res)=>{const origin=req.headers.origin||'',allowed=origin===ALLOWED_ORIGIN||(!origin&&process.env.ALLOW_NO_ORIGIN==='1');if(req.method==='OPTIONS'){if(origin&&!allowed)return json(res,403,{error:'Origin not allowed'},ALLOWED_ORIGIN);res.writeHead(204,{'access-control-allow-origin':allowed?origin:ALLOWED_ORIGIN,'access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':'Content-Type','vary':'Origin'});return res.end()}if(origin&&!allowed)return json(res,403,{error:'Origin not allowed'},ALLOWED_ORIGIN);const corsOrigin=origin||ALLOWED_ORIGIN;
let u;try{u=new URL(req.url,'http://localhost')}catch{return json(res,400,{error:'Bad URL'},corsOrigin)}
if(u.pathname==='/health')return json(res,200,{ok:true,configured:!!SEARCHAPI_KEY},corsOrigin);
if(req.method!=='GET'||u.pathname!=='/api/search')return json(res,404,{error:'Not found'},corsOrigin);
const ip=req.socket.remoteAddress||'unknown',now=Date.now(),bucket=hits.get(ip)||{start:now,count:0};if(now-bucket.start>60000){bucket.start=now;bucket.count=0}bucket.count++;hits.set(ip,bucket);if(bucket.count>25)return json(res,429,{error:'Rate limit exceeded'},corsOrigin);
const q=String(u.searchParams.get('q')||'').trim();if(q.length<2||q.length>140)return json(res,400,{error:'Search must contain 2 to 140 characters'},corsOrigin);
if(!SEARCHAPI_KEY)return json(res,503,{error:'Search API not configured. Set SEARCHAPI_KEY on the server.'},corsOrigin);
const mode=u.searchParams.get('mode')==='web'?'web':'products';const key=mode+':'+q.toLowerCase(),cached=cache.get(key);if(cached&&now-cached.time<300000)return json(res,200,{query:q,mode,offers:cached.offers,results:cached.results||[],cached:true},corsOrigin);
try{const target=new URL('https://www.searchapi.io/api/v1/search');target.searchParams.set('engine',mode==='web'?'google':'google_shopping');target.searchParams.set('q',q);target.searchParams.set('gl','us');target.searchParams.set('hl','en');target.searchParams.set('api_key',SEARCHAPI_KEY);const response=await fetch(target,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Provider HTTP '+response.status);const data=await response.json();if(data.error)throw Error(String(data.error).slice(0,150));const offers=mode==='products'?(data.shopping_results||[]).map(normalize).filter(Boolean).slice(0,40):[];const results=mode==='web'?(data.organic_results||[]).map(x=>({title:String(x.title||'').slice(0,250),url:cleanUrl(x.link),snippet:String(x.snippet||'').slice(0,400),domain:String(x.displayed_link||'').slice(0,150)})).filter(x=>x.title&&x.url).slice(0,30):[];cache.set(key,{time:now,offers,results});if(cache.size>200){const first=cache.keys().next().value;cache.delete(first)}return json(res,200,{query:q,mode,offers,results,cached:false},corsOrigin)}catch(err){return json(res,502,{error:'Upstream search unavailable',detail:String(err.message||err).slice(0,150)},corsOrigin)}
});
server.listen(PORT,'0.0.0.0',()=>console.log('WatchTower search API listening on '+PORT));
