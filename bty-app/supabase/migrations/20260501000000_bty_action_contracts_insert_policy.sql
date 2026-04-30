do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bty_action_contracts'
      and policyname = 'Users can insert their own action contracts'
  ) then
    create policy "Users can insert their own action contracts"
    on public.bty_action_contracts
    for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;
end
$$;
