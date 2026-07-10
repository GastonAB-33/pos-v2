-- POS V2 - Validacion RLS simulando usuarios autenticados.
--
-- Ejecutar con un rol que pueda hacer SET LOCAL ROLE authenticated.
-- No modifica datos.

begin;

create temp table pos_rls_test_results (
  test_user text,
  check_name text,
  status text,
  details text
) on commit drop;

grant insert, select on pos_rls_test_results to authenticated;

do $$
declare
  v_demo_uid uuid;
  v_angie_uid uuid;
  v_count integer;
  v_visible_codes text;
begin
  select id into v_demo_uid
  from auth.users
  where lower(email) = 'ale.97.28@gmail.com'
  limit 1;

  select id into v_angie_uid
  from auth.users
  where lower(email) = 'angiepaulacaterinamolina.7@gmail.com'
  limit 1;

  if v_demo_uid is null or v_angie_uid is null then
    raise exception 'Faltan usuarios Auth demo/angie';
  end if;

  perform set_config('request.jwt.claim.sub', v_demo_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into v_count
  from public.tenants;

  insert into pos_rls_test_results
  values (
    'ale.97.28@gmail.com',
    'solo ve un tenant',
    case when v_count = 1 then 'PASS' else 'FAIL' end,
    'tenants visibles=' || v_count::text
  );

  select string_agg(code, ', ' order by code) into v_visible_codes
  from public.products
  where code in ('ISO-DEMO-001', 'ISO-ANGIE-001');

  insert into pos_rls_test_results
  values (
    'ale.97.28@gmail.com',
    'solo ve producto demo',
    case when v_visible_codes = 'ISO-DEMO-001' then 'PASS' else 'FAIL' end,
    'productos visibles=' || coalesce(v_visible_codes, '-')
  );

  reset role;

  perform set_config('request.jwt.claim.sub', v_angie_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into v_count
  from public.tenants;

  insert into pos_rls_test_results
  values (
    'angiepaulacaterinamolina.7@gmail.com',
    'solo ve un tenant',
    case when v_count = 1 then 'PASS' else 'FAIL' end,
    'tenants visibles=' || v_count::text
  );

  select string_agg(code, ', ' order by code) into v_visible_codes
  from public.products
  where code in ('ISO-DEMO-001', 'ISO-ANGIE-001');

  insert into pos_rls_test_results
  values (
    'angiepaulacaterinamolina.7@gmail.com',
    'solo ve producto angie',
    case when v_visible_codes = 'ISO-ANGIE-001' then 'PASS' else 'FAIL' end,
    'productos visibles=' || coalesce(v_visible_codes, '-')
  );

  reset role;
end $$;

select *
from pos_rls_test_results
order by test_user, check_name;

rollback;
