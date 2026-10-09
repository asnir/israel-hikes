import {test} from 'node:test';import assert from 'node:assert/strict';import {verifyCloudflare} from '../scripts/verify-cloudflare.mjs';
const env={CLOUDFLARE_API_TOKEN:'fake-test-token',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32)};
test('Account token verification uses the account-owned endpoint and bounded request',async()=>{
 let calls=0;assert.equal(await verifyCloudflare(env,async(url,opt)=>{calls++;assert.equal(url,`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/tokens/verify`);assert.equal(opt.headers.Authorization,'Bearer fake-test-token');assert.ok(opt.signal);return Response.json({success:true,result:{status:'active'}})}),true);assert.equal(calls,1);
});
test('Missing token or invalid account ID prevents network requests',async()=>{
 for(const e of [{},{...env,CLOUDFLARE_ACCOUNT_ID:''},{...env,CLOUDFLARE_ACCOUNT_ID:'https://evil.invalid'},{...env,CLOUDFLARE_API_TOKEN:''}])await assert.rejects(verifyCloudflare(e,async()=>{assert.fail('Must not request')}));
});
test('HTTP, revoked, malformed and transport verification failures fail closed',async()=>{
 for(const request of [async()=>Response.json({success:true,result:{status:'active'}},{status:403}),async()=>Response.json({success:false}),async()=>Response.json({success:true,result:{status:'disabled'}}),async()=>new Response('bad JSON'),async()=>{throw Error('network')}])await assert.rejects(verifyCloudflare(env,request));
});
