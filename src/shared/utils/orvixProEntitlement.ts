import { getSecureDataBridgeClient } from '../dataBridge/secureDataBridge';

export const ORVIX_PRO_PACKAGE = Object.freeze({
  id: 'orvix_pro',
  name: 'Orvix Pro',
  pricingStatus: 'to_be_set',
  activation: 'private_admin_only',
  selfServiceCheckout: false,
});

export interface OrvixProFeatures {
  settle: boolean;
  shiftReports: boolean;
  cashierAccountability: boolean;
  parkSale: boolean;
}

export const ORVIX_PRO_DISABLED: Readonly<OrvixProFeatures> = Object.freeze({
  settle: false,
  shiftReports: false,
  cashierAccountability: false,
  parkSale: false,
});

/**
 * The server, never localStorage or the selected base subscription, is the
 * source of truth for this separately provisioned, paid-later add-on.
 * Missing auth, connectivity or entitlement fails CLOSED.
 */
export async function loadOrvixProFeatures(signal?: AbortSignal): Promise<OrvixProFeatures> {
  try {
    const client = await getSecureDataBridgeClient();
    const { data, error } = await client.auth.getSession();
    if (error || !data.session?.access_token) return { ...ORVIX_PRO_DISABLED };
    const response = await fetch('/api/orvix-pro/entitlement', {
      method: 'GET',
      signal,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) return { ...ORVIX_PRO_DISABLED };
    const payload = await response.json();
    if (payload?.package !== 'orvix_pro' || payload?.enabled !== true) {
      return { ...ORVIX_PRO_DISABLED };
    }
    return {
      settle: payload.features?.settle === true,
      shiftReports: payload.features?.shiftReports === true,
      cashierAccountability: payload.features?.cashierAccountability === true,
      parkSale: payload.features?.parkSale === true,
    };
  } catch {
    return { ...ORVIX_PRO_DISABLED };
  }
}
