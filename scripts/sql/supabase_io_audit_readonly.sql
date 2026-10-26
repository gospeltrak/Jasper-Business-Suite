-- READ-ONLY disk I/O and legacy backup audit.
-- Does not delete, update, archive, move or copy any user data.
-- Run in Supabase SQL Editor only when database is responsive.
begin transaction read only;

-- Disk footprint. tenant_data stores historical snapshots in TOAST.
select pg_size_pretty(pg_database_size(current_database())) as database_size,
       pg_size_pretty(pg_total_relation_size('public.tenant_data')) as tenant_data_size,
       pg_size_pretty(pg_total_relation_size('public.tenant_data') -
         pg_relation_size('public.tenant_data') -
         pg_indexes_size('public.tenant_data')) as tenant_data_toast_and_aux;

-- Count current rows and protected legacy history by tenant WITHOUT returning
-- user payloads, names, financial information, or credentials.
select tenant_id,
       count(*) filter (where data_key like 'data_backup_%'
                         and data_key not like 'data_backup_latest_%') as historical_data_backups,
       count(*) filter (where data_key like 'workspace_backup_%'
                         and data_key <> 'workspace_backup_latest') as historical_workspace_backups,
       count(*) filter (where data_key like 'data_backup_latest_%'
                         or data_key = 'workspace_backup_latest') as rolling_backups,
       count(*) filter (where data_key not like 'data_backup_%'
                         and data_key not like 'workspace_backup_%'
                         and data_key not like 'manual_backup_%'
                         and data_key not like '%recovery_backup%') as other_keys
from public.tenant_data group by tenant_id order by historical_data_backups desc limit 30;

-- PostgreSQL cumulative counters can span weeks/months; compare snapshots
-- across time rather than calling these measurements today's usage.
select datname,stats_reset,temp_files,
       pg_size_pretty(temp_bytes) as cumulative_temp_io,
       round(blks_hit*100.0/nullif(blks_hit+blks_read,0),2) as cumulative_cache_hit_pct
from pg_stat_database where datname=current_database();

-- Aggregate query costs; truncated SQL never includes bind values.
select left(regexp_replace(query,'\s+',' ','g'),150) as query_shape,
       calls,round(mean_exec_time::numeric,1) as mean_ms,
       round(total_exec_time::numeric/1000,1) as cumulative_sec,
       temp_blks_written,shared_blks_read
from extensions.pg_stat_statements
where dbid=(select oid from pg_database where datname=current_database())
  and calls > 1
order by temp_blks_written desc nulls last limit 15;

commit;
