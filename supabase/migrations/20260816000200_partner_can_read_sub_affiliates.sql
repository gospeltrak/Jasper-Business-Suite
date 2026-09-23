-- Partners could not read their own sub-affiliates through the direct/RLS
-- fallback path (only the service-role API path worked): the affiliates_read_scoped
-- policy had no clause for a Partner (affiliate_partners row) reading affiliates
-- whose parent_super_agent_id points at them. referred_customers already has the
-- equivalent clause (20260812000300_close_legacy_public_rls.sql); affiliates was
-- missed. Additive only: replaces one policy's USING expression, no schema change.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop policy if exists affiliates_read_scoped on public.affiliates;
create policy affiliates_read_scoped on public.affiliates for select to authenticated
  using (
    user_id = auth.uid()
    or private.is_platform_admin()
    or private.is_assigned_affiliate_agent(id)
    or exists (
      select 1 from public.affiliate_partners p
      where p.user_id = auth.uid()
        and p.id::text = affiliates.parent_super_agent_id
    )
  );

commit;
