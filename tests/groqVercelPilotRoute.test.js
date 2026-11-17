import test from 'node:test';
import assert from 'node:assert/strict';
import { createPilotHandler } from '../api/groq/pilot.js';

const env = { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/groq-synthetic-pilot', GROQ_API_KEY: 'MOCK_KEY_TEST_ONLY' };
const who = { id: '12345678912345', role: 'teacher' };
const headers = { origin: 'https://example-preview.vercel.app', host: 'example-preview.vercel.app', 'x-forwarded-proto': 'https', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' };
function makeResponse() {
  return { code: 200, headers: {}, body: null,
    setHeader(k,v) { this.headers[k]=v; },
    status(code) { this.code=code; return this; },
    json(body) { this.body=body; return this; },
  };
}
const request = (method='POST', body={ syntheticOnly:true, confirmOneCall:true }) => ({method, headers:{...headers},body});
async function call(handler, req) { const res=makeResponse(); await handler(req,res); return res; }
const mockReview = { criteria: [], summary: 'Dữ liệu giả lập', limitations: 'Chỉ dữ liệu chữ' };
const factory=(options={})=>createPilotHandler({env,sessionReader:()=>who,pilotRunner:async()=>({review:mockReview}),...options});

test('GET checks readiness without contacting Groq', async()=>{
  let calls=0;
  const handler=factory({pilotRunner:async()=>{calls++;}});
  const res=await call(handler,request('GET'));
  assert.equal(res.code,200); assert.equal(calls,0); assert.equal(res.body.syntheticOnly,true);
});
test('production and wrong branches fail closed', async()=>{
  for (const e of [{...env,VERCEL_ENV:'production'}, {...env,VERCEL_GIT_COMMIT_REF:'main'}, {...env,VERCEL_GIT_COMMIT_REF:undefined}]) {
    const res=await call(factory({env:e}),request()); assert.equal(res.code,404);
  }
});
test('authentication and teacher role mandatory, no access for guest or learner', async()=>{
  assert.equal((await call(factory({sessionReader:()=>null}),request())).code,401);
  assert.equal((await call(factory({sessionReader:()=>({...who,role:'learner'})}),request())).code,403);
  assert.equal((await call(factory({env:{...env,GROQ_API_KEY:''}}),request())).code,503);
});
test('POST checks origin and rejects arbitrary data without calling provider', async()=>{
  let calls=0;
  const handler=factory({pilotRunner:async()=>{calls++;}});
  const badOrigin=request();badOrigin.headers.origin='https://attacker.com';
  assert.equal((await call(handler,badOrigin)).code,403);
  const badData=request('POST',{ syntheticOnly:true,confirmOneCall:true,transcript:'student data' });
  assert.equal((await call(handler,badData)).code,400);
  const badEmpty=request('POST',{ syntheticOnly:false,confirmOneCall:true });
  assert.equal((await call(handler,badEmpty)).code,400);
  assert.equal(calls,0);
});
test('one click produces one synthetic call and throttles repeats per function instance', async()=>{
  let calls=0, t=100000;
  const handler=factory({now:()=>t,pilotRunner:async args=>{
    calls++; assert.equal(args.live,true); assert.equal(args.apiKey,env.GROQ_API_KEY);
    return {review:mockReview};
  }});
  const a=await call(handler,request());
  assert.equal(a.code,200); assert.equal(a.body.syntheticOnly,true); assert.equal(calls,1);
  assert.equal((await call(handler,request())).code,429); assert.equal(calls,1);
  t+=60001;
  assert.equal((await call(handler,request())).code,200); assert.equal(calls,2);
});
test('upstream quota failures are redacted and never automatically retried', async()=>{
  let calls=0;
  const handler=factory({pilotRunner:async()=>{calls++;throw new Error('429 private provider token');}});
  const res=await call(handler,request());
  assert.equal(res.code,429);assert.equal(calls,1);
  assert.doesNotMatch(JSON.stringify(res.body),/token/u);
});
