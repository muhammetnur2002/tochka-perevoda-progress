begin;
do $$
declare client_id uuid; order_id uuid; legacy_order uuid;
begin
  assert public.normalize_phone('61 23-45-67') = '99361234567';
  assert public.normalize_phone('+993 (61) 23-45-67') = '99361234567';
  assert public.normalize_phone('0099361234567') = '99361234567';
  assert public.normalize_phone('+79171234567') = '79171234567';
  insert into public.clients(name, phone) values ('TM test', '99361000000') returning id into client_id;
  insert into public.orders(client_id) values(client_id) returning id into order_id;
  assert (select currency = 'TMT' from public.orders where id = order_id);
  insert into public.orders(client_id, currency) values(client_id, 'RUB') returning id into legacy_order;
  begin
    insert into public.payments(order_id, amount, currency, method, provider)
    values(order_id, 10, 'RUB', 'cash', 'manual');
    raise exception 'Mixed currency payment accepted';
  exception when raise_exception then
    if sqlerrm <> 'Payment currency must match order currency' then raise; end if;
  end;
  begin
    update public.orders set currency = 'TMT' where id = legacy_order;
    raise exception 'Historical currency was changed';
  exception when raise_exception then
    if sqlerrm <> 'Order currency cannot be changed' then raise; end if;
  end;
  assert (select currency = 'RUB' from public.orders where id = legacy_order);
end;
$$;
rollback;
