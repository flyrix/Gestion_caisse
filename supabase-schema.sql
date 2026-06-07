-- Supabase: Création de la table operations pour Gestion de Caisse

create table public.operations (
  id bigint primary key,
  user_id uuid not null references auth.users(id),
  client text not null,
  montant integer not null,
  type text not null check (type in ('credit', 'monnaie')),
  paye boolean not null default false,
  createdAt timestamp with time zone not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text not null
);

-- Activer Row Level Security (RLS) pour sécuriser les données par utilisateur
alter table public.operations enable row level security;
alter table public.profiles enable row level security;

create policy "Users can manage their own operations"
  on public.operations
  for select, insert, update, delete
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Public select profiles for username lookup"
  on public.profiles
  for select
  using (true);

create policy "Users can manage their own profile"
  on public.profiles
  for insert, update, delete
  using (auth.uid() = id)
  with check (auth.uid() = id);
