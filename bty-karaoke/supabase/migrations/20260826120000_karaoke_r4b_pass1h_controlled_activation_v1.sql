-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- BUILD 26U-R4B · CONTROLLED ACTIVATION OF PASS_1H — one product, one row.
-- Sorts after 20260825120000_karaoke_r4a_controlled_rollout_participation_v1.sql.
-- ADDITIVE + IDEMPOTENT. Independently reversible (see the paired deactivation migration).
--
-- WHAT `is_active = true` MEANS, per the ratified definition in the BUILD 26L catalog comment:
-- the SERVER is operationally authorized to ACCEPT a new paid transaction for this product ID.
-- It is not a claim that anything is publicly on sale. During R4B it is not, because commerce
-- VISIBILITY is separately projected through the release contract: a legacy client — including
-- the public v1.0 build 109 — receives an empty catalog no matter what this column says, and
-- only the single allowlisted controlled account can see the product at all.
--
-- SO THIS IS NOT A COMMERCE LAUNCH. It is the narrowest possible activation: one product, for
-- one controlled account, inside one allowlisted room, on a Debug build that is the only
-- configuration with a purchase call compiled in (Release does not define BTY_PAID_PASSES).
--
-- 4-HOUR AND 24-HOUR STAY INACTIVE. A one-product proof needs one product.
-- ============================================================================

-- ── A. PRE-CONDITIONS — assert the exact row this migration was reviewed against ──
--
-- Every value below was MEASURED before this file was written. If any differs, the catalog is
-- not the catalog this was approved for, and activating it would activate something else. It
-- raises rather than guessing.
do $$
declare
  r record;
  v_active int;
begin
  select product_code, storekit_product_id, pass_type, duration_seconds,
         product_kind, is_paid, is_active
    into r
    from public.karaoke_product_catalog
   where product_code = 'PASS_1H';

  if r is null then
    raise exception 'R4B precondition: PASS_1H does not exist';
  end if;
  if r.storekit_product_id is distinct from 'com.btydaily.norebang.pass.1hour' then
    raise exception 'R4B precondition: PASS_1H storekit id is %, expected com.btydaily.norebang.pass.1hour',
      r.storekit_product_id;
  end if;
  if r.product_kind is distinct from 'PAID_CONSUMABLE' then
    raise exception 'R4B precondition: PASS_1H kind is %, expected PAID_CONSUMABLE', r.product_kind;
  end if;
  if r.is_paid is distinct from true then
    raise exception 'R4B precondition: PASS_1H is_paid is %, expected true', r.is_paid;
  end if;
  if r.pass_type is distinct from 'ONE_HOUR' then
    raise exception 'R4B precondition: PASS_1H pass_type is %, expected ONE_HOUR', r.pass_type;
  end if;
  if r.duration_seconds is distinct from 3600 then
    raise exception 'R4B precondition: PASS_1H duration is %, expected 3600', r.duration_seconds;
  end if;
  -- `is_active` is deliberately NOT asserted false. Identity is asserted strictly above; the
  -- state is allowed to be either, so a re-apply is a genuine no-op rather than a failure. A
  -- migration that raises on its own second run is not idempotent, and `db push` is not the only
  -- way a file gets replayed (a restore, a rebuilt environment, a manual verification).
  if r.is_active is distinct from true and r.is_active is distinct from false then
    raise exception 'R4B precondition: PASS_1H is_active is %, expected a boolean', r.is_active;
  end if;

  -- What must NOT be true is that something ELSE is active: this migration authorizes exactly one
  -- product, and a second active row would mean a wider commerce surface than was measured.
  select count(*) into v_active
    from public.karaoke_product_catalog where is_active and product_code <> 'PASS_1H';
  if v_active <> 0 then
    raise exception 'R4B precondition: % product(s) other than PASS_1H are active, expected 0', v_active;
  end if;

  -- The controlled boundary must already be in place, or an activation would have a wider
  -- audience than the one that was measured.
  if (select premium_room_mode from public.karaoke_usage_policy where policy_key = 'default')
     is distinct from 'dual_allowlist' then
    raise exception 'R4B precondition: premium_room_mode is not dual_allowlist';
  end if;
  if (select count(*) from public.karaoke_premium_room_rollout) <> 1 then
    raise exception 'R4B precondition: the allowlist must hold exactly one pair';
  end if;
end $$;

-- ── B. THE UPDATE — exactly one row, exactly one column ──
--
-- Guarded on `is_active = false` as well, so a concurrent apply cannot double-write, and the
-- statement is a no-op on re-run (idempotent).
update public.karaoke_product_catalog
   set is_active = true, updated_at = now()
 where product_code = 'PASS_1H'
   and storekit_product_id = 'com.btydaily.norebang.pass.1hour'
   and product_kind = 'PAID_CONSUMABLE'
   and duration_seconds = 3600
   and is_active = false;

-- ── C. POST-CONDITIONS — exactly one active product, and it is PASS_1H ──
do $$
declare v_active int; v1 boolean; v4 boolean; v24 boolean;
begin
  select is_active into v1  from public.karaoke_product_catalog where product_code = 'PASS_1H';
  select is_active into v4  from public.karaoke_product_catalog where product_code = 'PASS_4H';
  select is_active into v24 from public.karaoke_product_catalog where product_code = 'PASS_24H';
  select count(*) into v_active from public.karaoke_product_catalog where is_active;

  if v1 is distinct from true   then raise exception 'R4B postcondition: PASS_1H is %', v1;  end if;
  if v4 is distinct from false  then raise exception 'R4B postcondition: PASS_4H is %', v4;  end if;
  if v24 is distinct from false then raise exception 'R4B postcondition: PASS_24H is %', v24; end if;
  if v_active <> 1 then raise exception 'R4B postcondition: % active product(s), expected 1', v_active; end if;
end $$;

-- ── D. WHAT THIS FILE DOES NOT TOUCH ──
--
-- No purchase, no grant, no audit row, no entitlement, no Event, no rollout row, no mode, and no
-- product identity: the StoreKit id, kind, pass_type and duration are ASSERTED and never written.
-- Its entire effect is one boolean on one row.
