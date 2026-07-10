select
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at
from auth.users
where lower(email) in (
  'ale.97.28@gmail.com',
  'angiepaulacaterinamolina.7@gmail.com'
)
order by email;
