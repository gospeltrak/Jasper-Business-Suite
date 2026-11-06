import {defineConfig, devices} from '@playwright/test';
export default defineConfig({
 testDir:'./',
 testMatch:/turnstile\.spec\.mjs$/,
 timeout:25000,
 expect:{timeout:9000},
 workers:1,
 retries:0,
 reporter:process.env.CI ? 'list' : 'list',
 use:{baseURL:'http://127.0.0.1:4174',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
  {name:'chromium-desktop',use:{...devices['Desktop Chrome'],viewport:{width:1365,height:900}}},
  {name:'chromium-phone',use:{...devices['Pixel 5']}},
  {name:'chromium-tablet',use:{...devices['iPad (gen 7)'],browserName:'chromium'}},
 ],
 webServer:{
  command:'npx vite --host 127.0.0.1 --port 4174 --strictPort',
  url:'http://127.0.0.1:4174/e2e/turnstile.html',
  reuseExistingServer:true,
  timeout:45000,
  env:{VITE_SUPABASE_URL:'',VITE_SUPABASE_ANON_KEY:'',VITE_TURNSTILE_SITE_KEY:'isolated-e2e-test-site-key'}
 }
});
