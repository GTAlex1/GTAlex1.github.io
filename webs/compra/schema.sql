begin;

create schema shopping_private;

create function shopping_private.valid_ingredients(value jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
    select case when jsonb_typeof(value) = 'array' then
        jsonb_array_length(value) between 1 and 40
        and not exists (
            select from jsonb_array_elements(value) as item(ingredient)
            where not coalesce(case when jsonb_typeof(ingredient) = 'object' then
                ingredient ?& array['n', 't']
                and ingredient - array['n', 't'] = '{}'::jsonb
                and jsonb_typeof(ingredient->'n') = 'string'
                and char_length(ingredient->>'n') between 1 and 80
                and ingredient->>'n' ~ '[^[:space:]]'
                and ingredient->'t' in ('0'::jsonb, '1'::jsonb, '2'::jsonb)
            else false end, false)
        )
    else false end;
$$;

revoke all on function shopping_private.valid_ingredients(jsonb) from public;
grant execute on function shopping_private.valid_ingredients(jsonb) to authenticated, service_role;

create table public.shopping_meals (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    name text not null check (char_length(name) between 1 and 80 and name ~ '[^[:space:]]'),
    category text not null check (category in (
        'Desayuno', 'Comida', 'Cena', 'Bebidas', 'Lácteos', 'Complementos', 'Despensa', 'Limpieza'
    )),
    ingredients jsonb not null check (shopping_private.valid_ingredients(ingredients))
);

create index shopping_meals_user_id_id_idx on public.shopping_meals (user_id, id);

alter table public.shopping_meals enable row level security;
revoke all on public.shopping_meals from public, anon, authenticated;
grant select, delete on public.shopping_meals to authenticated;
grant insert (name, category, ingredients), update (name, category, ingredients)
    on public.shopping_meals to authenticated;

create policy own_shopping_meals on public.shopping_meals
    for all to authenticated
    using ((select auth.uid()) = user_id and coalesce((select auth.jwt())->>'is_anonymous', 'false') = 'false')
    with check ((select auth.uid()) = user_id and coalesce((select auth.jwt())->>'is_anonymous', 'false') = 'false');

commit;
