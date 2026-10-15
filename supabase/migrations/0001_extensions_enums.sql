-- =============================================================================
-- 0001_extensions_enums.sql
-- Расширения и перечисляемые типы (enum) платформы «Точка Перевода Прогресс».
-- =============================================================================

-- Расширения
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";   -- gen_random_uuid / crypt

-- PostgreSQL не поддерживает CREATE TYPE IF NOT EXISTS, поэтому используем DO.
do $$
begin
  -- Роли пользователей
  create type public.user_role as enum (
    'guest', 'client', 'manager', 'translator', 'notary', 'printer', 'admin'
  );
exception when duplicate_object then null; end $$;

do $$
begin
  -- Тип клиента
  create type public.client_type as enum ('individual', 'company');
exception when duplicate_object then null; end $$;

do $$
begin
  -- Категории услуг
  create type public.service_category as enum (
    'translation', 'printing', 'insurance', 'additional'
  );
exception when duplicate_object then null; end $$;

do $$
begin
  -- Единица измерения услуги
  create type public.service_unit as enum ('page', 'document', 'item');
exception when duplicate_object then null; end $$;

do $$
begin
  -- Типы правил ценообразования
  create type public.price_rule_type as enum (
    'fixed', 'per_page', 'urgent', 'notary', 'delivery', 'volume'
  );
exception when duplicate_object then null; end $$;

do $$
begin
  -- Статусы заказа
  create type public.order_status as enum (
    'new', 'confirmed', 'in_progress', 'ready', 'issued', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$
begin
  -- Способ получения
  create type public.delivery_type as enum ('pickup', 'delivery');
exception when duplicate_object then null; end $$;

do $$
begin
  -- Источник заказа
  create type public.order_source as enum ('web', 'mini_app', 'bot', 'admin', 'walkin');
exception when duplicate_object then null; end $$;

do $$
begin
  -- Назначение файла
  create type public.file_kind as enum ('source', 'translation', 'receipt', 'photo', 'other');
exception when duplicate_object then null; end $$;

do $$
begin
  -- Способы оплаты
  create type public.payment_method as enum ('card', 'sbp', 'qr', 'cash', 'invoice');
exception when duplicate_object then null; end $$;

do $$
begin
  -- Статусы платежа
  create type public.payment_status as enum (
    'pending', 'waiting_for_capture', 'succeeded', 'canceled', 'refunded'
  );
exception when duplicate_object then null; end $$;

do $$
begin
  -- Каналы уведомлений
  create type public.notification_channel as enum ('telegram', 'sms', 'email', 'inapp');
exception when duplicate_object then null; end $$;

do $$
begin
  -- Статусы уведомлений
  create type public.notification_status as enum ('queued', 'sent', 'failed');
exception when duplicate_object then null; end $$;

do $$
begin
  -- Роль исполнителя в назначении
  create type public.assignment_role as enum ('translator', 'notary', 'printer', 'manager');
exception when duplicate_object then null; end $$;

do $$
begin
  -- Статусы назначения исполнителя
  create type public.assignment_status as enum (
    'assigned', 'accepted', 'in_progress', 'done', 'rejected'
  );
exception when duplicate_object then null; end $$;
