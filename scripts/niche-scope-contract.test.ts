import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('registration exposes only retail/wholesale and pharmacy', () => {
  const login = read('src/components/LoginPage.tsx');
  const server = read('server.ts');

  assert.match(login, /Retail & Wholesale/);
  assert.match(login, /Pharmacy/);
  assert.doesNotMatch(login, /option value="restaurant"/i);
  assert.doesNotMatch(login, /option value="hotel"/i);
  assert.match(server, /canonicalBusinessType/);
  assert.match(server, /\['retail', 'wholesale', 'retail & wholesale', 'retail and wholesale'\]/);
  assert.match(server, /requestedBusinessType === 'pharmacy'/);
});

test('removed niches have no demo identities or reachable dashboard routes', () => {
  const data = read('src/data.ts');
  const dashboard = read('src/components/Dashboard.tsx');
  const isolation = read('src/utils/tenantIsolation.ts');

  for (const removedId of ['t-hotel-01', 't-restaurant-01']) {
    assert.doesNotMatch(data, new RegExp(removedId));
    assert.doesNotMatch(isolation, new RegExp(removedId));
  }

  assert.doesNotMatch(dashboard, /DashboardHotelPMS/);
  assert.doesNotMatch(dashboard, /DashboardRestaurant/);
  assert.doesNotMatch(dashboard, /hotel-pms/);
  assert.doesNotMatch(dashboard, /restaurant-hub/);
  assert.match(dashboard, /businessType === 'pharmacy'/);
});
