export type JasperModuleCategory = 'wholesale_retail' | 'pharmacy' | 'microsoko';

export type MicroSokoItemType = 
    | 'raw_material' 
    | 'packaging_asset' 
    | 'label_asset' 
    | 'finished_good' 
    | 'by_product' 
    | 'operational_overhead';

export type TrackingMeasurementMode = 'metric_standard' | 'estimate_visual';

export type MicroSokoBillingTier = 'soko_siku_daily' | 'soko_wiki_weekly' | 'soko_mwezi_monthly';

// Extends existing item structure assuming a base POS item interface.
export interface MicroSokoItem {
    id: string;
    tenant_id: string;
    name: string;
    sku: string;
    module_owner: JasperModuleCategory;
    microsoko_type: MicroSokoItemType;
    tracking_mode: TrackingMeasurementMode;
    standard_metric_unit?: string; // e.g. kg, L, pcs
    base_cost: number;
    selling_price: number;
    stock_qty: number;
    created_at?: string;
    updated_at?: string;
}

export interface ContainerCalibration {
    id: string;
    tenant_id: string;
    bulk_item_id: string;
    container_name: string;
    units_per_bulk_parent: number;
    created_at?: string;
    updated_at?: string;
}

export interface MicroSokoBatch {
    id: string;
    tenant_id: string;
    batch_reference: string;
    raw_material_base_cost: number;
    inbound_freight_cost: number;
    packaging_materials_cost: number;
    labeling_branding_cost: number;
    processing_overheads_cost: number;
    outbound_market_freight_cost: number;
    by_product_recovered_revenue: number;
    primary_output_item_id: string;
    total_yield_quantity_produced: number;
    calculated_true_market_unit_cost: number;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    created_at?: string;
    created_by?: string;
}

export interface MicroSokoSubscription {
    id: string;
    tenant_id: string;
    billing_tier: MicroSokoBillingTier;
    amount_paid: number;
    payment_vendor_code?: string;
    activation_date?: string;
    expiry_date: string;
    status: 'active' | 'expired' | 'cancelled';
    created_at?: string;
}

export interface POSItem {
    id: string;
    name: string;
    price: number;
    icon: string; // Emoji or short icon text
    category?: string;
}

export interface CartItem {
    id: string;
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
}
