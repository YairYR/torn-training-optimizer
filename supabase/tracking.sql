-- Seguimiento diario opt-in (historial personal + dashboard de facción).
-- Aplicar una vez en el SQL Editor. Igual que pro.sql: RLS sin políticas,
-- solo la secret key de las funciones de /api lee y escribe.

create table members (
  player_id     bigint primary key,
  name          text,
  faction_id    bigint,
  key_enc       text,                   -- key de Torn cifrada (AES-GCM); null si Torn la invalidó
  share_faction boolean not null default false,
  created_at    timestamptz not null default now(),
  last_ok       timestamptz,
  last_error    text
);
create index members_faction on members (faction_id);

create table snapshots (
  player_id bigint not null references members (player_id) on delete cascade,
  day       date not null,
  strength  bigint not null,
  defense   bigint not null,
  speed     bigint not null,
  dexterity bigint not null,
  primary key (player_id, day)
);

alter table members enable row level security;
alter table snapshots enable row level security;
