import type { BusinessSettings, PaymentChannel } from '../types';

const normalize = (value: unknown): string => String(value || '').trim().toLowerCase();

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
  if (channel.maskedReference?.trim()) return channel.maskedReference.trim();
  const raw = channel.accountNumber?.trim();
  if (!raw) return '';
  const visible = raw.replace(/\s+/g, '').slice(-4);
  return `${channel.provider || channel.name} •••• ${visible}`;
};

export const getTreasuryPaymentMethods = (
  business?: Partial<BusinessSettings>,
): string[] => [...new Map(
  [
    ...(business?.paymentModes || []),
    ...(business?.deliveryPaymentModes || []),
  ]
    .map(method => method.trim())
    .filter(Boolean)
    .map(method => [normalize(method), method]),
).values()];

export const reconcilePaymentChannels = (
  paymentMethods: string[],
  existingChannels: PaymentChannel[] = [],
  options: { currency?: string; branchId?: string } = {},
): PaymentChannel[] => {
  const methods = [...new Map(
    paymentMethods
      .map(method => method.trim())
      .filter(Boolean)
      .map(method => [normalize(method), method]),
  ).values()];
  const activeMethods = new Set(methods.map(normalize));
  const claimedChannelIds = new Set<string>();

  const reconciled = existingChannels.map(channel => {
    const linkedMethod = channel.paymentMethod?.trim();
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
  return channels.find(channel =>
    channel.status !== 'inactive' &&
    channel.status !== 'archived' &&
    normalize(channel.paymentMethod) === method,
  );
};
