-- Module-level notification settings for Jasper niches/modules.
-- Each row is tenant-specific and module-specific so Wholesale & Retail,
-- MicroSoko, Pharmacy, and future modules can route reports separately.

create table if not exists public.jasper_module_notification_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  module_name text not null,
  receiver_name text,
  receiver_role text,
  whatsapp_number text,
  backup_whatsapp_number text,
  email_address text,
  sms_phone_number text,
  timezone text not null default 'Africa/Dar_es_Salaam',
  enable_in_app boolean not null default true,
  enable_whatsapp boolean not null default false,
  enable_email boolean not null default false,
  enable_sms boolean not null default false,
  enable_push boolean not null default false,
  enable_sale_notifications boolean not null default false,
  enable_morning_summary boolean not null default true,
  enable_end_day_profit_loss boolean not null default true,
  enable_end_day_expenses boolean not null default true,
  enable_weekly_summary boolean not null default true,
  enable_monthly_summary boolean not null default true,
  enable_low_stock_alerts boolean not null default true,
  enable_price_alerts boolean not null default false,
  enable_cash_alerts boolean not null default false,
  enable_loss_warnings boolean not null default true,
  morning_summary_time text not null default '07:00',
  end_day_report_time text not null default '21:00',
  weekly_summary_day text not null default 'Monday',
  monthly_summary_day text not null default '1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jasper_module_notification_settings_unique unique (tenant_id, module_name),
  constraint jasper_module_notification_settings_whatsapp_format check (
    whatsapp_number is null or whatsapp_number = '' or whatsapp_number ~ '^[+][1-9][0-9]{8,14}
  )
);

create index if not exists idx_jasper_module_notification_settings_tenant
  on public.jasper_module_notification_settings (tenant_id);

create index if not exists idx_jasper_module_notification_settings_module
  on public.jasper_module_notification_settings (module_name);

  )
);

create index if not exists idx_jasper_module_notification_settings_tenant
  on public.jasper_module_notification_settings (tenant_id);

create index if not exists idx_jasper_module_notification_settings_module
  on public.jasper_module_notification_settings (module_name);
