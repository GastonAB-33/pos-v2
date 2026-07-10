-- POS V2 - Seed y validacion de aislamiento para tenants demo/angie.
--
-- Objetivo:
-- - Crear un producto distinto en cada tenant de prueba.
-- - Validar que cada usuario autenticado solo pueda ver su tenant.
-- - Validar que cada usuario solo vea sus productos.
--
-- No borra datos. Usa upsert manual por tenant_id + code.

begin;

do $$
declare
  v_demo_tenant_id text;
  v_angie_tenant_id text;
  v_demo_product_id text;
  v_angie_product_id text;
begin
  select id into v_demo_tenant_id
  from public.tenants
  where slug = 'demo' and is_active = true
  limit 1;

  select id into v_angie_tenant_id
  from public.tenants
  where slug = 'angie' and is_active = true
  limit 1;

  if v_demo_tenant_id is null then
    raise exception 'No existe tenant activo slug=demo';
  end if;

  if v_angie_tenant_id is null then
    raise exception 'No existe tenant activo slug=angie';
  end if;

  select id into v_demo_product_id
  from public.products
  where tenant_id = v_demo_tenant_id and code = 'ISO-DEMO-001'
  limit 1;

  if v_demo_product_id is null then
    insert into public.products (
      id,
      tenant_id,
      code,
      name,
      description,
      category,
      price,
      cost_price,
      stock_current,
      stock_min,
      stock_max,
      unit,
      sale_mode,
      currency_code,
      is_active
    )
    values (
      gen_random_uuid()::text,
      v_demo_tenant_id,
      'ISO-DEMO-001',
      'Producto aislamiento Demo',
      'Producto creado para validar aislamiento tenant demo',
      'Pruebas',
      1000,
      600,
      10,
      1,
      100,
      'unidad',
      'unit',
      'ARS',
      true
    );
  else
    update public.products
    set name = 'Producto aislamiento Demo',
        description = 'Producto creado para validar aislamiento tenant demo',
        category = 'Pruebas',
        price = 1000,
        cost_price = 600,
        stock_current = 10,
        stock_min = 1,
        stock_max = 100,
        unit = 'unidad',
        sale_mode = 'unit',
        currency_code = 'ARS',
        is_active = true,
        updated_at = now()
    where id = v_demo_product_id;
  end if;

  select id into v_angie_product_id
  from public.products
  where tenant_id = v_angie_tenant_id and code = 'ISO-ANGIE-001'
  limit 1;

  if v_angie_product_id is null then
    insert into public.products (
      id,
      tenant_id,
      code,
      name,
      description,
      category,
      price,
      cost_price,
      stock_current,
      stock_min,
      stock_max,
      unit,
      sale_mode,
      currency_code,
      is_active
    )
    values (
      gen_random_uuid()::text,
      v_angie_tenant_id,
      'ISO-ANGIE-001',
      'Producto aislamiento Angie',
      'Producto creado para validar aislamiento tenant angie',
      'Pruebas',
      2000,
      1200,
      20,
      2,
      200,
      'unidad',
      'unit',
      'ARS',
      true
    );
  else
    update public.products
    set name = 'Producto aislamiento Angie',
        description = 'Producto creado para validar aislamiento tenant angie',
        category = 'Pruebas',
        price = 2000,
        cost_price = 1200,
        stock_current = 20,
        stock_min = 2,
        stock_max = 200,
        unit = 'unidad',
        sale_mode = 'unit',
        currency_code = 'ARS',
        is_active = true,
        updated_at = now()
    where id = v_angie_product_id;
  end if;
end $$;

commit;

with
auth_users as (
  select 'demo' as expected_slug, id as auth_uid, email
  from auth.users
  where lower(email) = 'ale.97.28@gmail.com'
  union all
  select 'angie' as expected_slug, id as auth_uid, email
  from auth.users
  where lower(email) = 'angiepaulacaterinamolina.7@gmail.com'
),
visible_data as (
  select
    au.expected_slug,
    au.email,
    au.auth_uid,
    (
      select count(*)
      from public.users u
      join public.tenants t on t.id = u.tenant_id
      where u.auth_user_id = au.auth_uid
        and t.slug = au.expected_slug
        and u.is_active = true
        and t.is_active = true
    ) as own_user_links,
    (
      select count(*)
      from public.products p
      join public.tenants t on t.id = p.tenant_id
      where t.slug = au.expected_slug
        and p.code in ('ISO-DEMO-001', 'ISO-ANGIE-001')
    ) as products_in_own_tenant,
    (
      select count(*)
      from public.products p
      join public.tenants t on t.id = p.tenant_id
      where t.slug <> au.expected_slug
        and p.code in ('ISO-DEMO-001', 'ISO-ANGIE-001')
    ) as products_in_other_test_tenants
  from auth_users au
)
select
  expected_slug,
  email,
  auth_uid,
  case when own_user_links = 1 then 'PASS' else 'FAIL' end as user_bridge_status,
  own_user_links,
  products_in_own_tenant,
  products_in_other_test_tenants
from visible_data
order by expected_slug;
