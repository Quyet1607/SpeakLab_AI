import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GROQ_PILOT_LIMITS, RESERVE_SCRIPT, RELEASE_SCRIPT, quotaKeys,
  ensureGroqPilotQuotaConfigured, reserveGroqPilotQuota,
} from '../server/groqPilotQuota.js';

const env={SPEAKLAB_RATE_LIMIT_REST_URL:'https://redis.example.upstash.io',SPEAKLAB_RATE_LIMIT_REST_TOKEN:'DUMMY_REDIS_SECRET',SPEAKLAB_SESSION_SECRET:'a'.repeat(48)};
const time=Date.UTC(2026,10,17,8,0,0);
const operator={id:'PRIVATE_GOOGLE_ID_1234'};
const idFactory=()=> 'DETERMINISTIC_UUID_TEST_ONLY';
const ok=result=>({ok:true,json:async()=>({result})});

function mockedRedis() {
  const counts=new Map();
  const leases=new Map();
  const calls=[];
  async function fetcher(url, options) {
    assert.equal(url,env.SPEAKLAB_RATE_LIMIT_REST_URL);
    assert.equal(options.method,'POST');
    assert.equal(options.headers.Authorization,'Bearer '+env.SPEAKLAB_RATE_LIMIT_REST_TOKEN);
    const [cmd,script,numKeys,...rest]=JSON.parse(options.body);
    assert.equal(cmd,'EVAL');
    const keys=rest.slice(0,Number(numKeys));
    const args=rest.slice(Number(numKeys));
    calls.push({keys,args,script});
    if (script===RELEASE_SCRIPT) {
      const found=leases.delete(args[0]);
      return ok(found?1:0);
    }
    assert.equal(script,RESERVE_SCRIPT);
    assert.equal(Number(numKeys),4);
    const now=Number(args[0]);
    for (const [token,expiry] of leases) if(expiry<=now)leases.delete(token);
    if(leases.size>=GROQ_PILOT_LIMITS.concurrent)return ok(4);
    if((counts.get(keys[0])||0)>=GROQ_PILOT_LIMITS.operatorDay)return ok(1);
    if((counts.get(keys[1])||0)>=GROQ_PILOT_LIMITS.systemDay)return ok(2);
    if((counts.get(keys[2])||0)>=GROQ_PILOT_LIMITS.systemMinute)return ok(3);
    for(const key of keys.slice(0,3)) counts.set(key,(counts.get(key)||0)+1);
    leases.set(args[1],now+Number(args[6]));
    return ok(0);
  }
  return {fetcher,calls,counts,leases};
}

test('Redis credentials and identity secret are mandatory',async()=>{
 for(const e of [{}, {...env,SPEAKLAB_RATE_LIMIT_REST_TOKEN:''},{...env,SPEAKLAB_SESSION_SECRET:'short'}]){
  assert.throws(()=>ensureGroqPilotQuotaConfigured(e),{code:'GROQ_QUOTA_UNAVAILABLE'});
  await assert.rejects(reserveGroqPilotQuota({identity:operator,env:e,fetcher:async()=>{throw new Error('must not call');}}),{code:'GROQ_QUOTA_UNAVAILABLE'});
 }
});
test('keys contain no raw Google account id, and use UTC dates',()=>{
 const keys=quotaKeys(operator,time,env.SPEAKLAB_SESSION_SECRET);
 assert.ok(keys[0].includes('2026-11-17'));
 assert.ok(keys[2].includes('2026-11-17T08:00'));
 assert.equal(JSON.stringify(keys).includes(operator.id),false);
});
test('request sends one atomic EVAL with all limits and releases via EVAL',async()=>{
 const m=mockedRedis();
 const res=await reserveGroqPilotQuota({identity:operator,env,fetcher:m.fetcher,now:()=>time,idFactory});
 assert.equal(m.calls.length,1);
 assert.equal(m.calls[0].keys.length,4);
 assert.match(m.calls[0].script,/ZREMRANGEBYSCORE/u);
 assert.match(m.calls[0].script,/ZCARD/u);
 assert.match(m.calls[0].script,/INCR/u);
 assert.match(m.calls[0].script,/ZADD/u);
 assert.deepEqual(m.calls[0].args.slice(2,6).map(Number),[3,12,2,1]);
 assert.equal(m.leases.size,1);
 assert.equal(await res.release(),true);
 assert.equal(m.leases.size,0);
 assert.equal(m.calls.length,2);
});
test('parallel requests across instances share concurrency lease',async()=>{
 const m=mockedRedis();
 const first=reserveGroqPilotQuota({identity:operator,env,fetcher:m.fetcher,now:()=>time,idFactory:()=> 'first_uuid_unique1'});
 const second=reserveGroqPilotQuota({identity:operator,env,fetcher:m.fetcher,now:()=>time,idFactory:()=> 'second_uuid_unique2'});
 const results=await Promise.allSettled([first,second]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.code,'GROQ_CONCURRENT_LIMIT');
 await results.find(r=>r.status==='fulfilled').value.release();
});
test('enforces operator daily and system daily / minute with atomic mock',async()=>{
 const m=mockedRedis();
 for(let i=0;i<3;i++){
  const res=await reserveGroqPilotQuota({identity:operator,env,fetcher:m.fetcher,now:()=>time+i*60000,idFactory:()=> 'unique_token_'+i+'____'});
  await res.release();
 }
 await assert.rejects(reserveGroqPilotQuota({identity:operator,env,fetcher:m.fetcher,now:()=>time+240000,idFactory:()=> 'unique_token_four'}),{code:'GROQ_OPERATOR_DAILY_LIMIT'});
 const another={id:'another_user'};
 const res=await reserveGroqPilotQuota({identity:another,env,fetcher:m.fetcher,now:()=>time+240000,idFactory:()=> 'unique_token_other'});
 await res.release();
});
test('fails closed on broken network and invalid Redis response; no key leak',async()=>{
 const bad=[async()=>{throw new Error('private redis error with token');},async()=>({ok:false}),async()=>({ok:true,json:async()=>({error:'private secret'})})];
 for(const fetcher of bad){
  await assert.rejects(reserveGroqPilotQuota({identity:operator,env,fetcher,now:()=>time,idFactory}),e=>{
   assert.equal(e.code,'GROQ_QUOTA_UNAVAILABLE');
   assert.doesNotMatch(e.message,/private|DUMMY_REDIS_SECRET/u);return true;
  });
 }
});
test('release errors are contained; lease is bounded by Redis TTL',async()=>{
 let count=0;
 const res=await reserveGroqPilotQuota({identity:operator,env,now:()=>time,idFactory,fetcher:async()=>{
  count++;if(count===1)return ok(0);
  throw new Error('private network error');
 }});
 assert.equal(await res.release(),false);
 assert.equal(count,2);
 assert.match(RESERVE_SCRIPT,/EXPIRE.*ARGV\[7\]/u);
});
