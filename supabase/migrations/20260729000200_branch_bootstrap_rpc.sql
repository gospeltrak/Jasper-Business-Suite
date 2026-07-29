-- Return the complete current-user branch bootstrap in one authenticated RPC.
-- This is additive and preserves every existing branch/RLS decision.

create or replace function public.get_current_branch_bootstrap()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_entitlement jsonb;
  v_context jsonb;
begin
  v_entitlement := public.get_current_branch_entitlement();
  v_context := public.get_current_branch_context();

  return jsonb_build_object(
    'entitlement', v_entitlement,
    'directory', v_context,
    'context', v_context
  );
end;
$$;

revoke all on function public.get_current_branch_bootstrap() from public, anon;
grant execute on function public.get_current_branch_bootstrap() to authenticated;
