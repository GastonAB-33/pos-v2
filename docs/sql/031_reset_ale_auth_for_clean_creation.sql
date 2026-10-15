-- POS V2 - Liberar correo ale.97.28@gmail.com para crearlo desde cero en la pantalla de La25
--
-- Usar este script SI PREFERIS crearlo directamente desde el formulario de la aplicacion
-- con la contrasena y datos que vos elijas:
--
-- 1. Este script desvincula y borra de forma segura el usuario previo de Supabase Auth.
-- 2. Deja el correo libre para que 'Crear usuario' en la interfaz funcione inmediatamente.

begin;

do $$
declare
  v_email text := 'ale.97.28@gmail.com';
  v_auth_user_id uuid;
  v_public_user_id text;
begin
  select id into v_auth_user_id
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  select id into v_public_user_id
  from public.users
  where lower(email) = lower(v_email)
     or (v_auth_user_id is not null and auth_user_id = v_auth_user_id)
  limit 1;

  if v_public_user_id is not null then
    -- Desvincular referencias que impidan borrar o setear null
    update public.audit_logs set user_id = null where user_id = v_public_user_id;
    update public.cash_sessions set closed_by_user_id = null where closed_by_user_id = v_public_user_id;
    
    -- Si no abrio cajas activas, eliminar el registro
    delete from public.users where id = v_public_user_id;
    raise notice 'Registro public.users para % eliminado.', v_email;
  end if;

  if v_auth_user_id is not null then
    delete from auth.users where id = v_auth_user_id;
    raise notice 'Usuario auth.users para % eliminado. Correo liberado.', v_email;
  else
    raise notice 'El correo % ya no existe en auth.users.', v_email;
  end if;
end $$;

commit;

-- Verificacion: debe devolver 0 filas
select id, email from auth.users where lower(email) = 'ale.97.28@gmail.com';
