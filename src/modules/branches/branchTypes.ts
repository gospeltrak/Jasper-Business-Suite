export type BranchSelectionScope = 'branch' | 'all_branches' | 'compatibility_primary' | 'no_branch_access';
export type SelectableBranchScope = Exclude<BranchSelectionScope, 'no_branch_access'>;
export type BranchRelationshipType = 'same_business' | 'independent_business';

export interface BranchSummary {
  id: string | null;
  tenantId: string;
  branchName: string;
  branchCode: string;
  businessName: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  district?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  status: 'active' | 'inactive' | 'suspended' | 'archived' | string;
  isDefault: boolean;
  isLocked: boolean;
  lockReason?: string | null;
  relationshipType?: BranchRelationshipType | null;
  setupStatus?: 'draft' | 'in_progress' | 'complete' | string;
  isCompatibilityPrimary: boolean;
  isPhysical: boolean;
  includesUnassignedHistoricalRecords: boolean;
  isSelected: boolean;
  canWrite: boolean;
}

export interface BranchDirectory {
  tenantId: string;
  usesCompatibilityPrimary: boolean;
  physicalBranchCount: number;
  activeScope: BranchSelectionScope;
  activeBranchId: string | null;
  canViewAllBranches: boolean;
  branches: BranchSummary[];
}

export interface BranchContextSnapshot extends BranchDirectory {
  selectedBranch: BranchSummary | null;
}

export interface BranchEntitlement {
  tenantId: string;
  packageId: string | null;
  subscriptionStatus: string | null;
  subscriptionEndAt: string | null;
  subscriptionCurrent: boolean;
  globalFeatureEnabled: boolean;
  tenantFeatureEnabled: boolean;
  defaultTotalBranches: number;
  additionalGrantedSlots: number;
  effectiveTotalBranches: number;
  currentPhysicalBranchCount: number;
  canOperateAdditionalBranches: boolean;
  canManageBranches: boolean;
  usesCompatibilityPrimary: boolean;
}

export interface BranchWorkspaceSnapshot {
  entitlement: BranchEntitlement;
  serverRolloutEnabled: boolean;
  directory: BranchDirectory;
  context: BranchContextSnapshot;
}

export interface CreateBranchInput {
  branchName: string;
  branchCode?: string;
  relationshipType: BranchRelationshipType;
  businessName?: string;
  address?: string;
  city?: string;
  region?: string;
  district?: string;
  country?: string;
  phone?: string;
  email?: string;
  openingDate?: string;
  managerId?: string;
}

export interface CreatedBranchResult {
  id: string;
  tenantId: string;
  branchName: string;
  branchCode: string;
  relationshipType: BranchRelationshipType;
  status: string;
  isDefault: boolean;
  setupStatus: string;
  currentBranchCount: number;
  effectiveBranchLimit: number;
}
