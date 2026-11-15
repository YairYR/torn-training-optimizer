-- Supporter Pro de torntraining.com. Aplicar una vez en el proyecto Supabase
-- dedicado (SQL Editor). Solo la secret key de api/pro.ts lee y escribe: RLS
-- activado y sin políticas = la publishable key no ve nada.

create table donations (
  event_id  text primary key,           -- id del evento de Torn: deduplica reintentos
  player_id bigint not null,
  qty       int not null check (qty > 0),
  ts        bigint not null,            -- segundos epoch, como la API de Torn
  faction_id bigint                     -- solo en envíos de 30+ Xanax: pase de facción
);
create index donations_player on donations (player_id);
create index donations_faction on donations (faction_id);

create table sync_state (
  id        int primary key default 1 check (id = 1),
  -- Arranca en "ahora": los Xanax recibidos antes del lanzamiento no se acreditan.
  last_ts   bigint not null default extract(epoch from now())::bigint,
  synced_at timestamptz not null default 'epoch'
);
insert into sync_state default values;

alter table donations enable row level security;
alter table sync_state enable row level security;
