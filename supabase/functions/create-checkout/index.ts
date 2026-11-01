// Deno / Supabase Edge Function. Configure STRIPE_SECRET_KEY and STORE_URL in Edge Function Secrets.
// This function intentionally refuses to create a payment until the production payment provider is configured.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';
const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS' };
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{...cors,'Content-Type':'application/json'}});
 const secret=Deno.env.get('STRIPE_SECRET_KEY'), storeUrl=Deno.env.get('STORE_URL'), url=Deno.env.get('SUPABASE_URL')!, serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 if(!secret||!storeUrl)return new Response(JSON.stringify({error:'Payment provider not configured. No charge was made.'}),{status:503,headers:{...cors,'Content-Type':'application/json'}});
 try{
  const auth=req.headers.get('Authorization'); if(!auth)return new Response(JSON.stringify({error:'Authentication required'}),{status:401,headers:{...cors,'Content-Type':'application/json'}});
  const supabase=createClient(url,serviceKey); const token=auth.replace('Bearer ',''); const {data:userData,error:userError}=await supabase.auth.getUser(token); if(userError||!userData.user)return new Response(JSON.stringify({error:'Invalid session'}),{status:401,headers:{...cors,'Content-Type':'application/json'}});
  const body=await req.json(); const items=body.items;
  if(!Array.isArray(items)||items.length<1||items.length>40)throw new Error('Invalid items');
  const ids=[...new Set(items.map((x:{variant_id:string})=>x.variant_id))]; if(ids.some((x:string)=>typeof x!=='string'))throw new Error('Invalid variant');
  const {data:variants,error}=await supabase.from('variants').select('id,color,size,stock,product_id,products!inner(id,name,slug,price_cents,active)').in('id',ids);
  if(error||!variants||variants.length!==ids.length)throw new Error('Some items are unavailable');
  const lineItems=[];
  for(const item of items){const v=variants.find((x:any)=>x.id===item.variant_id) as any;const quantity=Number(item.quantity);if(!Number.isInteger(quantity)||quantity<1||quantity>10||!v?.products?.active||v.stock<quantity)throw new Error('Stock or quantity invalid');lineItems.push({price_data:{currency:'brl',unit_amount:v.products.price_cents,product_data:{name:v.products.name,metadata:{variant_id:v.id,color:v.color,size:v.size}}},quantity});}
  // Coupon codes are not trusted from the browser; validate them against DB before adding discounts.
  let discounts:any[]=[]; if(body.coupon){const {data:coupon}=await supabase.from('coupons').select('*').eq('code',String(body.coupon).toUpperCase()).eq('active',true).maybeSingle();const now=Date.now();if(coupon&&(!coupon.starts_at||new Date(coupon.starts_at).getTime()<=now)&&(!coupon.expires_at||new Date(coupon.expires_at).getTime()>now)&&(!coupon.max_redemptions||coupon.redemptions<coupon.max_redemptions)){if(coupon.percent_off)throw new Error('Percentage coupon requires a configured Stripe coupon mapping; no payment created');}}
  const stripe=new Stripe(secret,{apiVersion:'2024-12-18.acacia'});
  const session=await stripe.checkout.sessions.create({mode:'payment',payment_method_types:['card'],line_items:lineItems,success_url:`${storeUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${storeUrl}/?checkout=cancelled`,customer_email:userData.user.email,metadata:{user_id:userData.user.id,variant_ids:ids.join(',')}});
  return new Response(JSON.stringify({url:session.url}),{headers:{...cors,'Content-Type':'application/json'}});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:'Unable to create checkout. No charge was made.'}),{status:400,headers:{...cors,'Content-Type':'application/json'}})}
});
