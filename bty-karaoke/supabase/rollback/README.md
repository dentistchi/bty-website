# Staged rollback migrations — deliberately NOT in `supabase/migrations/`

`supabase db push` applies **every** pending file in `supabase/migrations/`. A rollback authored
alongside its forward migration and left in that directory would therefore be applied by the same
push, silently undoing the change it exists to reverse.

So a rollback that is written *in advance* — because writing one under pressure, after something
has gone wrong, is when it is most likely to be wrong itself — is staged here instead.

**To apply one:** move it into `supabase/migrations/` and push. Its filename already carries a
timestamp that sorts after the migration it reverses, so ordering is preserved.

| File | Reverses | Apply when |
|---|---|---|
| `20260827120000_karaoke_r4b_pass1h_deactivation_v1.sql` | `20260826120000_..._pass1h_controlled_activation_v1.sql` | BUILD 26U-R4C closure, or immediately if a stop condition fires — in particular if a legacy client is ever observed seeing PASS_1H |
