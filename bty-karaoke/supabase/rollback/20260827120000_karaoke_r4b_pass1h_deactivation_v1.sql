-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- BUILD 26U-R4B · PASS_1H DEACTIVATION — the paired rollback. NOT APPLIED IN R4B.
-- Sorts after 20260826120000_karaoke_r4b_pass1h_controlled_activation_v1.sql.
--
-- AUTHORED ALONGSIDE THE ACTIVATION, ON PURPOSE. A reversal written under time pressure, after
-- something has gone wrong, is the one most likely to be wrong itself. This exists now so the
-- rollback is a reviewed artifact rather than an improvisation, and so §19's stop conditions
-- have something concrete to point at.
--
-- APPLY IT when the controlled validation ends (R4C closure), or immediately if a stop condition
-- fires — in particular if a legacy client is ever observed seeing PASS_1H.
--
-- WHAT DEACTIVATION DOES NOT DO. It withdraws the server's authorization to ACCEPT NEW paid
-- transactions. It does not refund, revoke, expire or invalidate anything already bought:
-- `/verify` and `/fulfil` deliberately do not consult `is_active` (BUILD 26T-R1A-R2 Contract B),
-- so a purchase a customer legitimately made still settles, and a grant already issued keeps
-- working until its own clock runs out. Money that moved stays honoured.
-- ============================================================================

do $$
declare v_active int;
begin
  if not exists (select 1 from public.karaoke_product_catalog where product_code = 'PASS_1H') then
    raise exception 'R4B rollback: PASS_1H does not exist';
  end if;

  update public.karaoke_product_catalog
     set is_active = false, updated_at = now()
   where product_code = 'PASS_1H'
     and storekit_product_id = 'com.btydaily.norebang.pass.1hour'
     and is_active = true;

  select count(*) into v_active from public.karaoke_product_catalog where is_active;
  if v_active <> 0 then
    raise exception 'R4B rollback: % product(s) still active, expected 0', v_active;
  end if;
end $$;

-- Touches no purchase, grant, audit row, entitlement, Event, rollout row or mode.
