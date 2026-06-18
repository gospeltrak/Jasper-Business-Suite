# Supabase Database Schema Generation Prompt

*Copy and paste the prompt below into ChatGPT, Claude, or directly into the Supabase SQL Editor if you want to run the raw SQL immediately. This covers all tables, types, foreign keys, and seed data exactly as mapped in the `src/types.ts` interface definition for the Jasper application.*

---

**Prompt:**

You are an expert PostgreSQL database architect. I need a complete, highly-detailed SQL schema designed for **Supabase** that accurately represents the data models of my Point-of-Sale (POS) and Inventory Management System. 

The application is multitenant, so most tables should link to a `tenants` table. 

Below are the exact requirements and table structures needed. Please generate a single, flawless PostgreSQL script that creates these tables (with `IF NOT EXISTS`), defines proper data types, Primary/Foreign constraints (`ON DELETE CASCADE` where appropriate), default values, `updated_at` triggers, and includes some initial **seed data**.

### 1. Requirements & Core Types
- Enable the `uuid-ossp` extension to use UUIDs for primary keys.
- Use `TIMESTAMPTZ` for timestamps.
- Use `DECIMAL(15,2)` for financial figures to guarantee precision.
- Use `JSONB` for flexible settings objects and dynamic arrays.

### 2. Main Tables Needed:

1. **`tenants`**
   - Fields: `id` (UUID), `name`, `country`, `city`, `currency`, `currency_code`, `tax_rate`, `mobile_money_providers` (JSONB array), `business_type`, `company_settings` (JSONB), `business_settings` (JSONB), `invoice_settings` (JSONB), `created_at`, `updated_at`.
2. **`custom_roles`**
   - Fields: `id`, `tenant_id` (FK), `name`, `permissions` (JSONB), `created_at`.
3. **`users`**
   - Fields: `id`, `email`, `name`, `role` (Admin/Cashier/Manager), `tenant_id` (FK), `active_tenant` (FK), `profile_image`, `is_duress` (boolean), `is_saas_staff` (boolean), `phone`, `password_hash`, `trial_start_date`, `trial_end_date`, `custom_role_id` (FK), `created_at`.
4. **`products`**
   - Fields: `id`, `tenant_id` (FK), `name`, `sku`, `barcode`, `category`, `unit`, `cost_price`, `selling_price`, `stock_qty`, `shop_stock_qty`, `store_stock_qty`, `alert_qty`, `image`, `brand`, `tabs_per_pack`, `allows_dosage_dividing` (bool), `sell_in_retail` (bool), `sell_in_wholesale` (bool), `wholesale_price`, `min_wholesale_qty`, `created_at`, `updated_at`.
5. **`sales`**
   - Fields: `id`, `tenant_id` (FK), `reference`, `total`, `tax`, `delivery_cost`, `delivery_payment_method`, `discount`, `discount_type`, `payment_method`, `customer_name`, `customer_phone`, `staff_name`, `cashier_name`, `amount_paid`, `amount_due`, `vat_status`, `vfd_control_no`, `vfd_signature`, `multi_cash_amount`, `multi_bank_amount`, `channel` (retail/wholesale), `approvals` (JSONB), `sync_status`, `timestamp`, `actual_timestamp`, `created_at`.
6. **`sale_items`**
   - Fields: `id`, `sale_id` (FK), `product_id` (FK to products, ON DELETE SET NULL), `product_name`, `qty`, `price`, `discount`, `discount_type`, `dosage_type`, `tabs_selected`, `tabs_per_pack`, `channel`, `created_at`.
7. **`expenses`**
   - Fields: `id`, `tenant_id` (FK), `category`, `amount`, `description`, `staff_name`, `receipt_ref`, `receipt_image`, `transaction_message`, `note`, `timestamp`, `created_at`.
8. **`suppliers`**
   - Fields: `id`, `tenant_id` (FK), `name`, `contact_person`, `phone`, `email`, `categories` (JSONB), `created_at`.
9. **`purchases`**
   - Fields: `id`, `tenant_id` (FK), `supplier_id` (FK), `supplier_name`, `total_amount`, `amount_paid`, `amount_due`, `destination`, `delivery_status`, `discount`, `discount_type`, `delivery_fee`, `timestamp`, `created_at`.
10. **`purchase_items`**
    - Fields: `id`, `purchase_id` (FK), `product_id` (FK), `product_name`, `qty`, `cost_price`, `created_at`.
11. **`delivery_riders`**
    - Fields: `id`, `tenant_id` (FK), `name`, `phone`, `vehicle_type`, `classification`, `vehicle_color`, `license_plate`, `signature_image`, `created_at`.
12. **`deliveries`**
    - Fields: `id`, `sale_id` (FK), `tenant_id` (FK), `customer_name`, `customer_phone`, `total_amount`, `delivery_cost`, `delivery_payment_method`, `status`, `rider_id` (FK), `rider_details` (JSONB), `notes`, `timestamp`, `dispatched_at`, `delivered_at`, `created_at`.
13. **`sales_documents`** (Quotations, Proformas)
    - Fields: `id`, `tenant_id` (FK), `type`, `document_number`, `total`, `tax`, `delivery_cost`, `has_vat`, `customer_name`, `customer_phone`, `customer_address`, `notes`, `status`, `converted_sale_id` (FK), `tagline`, `timestamp`, `created_at`.
14. **`sales_document_items`**
    - Fields: `id`, `sales_document_id` (FK), `product_id` (FK), `product_name`, `qty`, `price`, `discount`, `discount_type`, `created_at`.
15. **`payment_channels`**
    - Fields: `id`, `tenant_id` (FK), `name`, `category` (telco/bank/physical), `provider`, `account_number`, `created_at`.
16. **`ledger_entries`**
    - Fields: `id`, `tenant_id` (FK), `channel_id` (FK), `amount`, `entry_type` (debit/credit), `source_type`, `description`, `reference_id` (UUID), `counter_party_channel_id` (FK), `receipt_file`, `muamala_file`, `timestamp`, `created_at`.

### 3. Seed Data
Please generate standard INSERT statements to create:
- 1 Demo Tenant (e.g. 'Jasper HQ', Location: Tanzania/Dar es Salaam, Currency: TZS, Tax Rate: 0.18).
- 1 Admin User associated with the demo tenant.
- 1 Sample Payment Channel (Cash).
- 2 Demo Products.

Generate only valid raw PostgreSQL code ready to run in Supabase. Include the `updated_at` trigger function and apply it to `tenants` and `products`.

---

*(You can feed the prompt above into your chosen AI or use the query directly in the SQL Editor to provision your Supabase backend!)*
