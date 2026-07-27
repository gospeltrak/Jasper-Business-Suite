import { getSecureDataBridgeClient } from '../secureDataBridge';
import type {
  BranchContextSnapshot,
  BranchDirectory,
  BranchEntitlement,
  SelectableBranchScope,
  BranchWorkspaceSnapshot,
  CreateBranchInput,
  CreatedBranchResult,
} from './branchTypes';

export class BranchApiError extends Error {
  readonly status: number;
  readonly reasonCode?: string;

  constructor(message: string, status: number, reasonCode?: string) {
    super(message);
    this.name = 'BranchApiError';
    this.status = status;
    this.reasonCode = reasonCode;
  }
}

const getAccessToken = async () => {
  const client = await getSecureDataBridgeClient();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new BranchApiError('Please sign in again to manage branches.', 401, 'not_authenticated');
  }
  return data.session.access_token;
};

const requestBranchApi = async <T>(
  path: string,
  token: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> => {
  const response = await fetch(path, {
    ...init,
    signal,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new BranchApiError(
      String(payload?.error || 'Branch request could not be completed.'),
      response.status,
      payload?.reasonCode ? String(payload.reasonCode) : undefined,
    );
  }
  return payload as T;
};

export const loadBranchWorkspace = async (signal?: AbortSignal): Promise<BranchWorkspaceSnapshot> => {
  const token = await getAccessToken();
  const [entitlementResponse, directoryResponse, contextResponse] = await Promise.all([
    requestBranchApi<{ entitlement: BranchEntitlement; serverRolloutEnabled: boolean }>(
      '/api/branches/entitlement', token, {}, signal,
    ),
    requestBranchApi<{ branchDirectory: BranchDirectory }>('/api/branches', token, {}, signal),
    requestBranchApi<{ context: BranchContextSnapshot }>('/api/branches/context', token, {}, signal),
  ]);

  return {
    entitlement: entitlementResponse.entitlement,
    serverRolloutEnabled: entitlementResponse.serverRolloutEnabled,
    directory: directoryResponse.branchDirectory,
    context: contextResponse.context,
  };
};

export const selectBranch = async (branchId: string | null, scope: SelectableBranchScope) => {
  const token = await getAccessToken();
  const response = await requestBranchApi<{ context: BranchContextSnapshot }>(
    '/api/branches/select',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ branchId, scope }),
    },
  );
  return response.context;
};

export const activatePrimaryBranch = async () => {
  const token = await getAccessToken();
  const response = await requestBranchApi<{ context: BranchContextSnapshot }>(
    '/api/branches/activate-primary',
    token,
    { method: 'POST', body: JSON.stringify({}) },
  );
  return response.context;
};

export const createBranch = async (input: CreateBranchInput) => {
  const token = await getAccessToken();
  const response = await requestBranchApi<{ branch: CreatedBranchResult }>(
    '/api/branches',
    token,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return response.branch;
};

export interface CrossBranchDocumentSourceBranch {
  id: string;
  branchName: string;
  branchCode: string;
  businessName: string;
  isDefault: boolean;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  branding?: Record<string, unknown>;
}

export interface CrossBranchDocumentSourceProduct {
  branchId: string;
  productId: string;
  quantity: number;
  sellingPrice: number | null;
  wholesalePrice: number | null;
}

export interface CrossBranchDocumentSources {
  branches: CrossBranchDocumentSourceBranch[];
  products: CrossBranchDocumentSourceProduct[];
}

export interface CrossBranchCommercialDocumentInput {
  issuingBranchId: string;
  documentType: 'price_quote' | 'proforma_invoice';
  documentNumber: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  issueDate: string;
  currency: string;
  discountAmount: number;
  taxAmount: number;
  deliveryAmount: number;
  notes?: string;
  items: Array<{
    sourceBranchId: string;
    productId: string;
    productName: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export const loadCrossBranchDocumentSources = async (): Promise<CrossBranchDocumentSources> => {
  const token = await getAccessToken();
  const response = await requestBranchApi<{ sources: CrossBranchDocumentSources }>(
    '/api/branches/document-sources',
    token,
  );
  return response.sources;
};

export const createCrossBranchCommercialDocument = async (
  document: CrossBranchCommercialDocumentInput,
) => {
  const token = await getAccessToken();
  const response = await requestBranchApi<{
    document: {
      documentId: string;
      documentNumber: string;
      subtotal: number;
      total: number;
      itemCount: number;
      brandingSnapshot: Record<string, unknown>;
    };
  }>('/api/branches/commercial-documents', token, {
    method: 'POST',
    body: JSON.stringify({ document }),
  });
  return response.document;
};

export const convertCrossBranchCommercialDocument = async (
  documentId: string,
  idempotencyKey: string,
) => {
  const token = await getAccessToken();
  const response = await requestBranchApi<{
    conversion: {
      documentId: string;
      saleGroupId: string;
      consolidatedReference: string;
      total: number;
      alreadyConverted: boolean;
      branchSales?: Array<{
        saleId: string;
        branchId: string;
        reference: string;
        total: number;
        paymentStatus: 'unpaid';
      }>;
    };
  }>(`/api/branches/commercial-documents/${encodeURIComponent(documentId)}/convert`, token, {
    method: 'POST',
    body: JSON.stringify({ idempotencyKey }),
  });
  return response.conversion;
};

export const transferStockBetweenBranches = async (input: {
  fromBranchId: string;
  toBranchId: string;
  productId: string;
  quantity: number;
  idempotencyKey: string;
  notes?: string;
}) => {
  const token = await getAccessToken();
  const response = await requestBranchApi<{
    transfer: {
      transferId: string;
      fromBranchId: string;
      toBranchId: string;
      productId: string;
      quantity: number;
      status: 'received';
    };
  }>('/api/branches/stock-transfers', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.transfer;
};
