import test from 'node:test';
import assert from 'node:assert/strict';
import { createPilotHandler } from '../api/groq/pilot.js';

const env = {
  VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/groq-synthetic-pilot',
  GROQ_API_KEY: 'MOCK_KEY_ONLY',
};
const who = { id: 'operator1', role: 'teacher' };
const headers = { origin:'https://pilot.vercel.app',host:'pilot.vercel.app','x-forwarded-proto':'https','sec-fetch-site':'same-origin','content-type':'application/json' };
function makeResponse() {
  return { code:200, headers:{},body:null,
    setHeader(k,v){this.headers[k]=v;}, status(code){this.code=code;return this;},
    json(body){this.body=body;return this;},
  };
}
const request=(method='POST',body={syntheticOnly:true,confirmOneCall:true})=>({method,headers:{...headers},body});
async function call(handler,req){const res=makeResponse();await handler(req,res);return res;}
const mockReview={criteria:[],summary:'Dữ liệu giả',limitations:'Chỉ dữ liệu chữ'};
function factory(opts={}) {
  return createPilotHandler({
    env,sessionReader:()=>who,quotaConfigured:()=>{},
    quotaReserver:async()=>({release:async()=>true}),
    pilotRunner:async()=>({review:mockReview}),...opts,
  });
}

test('GET readiness needs no Redis reservation or Groq call',async()=>{
 let count=0;
 const res=await call(factory({quotaReserver:async()=>{count++;},pilotRunner:async()=>{count++;}}),request('GET'));
 assert.equal(res.code,200);assert.equal(count,0);
});
test('wrong Preview branch or Production fails closed',async()=>{
 for(const e of [{...env,VERCEL_ENV:'production'},{...env,VERCEL_GIT_COMMIT_REF:'main'}]){
  assert.equal((await call(factory({env:e}),request())).code,404);
 }
});
test('guest, learner, missing key or missing Redis config never run Groq',async()=>{
 let count=0;
 const opts={pilotRunner:async()=>{count++;}};
 assert.equal((await call(factory({...opts,sessionReader:()=>null}),request())).code,401);
 assert.equal((await call(factory({...opts,sessionReader:()=>({...who,role:'learner'})}),request())).code,403);
 assert.equal((await call(factory({...opts,env:{...env,GROQ_API_KEY:''}}),request())).code,503);
 assert.equal((await call(factory({...opts,quotaConfigured:()=>{throw new Error('private Redis');}}),request())).code,503);
 assert.equal(count,0);
});
test('rejects forged origin and user-supplied transcript before quota',async()=>{
 let count=0;
 const opts={quotaReserver:async()=>{count++;},pilotRunner:async()=>{count++;}};
 const forged=request();forged.headers.origin='https://attacker.example';
 assert.equal((await call(factory(opts),forged)).code,403);
 assert.equal((await call(factory(opts),request('POST',{syntheticOnly:true,confirmOneCall:true,transcript:'student data'}))).code,400);
 assert.equal(count,0);
});
test('quota succeeds before one Groq call and lease is released on success',async()=>{
 const calls=[];
 const handler=factory({
  quotaReserver:async({identity})=>{assert.equal(identity.id,'operator1');calls.push('reserve');return {release:async()=>{calls.push('release');}};},
  pilotRunner:async()=>{calls.push('groq');return {review:mockReview};},
 });
 const res=await call(handler,request());
 assert.equal(res.code,200);assert.deepEqual(calls,['reserve','groq','release']);
});
test('quota failures fail closed for 429 and 503, with no Groq request',async()=>{
 let calls=0;
 for(const [status,code] of [[429,'GROQ_SYSTEM_DAILY_LIMIT'],[503,'GROQ_QUOTA_UNAVAILABLE']]){
  const h=factory({
   quotaReserver:async()=>{throw Object.assign(new Error('Hết hạn mức.'),{status,code});},
   pilotRunner:async()=>{calls++;},
  });
  const res=await call(h,request());assert.equal(res.code,status);
  assert.doesNotMatch(JSON.stringify(res.body),/MOCK_KEY_ONLY/);
 }
 assert.equal(calls,0);
});
test('failed Groq response still releases the lease and never retries',async()=>{
 let calls=0,releases=0;
 const h=factory({
  quotaReserver:async()=>({release:async()=>{releases++;}}),
  pilotRunner:async()=>{calls++;throw Object.assign(new Error('429 provider secret'),{code:'GROQ_RATE_LIMIT'});},
 });
 const res=await call(h,request());
 assert.equal(res.code,429);assert.equal(calls,1);assert.equal(releases,1);
});
test('validation failures still release the concurrency lease',async()=>{
 let releases=0;
 const h=factory({
  quotaReserver:async()=>({release:async()=>{releases++;}}),
  pilotRunner:async()=>{throw Object.assign(new Error('Dẫn chứng sai'),{code:'GROQ_INVALID_REVIEW'});},
 });
 const res=await call(h,request());
 assert.equal(res.code,502);assert.equal(res.body.code,'INVALID_REVIEW');assert.equal(releases,1);
});
