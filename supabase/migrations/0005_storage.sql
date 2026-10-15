-- =============================================================================
-- 0005_storage.sql
-- Приватный бакет файлов заказов + политики доступа к storage.objects.
-- Клиенты получают файлы через подписанные URL (TTL 5 мин), генерируемые
-- сервером; прямые операции разрешены только сотрудникам.
-- =============================================================================

-- Бакет (idempotent). 50 МБ на файл, разрешённые типы.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-files',
  'order-files',
  false,
  52428800,
  array[
    'image/jpeg','image/png','image/webp','image/heic','image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Политики на объектах бакета. Путь объекта: orders/{order_id}/{token}-{имя}.
-- Права те же, что на заказ (can_view_order); запись — менеджер или назначенный
-- исполнитель (загрузка перевода). Клиенты загружают через /api/upload (service_role).
drop policy if exists order_files_select on storage.objects;
create policy order_files_select on storage.objects
  for select to authenticated using (
    bucket_id = 'order-files'
    and (storage.foldername(name))[1] = 'orders'
    and public.can_view_order(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists order_files_insert on storage.objects;
create policy order_files_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'order-files'
    and (storage.foldername(name))[1] = 'orders'
    and (
      public.is_manager()
      or public.is_assigned_to_order(((storage.foldername(name))[2])::uuid)
    )
  );

drop policy if exists order_files_update on storage.objects;
create policy order_files_update on storage.objects
  for update to authenticated using (bucket_id = 'order-files' and public.is_manager());

drop policy if exists order_files_delete on storage.objects;
create policy order_files_delete on storage.objects
  for delete to authenticated using (bucket_id = 'order-files' and public.is_manager());
