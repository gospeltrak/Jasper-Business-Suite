import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const server = fs.readFileSync('server.ts', 'utf8');
const vercel = fs.readFileSync('vercel.json', 'utf8');
const dashboard = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');
const dashboardStaff = fs.readFileSync('src/components/DashboardStaff.tsx', 'utf8');
const dashboardSettings = fs.readFileSync('src/components/DashboardSettings.tsx', 'utf8');
const loginPage = fs.readFileSync('src/components/LoginPage.tsx', 'utf8');
const login = fs.readFileSync('src/components/LoginPage.tsx', 'utf8');
const admin = fs.readFileSync('src/components/SuperSaaSAdminView.tsx', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260812000300_close_legacy_public_rls.sql', 'utf8');
const productImageHandler = fs.readFileSync('api/images/migrate-product.ts', 'utf8');
const repositoryAudit = fs.readFileSync('scripts/security-repository-audit.mjs', 'utf8');
const packageJson = fs.readFileSync('package.json', 'utf8');
const notificationContext = fs.readFileSync('src/JasperNotificationContext.tsx', 'utf8');
const notificationSettings = fs.readFileSync('src/components/DashboardNotificationsSettings.tsx', 'utf8');
const platformNotificationsMigration = fs.readFileSync('supabase/migrations/20260814000100_platform_notifications.sql', 'utf8');
const statusRequests = fs.readFileSync('src/components/SaaSStatusAndRequests.tsx', 'utf8');
const pwaInstallBanner = fs.readFileSync('src/components/PWAInstallBanner.tsx', 'utf8');
const landingBundle = fs.readFileSync('public/orvix-landing/app.js', 'utf8');
const landingPage = fs.readFileSync('src/components/LandingPage.tsx', 'utf8');
const webEditor = fs.readFileSync('src/components/SaaSWebEditor.tsx', 'utf8');
const landingStyles = fs.readFileSync('public/orvix-landing/styles.css', 'utf8');
const paymentPackageLockMigration = fs.readFileSync('supabase/migrations/20260814000200_lock_payment_proof_package.sql', 'utf8');
const systemErrorPage = fs.readFileSync('src/components/SystemErrorPage.tsx', 'utf8');
const appErrorBoundary = fs.readFileSync('src/components/AppErrorBoundary.tsx', 'utf8');
const dashboardErrorBoundary = fs.readFileSync('src/components/DashboardScreenErrorBoundary.tsx', 'utf8');
const safeErrors = fs.readFileSync('shared/safeErrors.ts', 'utf8');
const serviceWorker = fs.readFileSync('public/sw.js', 'utf8');
const appShell = fs.readFileSync('index.html', 'utf8');

test('Super Admin is Google and fresh-MFA only with three attempts', () => {
  assert.match(login, /Super Admin password login is disabled/);
  assert.match(login, /Google \+ Authenticator required/);
  assert.doesNotMatch(server, /super-admin\/verify-password/);
  assert.match(admin, /nextAttempts >= 3/);
  assert.match(admin, /signOut\(\{ scope: 'global' \}\)/);
  assert.match(admin, /prepareSuperAdminMfa\(true\)/);
  assert.match(login, /adminMfaAttempts \+ 1/);
  assert.match(server, /super-admin-security-event/);
});

test('all Super Admin APIs enforce server profile authorization and writes require AAL2', () => {
  assert.match(server, /app\.use\('\/api\/super-admin'[\s\S]*await requirePlatformAdmin\(req\)/);
  assert.match(server, /!\['GET', 'HEAD'\]\.includes\(req\.method\)[\s\S]*!== 'aal2'/);
  assert.match(server, /super-admin-api'[\s\S]*max: 90/);
});

test('API mutations reject cross-site browser requests and costly tools require an active session', () => {
  assert.match(server, /app\.use\('\/api', protectBrowserApiMutations\)/);
  assert.match(server, /fetchSite === 'cross-site'/);
  assert.match(server, /app\.post\('\/api\/tools\/remove-bg'[\s\S]*await requireActiveUser\(req\)/);
  assert.match(server, /phone-lookup'[\s\S]*max: 10/);
});

test('public landing data is projected without exposing private Web Editor state', () => {
  const publicRecordTypes = server.slice(server.indexOf('const PUBLIC_PLATFORM_RECORD_TYPES'), server.indexOf('const PUBLIC_LANDING_TEXT_KEYS'));
  assert.doesNotMatch(publicRecordTypes, /'web_editor_settings'/);
  assert.match(publicRecordTypes, /'public_landing_settings'/);
  assert.match(server, /sanitizePublicLandingSettings/);
  assert.match(server, /if \(!PUBLIC_PLATFORM_RECORD_TYPES\.has\(recordType\)\)[\s\S]*if \(!supabaseAdmin\)/);
  assert.match(server, /recordType === 'web_editor_settings'[\s\S]*record_type: 'public_landing_settings'/);
  assert.doesNotMatch(server.slice(server.indexOf('const sanitizePublicLandingSettings'), server.indexOf('const isUuid')), /partnerWaitlist|partnerCapacity/);
});

test('production Turnstile is fail-closed and landing assets have a restrictive CSP', () => {
  assert.match(server, /const isProduction = process\.env\.NODE_ENV === 'production' \|\| Boolean\(process\.env\.VERCEL_ENV\)/);
  assert.match(server, /return !isProduction/);
  assert.match(server, /Content-Security-Policy/);
  assert.match(server, /object-src 'none'/);
  assert.match(server, /frame-ancestors 'self'/);
  assert.match(server, /sha256-\+4ZACLmWNrkCmdB9Fqi4malsKm2fp80y5Pri\+gSPmoU=/);
  assert.match(vercel, /Content-Security-Policy/);
  assert.match(vercel, /object-src 'none'/);
});

test('platform record writes require JSON and public landing responses are cache bounded', () => {
  assert.match(server, /app\.put\('\/api\/super-admin\/platform-records\/:type\/:scope'[\s\S]*req\.is\('application\/json'\)/);
  assert.match(server, /stale-while-revalidate=300/);
});

test('customer landing logos are optimized, authorized, and rendered from public URLs only', () => {
  assert.match(webEditor, /file\.size > 2 \* 1024 \* 1024/);
  assert.match(webEditor, /compressImageFile\(file,[\s\S]*maxWidth: 640[\s\S]*mimeType: 'image\/webp'/);
  assert.match(webEditor, /Authorization: `Bearer \$\{session\.access_token\}`/);
  assert.match(server, /app\.post\('\/api\/super-admin\/landing-customer-logo'[\s\S]*await requirePlatformAdmin\(req\)/);
  assert.match(server, /originalFileSize > 2 \* 1024 \* 1024/);
  assert.match(server, /\^data:image\\\/webp;base64/);
  assert.match(server, /'RIFF'[\s\S]*'WEBP'/);
  assert.match(server, /landing-customers\/\$\{logoId\}\.webp/);
  assert.match(server, /contentType: 'image\/webp'[\s\S]*cacheControl: '31536000'[\s\S]*upsert: false/);
  assert.match(landingBundle, /fetch\('\/api\/platform-records\/public_landing_settings\/global'/);
  assert.match(landingBundle, /image\.src=logo\.logoUrl/);
  assert.match(landingBundle, /set\.replaceChildren\(\)/);
  assert.match(landingStyles, /\.logo-set img\{[^}]*object-fit:contain/);
});

test('staff passwords are verified by Auth and purged from legacy workspace payloads', () => {
  assert.match(server, /signInWithPassword\(\{[\s\S]*email: normalizeEmail\(profile\.email\)[\s\S]*password/);
  assert.match(server, /purgeLegacyWorkspaceStaffPassword/);
  assert.match(server, /const \{ password: _removedPassword, \.\.\.safeStaff \}/);
  assert.doesNotMatch(dashboard, /password:\s*'password123'/);
  assert.doesNotMatch(dashboardStaff, /password:\s*(?:password|credentialPassword|generated)/);
  assert.doesNotMatch(dashboardSettings, /password:\s*staffForm\.password/);
  assert.doesNotMatch(loginPage, /jasper_password_overrides/);
  assert.doesNotMatch(loginPage, /password:\s*staff\.password\s*\|\|\s*'password123'/);
  assert.match(loginPage, /if \(\(import\.meta as any\)\.env\?\.PROD\)[\s\S]*Local development demo fallback/);
});

test('tenant login is Google-only for owners, administrators, and staff', () => {
  assert.match(loginPage, /const tenantGoogleOnlySignIn = !isSaasAdminPortal/);
  assert.match(loginPage, /tenantGoogleOnlySignIn \? \([\s\S]*data-tenant-google-only="true"/);
  assert.match(loginPage, /Owners, administrators and staff sign in with the Google account connected to this business/);
  const tenantGoogleStart = loginPage.indexOf('{tenantGoogleOnlySignIn ? (');
  const tenantPasswordFallback = loginPage.indexOf('id="login-email"', tenantGoogleStart);
  const tenantConditionalEnd = loginPage.indexOf('</>}', tenantPasswordFallback);
  assert.ok(tenantGoogleStart >= 0 && tenantPasswordFallback > tenantGoogleStart && tenantConditionalEnd > tenantPasswordFallback);
});

test('tenant image uploads require JSON, tenant authorization, and verified file signatures', () => {
  const logoRoute = server.slice(
    server.indexOf("app.post('/api/tenant/logo'"),
    server.indexOf('// Bulk Sales Synchronization Endpoint'),
  );
  const productRoute = server.slice(
    server.indexOf("app.post('/api/images/migrate-product'"),
    server.indexOf("app.post('/api/sales/sync'"),
  );

  assert.match(logoRoute, /req\.is\('application\/json'\)/);
  assert.match(logoRoute, /await requireTenantUser\(req, String\(tenantId\)\)/);
  assert.match(logoRoute, /allowedLogo\.magic\(buffer\)/);
  assert.match(logoRoute, /allowedLogo\.ext/);
  assert.match(productRoute, /req\.is\('application\/json'\)/);
  assert.match(productRoute, /await requireTenantUser\(req, String\(tenantId\)\)/);
  assert.match(productRoute, /allowed\.magic\(buffer\)/);
  assert.match(productRoute, /Image could not be saved securely/);
  assert.match(productImageHandler, /Content-Type application\/json is required/);
  assert.match(productImageHandler, /allowed\.magic\(buffer\)/);
  assert.match(productImageHandler, /belongsToTenant/);
});

test('repository verification blocks tracked secrets and exposes a production dependency audit', () => {
  assert.match(repositoryAudit, /git', \['ls-files', '-z'\]/);
  assert.match(repositoryAudit, /\.env\.example/);
  assert.match(repositoryAudit, /PRIVATE KEY/);
  assert.match(repositoryAudit, /Secret values are intentionally redacted/);
  assert.match(packageJson, /"security:secrets": "node scripts\/security-repository-audit\.mjs"/);
  assert.match(packageJson, /"security:dependencies": "npm audit --audit-level=high --omit=dev"/);
  assert.match(packageJson, /"verify:source": "[^"]*npm run security:secrets/);
});

test('notification inbox is server-authorized, tenant scoped, and in-app only', () => {
  const notificationApi = server.slice(
    server.indexOf("app.get('/api/notifications/inbox'"),
    server.indexOf("app.use('/api/super-admin'", server.indexOf("app.get('/api/notifications/inbox'")),
  );
  assert.match(server, /requireNotificationInboxUser/);
  assert.match(server, /profileRoles\.some\(role => \['admin', 'owner', 'tenant_admin'\]\.includes\(role\)\)/);
  assert.match(notificationApi, /recipient_user_id', access\.user\.id/);
  assert.match(notificationApi, /tenant_id', access\.tenantId/);
  assert.match(notificationApi, /delivery_channel', 'in_app'/);
  assert.match(notificationContext, /fetch\('\/api\/notifications\/inbox'/);
  assert.doesNotMatch(notificationContext, /setItem\('jasper_notifications'/);
  assert.match(notificationSettings, /In-app notifications/);
  assert.doesNotMatch(notificationSettings, /Send Test WhatsApp Report|WhatsApp Number for Reports/);
});

test('Super Admin notifications are durable and critical payment mutations stay server-side', () => {
  assert.match(platformNotificationsMigration, /create table if not exists public\.platform_notification_events/);
  assert.match(platformNotificationsMigration, /create table if not exists public\.platform_notification_reads/);
  assert.match(platformNotificationsMigration, /force row level security/);
  assert.match(platformNotificationsMigration, /revoke all on table public\.platform_notification_events from anon, authenticated/);
  assert.match(platformNotificationsMigration, /platform_payment_proof_notification/);
  assert.match(platformNotificationsMigration, /platform_affiliate_notification/);
  assert.match(platformNotificationsMigration, /platform_partner_notification/);
  assert.match(server, /from\('platform_notification_events'\)/);
  assert.match(server, /from\('platform_notification_reads'\)\.upsert/);
  const proofRoute = server.slice(
    server.indexOf("app.post('/api/subscriptions/payment-proof-file'"),
    server.indexOf("app.get('/api/super-admin/payment-proofs", server.indexOf("app.post('/api/subscriptions/payment-proof-file'")),
  );
  assert.match(proofRoute, /adminTable\('tenant_payment_proofs'\)[\s\S]*\.insert\(proofRecord\)/);
  assert.match(proofRoute, /signatureMatches/);
  assert.doesNotMatch(dashboard, /from\('tenant_payment_proofs'\)[\s\S]*\.insert/);
  assert.match(statusRequests, /\/api\/super-admin\/payment-proofs\/\$\{encodeURIComponent\(proof\.id\)\}\/reject/);
  assert.doesNotMatch(statusRequests, /from\('tenant_payment_proofs'\)[\s\S]*\.update/);
});

test('manual receipts are optimized images and payment approval cannot change the selected package', () => {
  assert.match(dashboard, /manualActivationReceipt\.size > 2 \* 1024 \* 1024/);
  assert.match(dashboard, /compressImageFile\(manualActivationReceipt,[\s\S]*maxWidth: 1600[\s\S]*mimeType: 'image\/webp'/);
  assert.match(dashboard, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(dashboard, /Jina la kampuni: \$\{activeTenant\.name\}/);
  assert.match(dashboard, /Kifurushi nilicholipia: \$\{SUBSCRIPTION_PLANS\[selectedPlanId\]\.name\}/);
  assert.match(server, /originalFileSize > 2 \* 1024 \* 1024/);
  assert.match(server, /proof\.requested_package_id[\s\S]*!== packageId/);
  assert.match(paymentPackageLockMigration, /before update of status on public\.tenant_payment_proofs/);
  assert.match(paymentPackageLockMigration, /v_active_package_id is distinct from lower\(new\.requested_package_id\)/);
  assert.doesNotMatch(paymentPackageLockMigration, /delete\s+from|truncate|drop\s+table/i);
});

test('system error pages are localized and never render technical error details', () => {
  for (const status of [401, 403, 404, 500]) assert.match(systemErrorPage, new RegExp(`${status}:`));
  assert.match(systemErrorPage, /en:[\s\S]*sw:[\s\S]*fr:/);
  assert.match(appErrorBoundary, /<SystemErrorPage status=\{500\}/);
  assert.match(dashboardErrorBoundary, /<SystemErrorPage status=\{500\}/);
  assert.doesNotMatch(appErrorBoundary, /this\.state\.error\.message|componentStack/);
  assert.doesNotMatch(dashboardErrorBoundary, /developmentError|this\.state\.error\.message/);
  assert.match(server, /app\.use\('\/api'[\s\S]*'NOT_FOUND', 404/);
  assert.match(server, /const platformAdminError[\s\S]*makeSafeErrorResponse/);
  assert.match(server, /\['\/401', 401\], \['\/403', 403\], \['\/404', 404\], \['\/500', 500\]/);
  assert.match(server, /knownAppPath \? 200 : 404/);
  assert.match(safeErrors, /SafeErrorLanguage = 'en' \| 'sw' \| 'fr'/);
});

test('installed PWAs automatically activate each new deployment without caching tenant data', () => {
  assert.match(serviceWorker, /ORVIX_BUILD_VERSION = '__ORVIX_BUILD_VERSION__'/);
  assert.match(serviceWorker, /self\.skipWaiting\(\)/);
  assert.match(serviceWorker, /self\.clients\.claim\(\)/);
  assert.match(serviceWorker, /caches\.keys\(\)[\s\S]*caches\.delete/);
  assert.doesNotMatch(serviceWorker, /caches\.open|cache\.put|respondWith/);
  assert.match(appShell, /controllerchange[\s\S]*window\.location\.reload\(\)/);
  assert.match(appShell, /registration\.update\(\)[\s\S]*60000/);
  assert.match(server, /app\.get\('\/sw\.js'/);
  assert.match(server, /createHash\('sha256'\)\.update\(appShell\)\.digest\('hex'\)/);
  assert.match(server, /Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0'/);
  assert.match(server, /replace\('__ORVIX_BUILD_VERSION__', deploymentVersion\)/);
});

test('legacy public policies are replaced with tenant, affiliate, partner, or platform ownership', () => {
  for (const policy of ['tenant_data_select','workspace_select','proofs_select','ap_select','rc_select','cl_select','mr_select','asl_select','mal_select']) {
    assert.match(migration, new RegExp(`drop policy if exists ${policy}`));
  }
  assert.doesNotMatch(migration, /to public[\s\S]*(using|with check) \(?(true)\)?/i);
  assert.match(migration, /private\.current_tenant_id/);
  assert.match(migration, /private\.current_affiliate_id/);
  assert.match(migration, /private\.is_platform_admin/);
});

test('Super Admin PWA is separate and only launches from the More menu', () => {
  assert.match(dashboard, /businessName="Orvix Super Admin"/);
  assert.match(dashboard, /appId="\/admin"/);
  assert.match(dashboard, /startUrl="\/admin"/);
  assert.match(dashboard, /automaticPrompt=\{false\}/);
  assert.match(dashboard, /label: 'Install Admin App'/);
  assert.match(dashboard, /item\.id === 'install-orvix-app'[\s\S]*requestManualInstallPrompt\(\)/);
  assert.match(pwaInstallBanner, /if \(!enabled \|\| !automaticPrompt \|\| !tenantId/);
  assert.match(pwaInstallBanner, /id: resolvedAppId/);
  assert.match(pwaInstallBanner, /start_url: resolvedStartUrl/);
});

test('landing language and login navigation are instant and deterministic', () => {
  assert.match(landingBundle, /href="#pricing">Pricing<\/a><a href="#login">Login<\/a>/);
  assert.match(landingBundle, /syncLanguagePicker\(option\.dataset\.lang\)/);
  assert.match(landingBundle, /syncLanguagePicker\(savedLanguage\)/);
  assert.match(landingBundle, /2 branches included; Can add more/);
  assert.match(landingBundle, /if\(value==='WhatsApp report notifications'\)item\.remove\(\)/);
  assert.match(landingPage, /if \(href === '#login'\)[\s\S]*onNavigate\('\/login'\)/);
});
