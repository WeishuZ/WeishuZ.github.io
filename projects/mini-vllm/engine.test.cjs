const {ServingLab}=require('./engine.js'),assert=require('node:assert/strict');
const lab=new ServingLab();const a=lab.submit(48,16);lab.step();assert.equal(a.computed,32);assert.equal(a.generated,0);lab.step();assert.equal(a.computed,48);lab.step();assert.equal(a.generated,1);assert(a.firstToken>0);
for(let i=0;i<100&&!lab.finished.length;i++)lab.step();assert.equal(a.generated,16);assert.equal(lab.free.length,12);
const pressure=new ServingLab({blocks:8,maxSeqs:4,tokenBudget:32});[1,2,3].forEach(()=>pressure.submit(48,48));
let done=false;for(let i=0;i<1000;i++){const result=pressure.step();if(result.done){done=true;break;}}
assert(pressure.preemptions>0);assert(done,'pressure scenario must recover and finish');assert.equal(pressure.free.length,8);
const batch=new ServingLab();batch.submit(16,2);batch.submit(16,8);batch.step();batch.step();batch.step();assert.equal(batch.finished.length,1);const later=batch.submit(16,2);batch.step();assert.equal(later.status,'running');
assert.throws(()=>new ServingLab().submit(512,32),/exceeds/);assert.throws(()=>new ServingLab({blocks:0}),/blocks/);
console.log(`Serving lab passed: chunked prefill, one-token decode, free/reuse, continuous admission, ${pressure.preemptions} recovering preemptions, input bounds and KV ownership.`);
