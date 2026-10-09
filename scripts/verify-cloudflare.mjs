export async function verifyCloudflare(env=process.env,request=fetch){
 const token=env.CLOUDFLARE_API_TOKEN;if(!token)throw Error('Missing CLOUDFLARE_API_TOKEN');
 const account=env.CLOUDFLARE_ACCOUNT_ID;if(!/^[a-f0-9]{32}$/i.test(account||''))throw Error('Missing or invalid CLOUDFLARE_ACCOUNT_ID');
 const response=await request(`https://api.cloudflare.com/client/v4/accounts/${account}/tokens/verify`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
 const data=await response.json();if(!response.ok||!data.success||data.result?.status!=='active')throw Error('Cloudflare token verification failed');
 return true;
}
if(process.argv[1]&&import.meta.url===(await import('node:url')).pathToFileURL(process.argv[1]).href){await verifyCloudflare();console.log('Cloudflare account token is active. Verification does not prove permission scope or account plan.')}
