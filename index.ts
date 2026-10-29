import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json"}});
async function sha(s:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method!=="POST")return json({error:"Method not allowed"},405);
try{const raw=await req.json(),id=String(raw.public_id??"").trim().toUpperCase(),code=String(raw.tracking_code??"").trim();if(!/^BHH-\d{6,12}$/.test(id)||! /^[a-f0-9]{64}$/i.test(code))return json({error:"Номер или код отслеживания неверен."},400);
const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,db=createClient(url,key,{auth:{persistSession:false}});
const ip=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown",pepper=Deno.env.get("RATE_LIMIT_PEPPER")||key,ipHash=await sha("track|"+ip+"|"+pepper);
const {data:lim}=await db.from("request_limits").select("*").eq("key_hash",ipHash).maybeSingle(),now=Date.now();
if(lim&&now-new Date(lim.window_started_at).getTime()<600000&&lim.attempts>=15)return json({error:"Слишком много попыток проверки. Подождите 10 минут."},429);
if(lim&&now-new Date(lim.window_started_at).getTime()<600000)await db.from("request_limits").update({attempts:lim.attempts+1}).eq("key_hash",ipHash);else await db.from("request_limits").upsert({key_hash:ipHash,window_started_at:new Date().toISOString(),attempts:1});
const {data,error}=await db.from("orders").select("public_id,status,created_at,updated_at,tracking_code_hash").eq("public_id",id).maybeSingle();
if(error)throw error;if(!data||data.tracking_code_hash!==await sha(code))return json({error:"Номер или код отслеживания неверен."},404);
return json({public_id:data.public_id,status:data.status,created_at:data.created_at,updated_at:data.updated_at});
}catch(e){console.error("track-order failed",e);return json({error:"Не удалось проверить заказ. Попробуйте позже."},500)}});