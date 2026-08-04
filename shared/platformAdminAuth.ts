export const isStrictPlatformAdminProfile = (profile: any): boolean =>
  Boolean(
    profile?.is_active === true &&
    profile?.account_type === 'super_admin' &&
    profile?.tenant_id == null &&
    profile?.active_tenant == null
  );
