-- Requer a role app_user (npm run db:criar-role-app) criada ANTES de db:migrate.
grant usage on schema public to app_user;
--> statement-breakpoint
grant select, insert, update, delete on all tables in schema public to app_user;
--> statement-breakpoint
grant usage, select on all sequences in schema public to app_user;
--> statement-breakpoint
-- funções security definer: só app_user (e o dono) executam
revoke execute on all functions in schema public from public;
--> statement-breakpoint
grant execute on all functions in schema public to app_user;
--> statement-breakpoint
-- objetos futuros criados pelo dono (quem roda as migrações)
do $$
begin
  execute format('alter default privileges for role %I in schema public grant select, insert, update, delete on tables to app_user', current_user);
  execute format('alter default privileges for role %I in schema public grant usage, select on sequences to app_user', current_user);
  execute format('alter default privileges for role %I revoke execute on functions from public', current_user);
  execute format('alter default privileges for role %I in schema public grant execute on functions to app_user', current_user);
end
$$;
