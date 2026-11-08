alter table public.user_skills
  add column if not exists security_scan jsonb,
  add column if not exists security_scan_hash text,
  add column if not exists security_scan_status text not null default 'unscanned'
    check (security_scan_status in ('unscanned','safe','blocked','incomplete')),
  add column if not exists security_scanned_at timestamptz,
  add column if not exists security_scanner_version text;

create index if not exists user_skills_security_status_idx
  on public.user_skills (user_id, security_scan_status);
