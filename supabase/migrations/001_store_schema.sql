-- NORTE® store schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 description text not null default '', price_cents integer not null check(price_cents >= 0),
 compare_at_cents integer check(compare_at_cents is null or compare_at_cents >= 0),
 category text not null default 'Essentials', images text[] not null default '{}',
 featured boolean not null default false, bestseller boolean not null default false,
 active boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.variants (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
 color text not null, color_hex text not null default '#222222', size text not null, stock integer not null default 0 check(stock >= 0), sku text unique,
 unique(product_id,color,size)
);
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), email text not null,
 status text not null default 'pending' check(status in ('pending','paid','processing','shipped','delivered','cancelled','refunded')),
 subtotal_cents integer not null check(subtotal_cents>=0), discount_cents integer not null default 0 check(discount_cents>=0),
 shipping_cents integer not null default 0 check(shipping_cents>=0), total_cents integer not null check(total_cents>=0),
 shipping_address jsonb not null, payment_session_id text unique, payment_intent_id text, created_at timestamptz not null default now()
);
create table if not exists public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 variant_id uuid references public.variants(id), product_name text not null, sku text, color text, size text,
 quantity integer not null check(quantity>0), unit_price_cents integer not null check(unit_price_cents>=0)
);
create table if not exists public.coupons (
 id uuid primary key default gen_random_uuid(), code text not null unique, percent_off integer check(percent_off between 1 and 100),
 amount_off_cents integer check(amount_off_cents >= 0), active boolean not null default false,
 starts_at timestamptz, expires_at timestamptz, max_redemptions integer, redemptions integer not null default 0
);
create table if not exists public.banners (
 id uuid primary key default gen_random_uuid(), title text not null, subtitle text not null default '', image_url text not null,
 href text not null default '/#loja', active boolean not null default false, sort_order integer not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.newsletter_subscribers (
 id uuid primary key default gen_random_uuid(), email text not null unique, created_at timestamptz not null default now()
);
-- Atomic stock decrement; call only from trusted server/Edge Function after verified payment.
create or replace function public.decrement_variant_stock(p_variant_id uuid, p_quantity integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
 if p_quantity < 1 then return false; end if;
 update variants set stock=stock-p_quantity where id=p_variant_id and stock>=p_quantity;
 get diagnostics changed = row_count;
 return changed=1;
end; $$;
revoke all on function public.decrement_variant_stock(uuid,integer) from public, anon, authenticated;
-- RLS: storefront can read active catalog only. Writes require authenticated admin authorization.
alter table public.products enable row level security;
alter table public.variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.coupons enable row level security;
alter table public.banners enable row level security;
alter table public.newsletter_subscribers enable row level security;
drop policy if exists "public can read active products" on public.products;
create policy "public can read active products" on public.products for select to anon, authenticated using(active=true);
drop policy if exists "public can read variants of active products" on public.variants;
create policy "public can read variants of active products" on public.variants for select to anon, authenticated using(exists(select 1 from public.products p where p.id=product_id and p.active=true));
drop policy if exists "public can read active banners" on public.banners;
create policy "public can read active banners" on public.banners for select to anon, authenticated using(active=true);
-- No direct client-side order, coupon or newsletter writes: use validated Edge Functions.
-- For admin CRUD, create a private `admin_users(user_id uuid primary key references auth.users)` table,
-- enable RLS and policies checking auth.uid() in that table; do not grant all authenticated users admin rights.
