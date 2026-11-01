import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabase = url && key && !url.includes('SEU-PROJETO') ? createClient(url,key) : null;
export type Variant = { id:string; color:string; color_hex:string; size:string; stock:number; sku?:string };
export type Product = { id:string; name:string; slug:string; description:string; price_cents:number; compare_at_cents?:number|null; category:string; featured:boolean; bestseller:boolean; images:string[]; variants:Variant[]; active:boolean };
export const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export async function loadProducts():Promise<Product[]> { if(!supabase) return []; const {data,error}=await supabase.from('products').select('*, variants(*)').eq('active',true).order('created_at',{ascending:false}); if(error){console.error(error);return [];} return (data||[]) as Product[]; }
