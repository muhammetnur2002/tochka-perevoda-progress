-- =============================================================================
-- 0008_realtime.sql
-- Realtime-подписки: канбан менеджера (orders), уведомления и чат Mini App.
-- Supabase Realtime уважает RLS: клиент получает только события по своим строкам.
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.orders;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.chat_messages;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.order_assignments;
    exception when duplicate_object then null; end;
  end if;
end $$;

-- Полные строки в событиях UPDATE (нужны старый/новый статус для канбана)
alter table public.orders replica identity full;
