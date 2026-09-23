-- Close legacy permissive policies without mutating or deleting tenant data.
begin;

drop policy if exists affiliates_insert on public.affiliates;
drop policy if exists affiliates_insert_authenticated on public.affiliates;
create policy affiliates_insert_authenticated on public.affiliates for insert to authenticated
  with check (user_id = (select auth.uid()) or (select private.is_platform_admin()));

-- Tenant-owned compatibility stores.
drop policy if exists tenant_data_select on public.tenant_data;
drop policy if exists tenant_data_insert on public.tenant_data;
drop policy if exists tenant_data_update on public.tenant_data;
drop policy if exists tenant_data_delete on public.tenant_data;
drop policy if exists tenant_data_scoped_read on public.tenant_data;
drop policy if exists tenant_data_scoped_insert on public.tenant_data;
drop policy if exists tenant_data_scoped_update on public.tenant_data;
drop policy if exists tenant_data_scoped_delete on public.tenant_data;
create policy tenant_data_scoped_read on public.tenant_data for select to authenticated
  using (tenant_id = (select private.current_tenant_id())::text or (select private.is_platform_admin()));
create policy tenant_data_scoped_insert on public.tenant_data for insert to authenticated
  with check (tenant_id = (select private.current_tenant_id())::text or (select private.is_platform_admin()));
create policy tenant_data_scoped_update on public.tenant_data for update to authenticated
  using (tenant_id = (select private.current_tenant_id())::text or (select private.is_platform_admin()))
  with check (tenant_id = (select private.current_tenant_id())::text or (select private.is_platform_admin()));
create policy tenant_data_scoped_delete on public.tenant_data for delete to authenticated
  using (tenant_id = (select private.current_tenant_id())::text or (select private.is_platform_admin()));

drop policy if exists workspace_select on public.tenant_workspaces;
drop policy if exists workspace_insert on public.tenant_workspaces;
drop policy if exists workspace_update on public.tenant_workspaces;
drop policy if exists workspace_scoped_read on public.tenant_workspaces;
drop policy if exists workspace_scoped_insert on public.tenant_workspaces;
drop policy if exists workspace_scoped_update on public.tenant_workspaces;
create policy workspace_scoped_read on public.tenant_workspaces for select to authenticated
  using (tenant_id = (select private.current_tenant_id()) or (select private.is_platform_admin()));
create policy workspace_scoped_insert on public.tenant_workspaces for insert to authenticated
  with check (tenant_id = (select private.current_tenant_id()) or (select private.is_platform_admin()));
create policy workspace_scoped_update on public.tenant_workspaces for update to authenticated
  using (tenant_id = (select private.current_tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.current_tenant_id()) or (select private.is_platform_admin()));

drop policy if exists proofs_select on public.tenant_payment_proofs;
drop policy if exists proofs_insert on public.tenant_payment_proofs;
drop policy if exists proofs_update on public.tenant_payment_proofs;
drop policy if exists proofs_scoped_read on public.tenant_payment_proofs;
drop policy if exists proofs_scoped_insert on public.tenant_payment_proofs;
drop policy if exists proofs_platform_update on public.tenant_payment_proofs;
create policy proofs_scoped_read on public.tenant_payment_proofs for select to authenticated
  using (tenant_id = (select private.current_tenant_id()) or (select private.is_platform_admin()));
create policy proofs_scoped_insert on public.tenant_payment_proofs for insert to authenticated
  with check (tenant_id = (select private.current_tenant_id()) and submitted_by = (select auth.uid()));
create policy proofs_platform_update on public.tenant_payment_proofs for update to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));

-- Partner records are self-owned; tenant users cannot enumerate or mutate them.
drop policy if exists ap_select on public.affiliate_partners;
drop policy if exists ap_insert on public.affiliate_partners;
drop policy if exists ap_update on public.affiliate_partners;
drop policy if exists ap_delete on public.affiliate_partners;
drop policy if exists partner_self_read on public.affiliate_partners;
drop policy if exists partner_self_update on public.affiliate_partners;
drop policy if exists partner_platform_insert on public.affiliate_partners;
drop policy if exists partner_platform_delete on public.affiliate_partners;
create policy partner_self_read on public.affiliate_partners for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_platform_admin()));
create policy partner_self_update on public.affiliate_partners for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_platform_admin()))
  with check (user_id = (select auth.uid()) or (select private.is_platform_admin()));
create policy partner_platform_insert on public.affiliate_partners for insert to authenticated
  with check ((select private.is_platform_admin()));
create policy partner_platform_delete on public.affiliate_partners for delete to authenticated
  using ((select private.is_platform_admin()));

-- Attribution rows are visible only to their affiliate, parent partner, or platform admin.
drop policy if exists rc_select on public.referred_customers;
drop policy if exists rc_insert on public.referred_customers;
drop policy if exists rc_update on public.referred_customers;
drop policy if exists referred_customers_scoped_read on public.referred_customers;
drop policy if exists referred_customers_platform_write on public.referred_customers;
create policy referred_customers_scoped_read on public.referred_customers for select to authenticated
  using (
    affiliate_id = (select private.current_affiliate_id())::text
    or sub_affiliate_id = (select private.current_affiliate_id())::text
    or exists (select 1 from public.affiliate_partners p where p.user_id = (select auth.uid()) and p.id::text = parent_super_agent_id)
    or (select private.is_platform_admin())
  );
create policy referred_customers_platform_write on public.referred_customers for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));

-- Financial reconciliation and security logs have no trustworthy tenant key.
-- Keep them server/service-role and AAL2 platform-admin only.
drop policy if exists cl_select on public.commission_ledger;
drop policy if exists cl_insert on public.commission_ledger;
drop policy if exists cl_update on public.commission_ledger;
drop policy if exists mr_select on public.monthly_reconciliation;
drop policy if exists mr_insert on public.monthly_reconciliation;
drop policy if exists mr_update on public.monthly_reconciliation;
drop policy if exists asl_select on public.account_status_logs;
drop policy if exists asl_insert on public.account_status_logs;
drop policy if exists mal_select on public.mirror_access_logs;
drop policy if exists mal_insert on public.mirror_access_logs;
drop policy if exists commission_ledger_platform_only on public.commission_ledger;
drop policy if exists monthly_reconciliation_platform_only on public.monthly_reconciliation;
drop policy if exists account_status_logs_platform_only on public.account_status_logs;
drop policy if exists mirror_access_logs_platform_only on public.mirror_access_logs;

create policy commission_ledger_platform_only on public.commission_ledger for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy monthly_reconciliation_platform_only on public.monthly_reconciliation for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy account_status_logs_platform_only on public.account_status_logs for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy mirror_access_logs_platform_only on public.mirror_access_logs for all to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));

revoke all on public.tenant_data, public.tenant_workspaces, public.tenant_payment_proofs,
  public.affiliate_partners, public.referred_customers, public.commission_ledger,
  public.monthly_reconciliation, public.account_status_logs, public.mirror_access_logs from anon;

commit;
