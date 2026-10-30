import type { BusinessSettings, PaymentChannel, PaymentModeConfig } from '../../types';

const normalize = (value: unknown): string => String(value || '').trim().toLowerCase();

export const getPaymentModeName = (mode: string | PaymentModeConfig): string =>
  typeof mode === 'string' ? mode.trim() : String(mode?.name || '').trim();

const classifyPaymentMethod = (method: string): PaymentChannel['category'] => {
  const value = normalize(method);
  if (/cash|drawer|petty/.test(value)) return 'physical';
  if (/m-?pesa|airtel|mixx|yas|tigo|halo|mobile|momo/.test(value)) return 'telco';
  return 'bank';
};

const stableMethodId = (method: string): string => {
  const slug = normalize(method)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42) || 'payment';
  let hash = 2166136261;
  for (const char of normalize(method)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `payment-${slug}-${(hash >>> 0).toString(36)}`;
};

export const getMaskedAccountReference = (channel?: PaymentChannel): string => {
  if (!channel) return '';
  const existingMaskedReference = String(channel.maskedReference || '').trim();
  if (existingMaskedReference) return existingMaskedReference;
  const raw = String(channel.accountNumber || '').trim();
  if (!raw) return '';
  const visible = raw.replace(/\s+/g, '').slice(-4);
  return `${String(channel.provider || channel.name || 'Account')} •••• ${visible}`;
};

export const getTreasuryPaymentMethods = (
  business?: Partial<BusinessSettings>,
): string[] => [...new Map(
  [
    ...(business?.paymentModes || []),
    ...(business?.deliveryPaymentModes || []),
  ]
    .map(getPaymentModeName)
    .filter(Boolean)
    .map(method => [normalize(method), method]),
).values()];

export const reconcilePaymentChannels = (
  paymentMethods: string[],
  existingChannels: PaymentChannel[] = [],
  options: { currency?: string; branchId?: string } = {},
): PaymentChannel[] => {
  const safeExistingChannels = (Array.isArray(existingChannels) ? existingChannels : [])
    .flatMap((candidate, index) => {
      if (!candidate || typeof candidate !== 'object') return [];
      const channel = { ...candidate } as PaymentChannel;
      const identity = String(
        channel.id ||
        channel.paymentMethod ||
        channel.name ||
        channel.provider ||
        `legacy-account-${index + 1}`,
      ).trim();
      channel.id = channel.id ? String(channel.id) : stableMethodId(identity);
      return [channel];
    });
  const methods = [...new Map(
    (Array.isArray(paymentMethods) ? paymentMethods : [])
      .map(method => String(method || '').trim())
      .filter(Boolean)
      .map(method => [normalize(method), method]),
  ).values()];
  const activeMethods = new Set(methods.map(normalize));
  const claimedChannelIds = new Set<string>();

  const reconciled = safeExistingChannels.map(channel => {
    const linkedMethod = String(channel.paymentMethod || '').trim();
    if (!linkedMethod) return channel;
    const isActive = activeMethods.has(normalize(linkedMethod));
    claimedChannelIds.add(channel.id);
    const maskedReference = getMaskedAccountReference(channel);
    return {
      ...channel,
      currency: channel.currency || options.currency || 'TZS',
      branchId: channel.branchId || options.branchId,
      ...(maskedReference ? { maskedReference } : {}),
      status: isActive ? 'active' as const : 'inactive' as const,
    };
  });

  for (const method of methods) {
    const normalizedMethod = normalize(method);
    const linked = reconciled.find(channel => normalize(channel.paymentMethod) === normalizedMethod);
    if (linked) continue;

    const legacy = reconciled.find(channel =>
      !channel.paymentMethod &&
      channel.status !== 'archived' &&
      (
        normalize(channel.name) === normalizedMethod ||
        normalize(channel.provider) === normalizedMethod
      ),
    );
    if (legacy) {
      legacy.paymentMethod = method;
      legacy.currency = legacy.currency || options.currency || 'TZS';
      legacy.branchId = legacy.branchId || options.branchId;
      legacy.maskedReference = getMaskedAccountReference(legacy) || undefined;
      legacy.status = 'active';
      claimedChannelIds.add(legacy.id);
      continue;
    }

    let id = stableMethodId(method);
    let suffix = 2;
    while (claimedChannelIds.has(id) || reconciled.some(channel => channel.id === id)) {
      id = `${stableMethodId(method)}-${suffix++}`;
    }
    claimedChannelIds.add(id);
    const category = classifyPaymentMethod(method);
    reconciled.push({
      id,
      name: category === 'physical' ? `${method} Account` : method,
      category,
      provider: method,
      paymentMethod: method,
      currency: options.currency || 'TZS',
      branchId: options.branchId,
      status: 'active',
    });
  }

  return reconciled;
};

export const findPaymentChannel = (
  channels: PaymentChannel[],
  paymentMethod: string,
): PaymentChannel | undefined => {
  const method = normalize(paymentMethod);
  return (Array.isArray(channels) ? channels : []).find(channel =>
    Boolean(channel) &&
    channel.status !== 'inactive' &&
    channel.status !== 'archived' &&
    normalize(channel.paymentMethod) === method,
  );
};

/**
 * Receivables collection uses the same reconciled Money & Bank channels as
 * checkout. The legacy invoice/settings screen may list "Mpesa" even when
 * systemSettings.paymentChannels has not been initialized yet; looking only
 * in that raw array prevents every installment from being recorded.
 *
 * Never invent an account for a payment method explicitly disabled in Money
 * & Bank, reactivate an archived channel, select a different branch's
 * account, or treat "Credit" as an incoming payment.
 */
export const getDebtCollectionPaymentChannels = (
  business?: Partial<BusinessSettings>,
  existingChannels: PaymentChannel[] = [],
  options: { currency?: string; branchId?: string } = {},
): PaymentChannel[] => {
  const original = Array.isArray(existingChannels) ? existingChannels : [];
  const configured = getTreasuryPaymentMethods(business);
  const methods = (configured.length ? configured : original.map(
    channel => channel.paymentMethod || channel.name || '',
  ))
    .filter(method => method && !/^credit$/i.test(method.trim()));

  // Spelling variants such as "M-Pesa" / "Mpesa" / "M Pesa" must
  // resolve to the SAME configured account rather than creating a second
  // Money & Bank account for an old tenant.
  const methodIdentity = (value: string): string => normalize(value).replace(/[\s_-]/g, '');
  const usableMethods = methods.filter(method => {
    const matches = original.filter(channel =>
      methodIdentity(channel.paymentMethod || channel.name || channel.provider || '') === methodIdentity(method),
    );
    // An explicitly disabled mode must never be silently reactivated.
    return matches.length === 0 || matches.some(channel =>
      channel.status !== 'inactive' &&
      channel.status !== 'archived' &&
      (!options.branchId || !channel.branchId || channel.branchId === options.branchId),
    );
  });
  const enabled = new Set(usableMethods.map(normalize));
  const disabledIds = new Set(original
    .filter(channel => channel.status === 'inactive' || channel.status === 'archived')
    .map(channel => channel.id));

  const aligned = original.map(channel => {
    const matches = usableMethods.filter(method =>
      methodIdentity(channel.paymentMethod || channel.name || channel.provider || '') === methodIdentity(method),
    );
    return matches.length === 1 ? { ...channel, paymentMethod: matches[0] } : channel;
  });
  const candidates = reconcilePaymentChannels(usableMethods, aligned, options).filter(channel =>
    !!channel.id &&
    !!channel.paymentMethod &&
    enabled.has(normalize(channel.paymentMethod)) &&
    !disabledIds.has(channel.id) &&
    channel.category !== 'person' &&
    channel.status !== 'inactive' &&
    channel.status !== 'archived' &&
    (!options.branchId || !channel.branchId || channel.branchId === options.branchId),
  );
  // This form selects a payment METHOD, not an individual bank account.
  // Never silently choose an arbitrary account when a tenant has multiple
  // accounts assigned to the same method.
  return candidates.filter(channel => candidates.filter(other =>
    normalize(other.paymentMethod) === normalize(channel.paymentMethod)).length === 1);

};
