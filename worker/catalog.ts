/** Public catalog reads are static assets, never a Durable Object or contact store. */
export async function catalogResponse(request: Request, assets: Fetcher): Promise<Response | null> {
 const url=new URL(request.url);
 if(url.pathname!=="/api/catalog"&&!url.pathname.startsWith("/api/trails/"))return null;
 if(!["GET","HEAD"].includes(request.method))return Response.json({error:"Method not allowed"},{status:405,headers:{Allow:"GET, HEAD"}});
 const id=url.pathname.slice("/api/trails/".length);
 if(url.pathname!=="/api/catalog"&&!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id))return Response.json({error:"Unknown trail"},{status:404});
 url.pathname=url.pathname==="/api/catalog"?"/data/catalog.json":`/data/trails/${id}.json`;
 url.search="";
 const response=await assets.fetch(new Request(url,{method:"GET"}));
 if(!response.ok||!response.headers.get("Content-Type")?.includes("application/json"))return Response.json({error:"Unknown trail"},{status:404});
 const headers=new Headers(response.headers);
 headers.set("Content-Type","application/json; charset=utf-8");headers.set("X-Content-Type-Options","nosniff");headers.set("Cache-Control","public, max-age=300");
 return new Response(request.method==="HEAD"?null:response.body,{status:200,headers});
}
