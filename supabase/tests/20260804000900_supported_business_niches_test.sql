begin;

select plan(4);

select has_check(
  'public',
  'tenants',
  'tenants_supported_business_type_check',
  'supported tenant business types are enforced'
);

select lives_ok(
  $$update public.tenants set business_type = business_type
    where id in (
      '64ba3572-b61f-4142-826c-e6fa48eab169',
      '7395ceb5-6132-4a93-a01e-79c78bba7c13'
    )$$,
  'protected Retail/Wholesale and Pharmacy tenant values remain valid'
);

select throws_ok(
  $$insert into public.tenants (id, name, business_type)
    values ('00000000-0000-0000-0000-000000000008', 'Removed niche test', 'hotel')$$,
  '23514',
  null,
  'hotel is rejected'
);

select throws_ok(
  $$insert into public.tenants (id, name, business_type)
    values ('00000000-0000-0000-0000-000000000009', 'Removed niche test', 'restaurant')$$,
  '23514',
  null,
  'restaurant is rejected'
);

select * from finish();
rollback;
