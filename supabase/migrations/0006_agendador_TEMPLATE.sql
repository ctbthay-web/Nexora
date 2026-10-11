-- Nexora - Agendador persistente (roda no Supabase, independe do app aberto e do seu computador).
-- NÃO commite este arquivo preenchido. Troque os dois valores entre <> e execute no SQL Editor.
--   <ENDERECO_DO_APP>  ex.: https://nexora-three-xi-83.vercel.app
--   <CRON_SECRET>      o MESMO valor que você colocou na variável CRON_SECRET da Vercel
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('nexora-tick') where exists (select 1 from cron.job where jobname = 'nexora-tick');
select cron.schedule(
  'nexora-tick',
  '*/5 * * * *',
  $$ select net.http_post(
       url := '<ENDERECO_DO_APP>/api/cron/tick',
       headers := jsonb_build_object('content-type','application/json','authorization','Bearer <CRON_SECRET>'),
       body := '{}'::jsonb,
       timeout_milliseconds := 55000
     ); $$
);
