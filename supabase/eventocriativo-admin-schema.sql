create extension if not exists pgcrypto;

create table if not exists public.eventocriativo_tasks (
    id uuid primary key default gen_random_uuid(),
    created_by uuid references auth.users(id) on delete cascade,
    title text not null,
    description text default '',
    status text not null default 'a_fazer',
    priority text not null default 'media',
    due_at timestamptz,
    completed_at timestamptz,
    origin text not null default 'manual',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.eventocriativo_calendar_events (
    id uuid primary key default gen_random_uuid(),
    created_by uuid references auth.users(id) on delete cascade,
    title text not null,
    description text default '',
    starts_at timestamptz not null,
    ends_at timestamptz,
    event_type text not null default 'operacao',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.eventocriativo_editorial_items (
    id uuid primary key default gen_random_uuid(),
    created_by uuid references auth.users(id) on delete cascade,
    title text not null,
    channel text not null default 'Instagram',
    status text not null default 'ideia',
    publish_at timestamptz,
    summary text default '',
    notes text default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.eventocriativo_docs (
    id uuid primary key default gen_random_uuid(),
    created_by uuid references auth.users(id) on delete cascade,
    title text not null,
    category text not null default 'ICP',
    tags text default '',
    content text default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.eventocriativo_strategies (
    id uuid primary key default gen_random_uuid(),
    created_by uuid references auth.users(id) on delete cascade,
    title text not null,
    category text not null default 'Marketing',
    description text default '',
    notes text default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.eventocriativo_ai_chats (
    id uuid primary key default gen_random_uuid(),
    created_by uuid references auth.users(id) on delete cascade,
    title text not null default 'Novo chat',
    model_id text default 'deepseek-flash',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.eventocriativo_ai_messages (
    id uuid primary key default gen_random_uuid(),
    chat_id uuid not null references public.eventocriativo_ai_chats(id) on delete cascade,
    role text not null,
    content text not null,
    model_id text,
    input_tokens integer not null default 0,
    output_tokens integer not null default 0,
    estimated_cost numeric(10, 6) not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.eventocriativo_ai_suggested_actions (
    id uuid primary key default gen_random_uuid(),
    chat_id uuid references public.eventocriativo_ai_chats(id) on delete cascade,
    message_id uuid references public.eventocriativo_ai_messages(id) on delete cascade,
    action_type text not null,
    title text not null,
    payload jsonb not null default '{}'::jsonb,
    status text not null default 'pending',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.eventocriativo_daily_phrases (
    id uuid primary key default gen_random_uuid(),
    phrase text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.eventocriativo_tasks enable row level security;
alter table public.eventocriativo_calendar_events enable row level security;
alter table public.eventocriativo_editorial_items enable row level security;
alter table public.eventocriativo_docs enable row level security;
alter table public.eventocriativo_strategies enable row level security;
alter table public.eventocriativo_ai_chats enable row level security;
alter table public.eventocriativo_ai_messages enable row level security;
alter table public.eventocriativo_ai_suggested_actions enable row level security;
alter table public.eventocriativo_daily_phrases enable row level security;

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'eventocriativo_tasks',
        'eventocriativo_calendar_events',
        'eventocriativo_editorial_items',
        'eventocriativo_docs',
        'eventocriativo_strategies',
        'eventocriativo_ai_chats'
    ] loop
        execute format('drop policy if exists "%s owner select" on public.%I', table_name, table_name);
        execute format('drop policy if exists "%s owner insert" on public.%I', table_name, table_name);
        execute format('drop policy if exists "%s owner update" on public.%I', table_name, table_name);
        execute format('drop policy if exists "%s owner delete" on public.%I', table_name, table_name);

        execute format('create policy "%s owner select" on public.%I for select using (auth.uid() = created_by)', table_name, table_name);
        execute format('create policy "%s owner insert" on public.%I for insert with check (auth.uid() = created_by)', table_name, table_name);
        execute format('create policy "%s owner update" on public.%I for update using (auth.uid() = created_by) with check (auth.uid() = created_by)', table_name, table_name);
        execute format('create policy "%s owner delete" on public.%I for delete using (auth.uid() = created_by)', table_name, table_name);
    end loop;
end $$;

drop policy if exists "Evento Criativo messages owner select" on public.eventocriativo_ai_messages;
drop policy if exists "Evento Criativo messages owner insert" on public.eventocriativo_ai_messages;
create policy "Evento Criativo messages owner select" on public.eventocriativo_ai_messages
    for select using (
        exists (
            select 1 from public.eventocriativo_ai_chats
            where eventocriativo_ai_chats.id = eventocriativo_ai_messages.chat_id
            and eventocriativo_ai_chats.created_by = auth.uid()
        )
    );
create policy "Evento Criativo messages owner insert" on public.eventocriativo_ai_messages
    for insert with check (
        exists (
            select 1 from public.eventocriativo_ai_chats
            where eventocriativo_ai_chats.id = eventocriativo_ai_messages.chat_id
            and eventocriativo_ai_chats.created_by = auth.uid()
        )
    );

drop policy if exists "Evento Criativo actions owner all" on public.eventocriativo_ai_suggested_actions;
create policy "Evento Criativo actions owner all" on public.eventocriativo_ai_suggested_actions
    for all using (
        exists (
            select 1 from public.eventocriativo_ai_chats
            where eventocriativo_ai_chats.id = eventocriativo_ai_suggested_actions.chat_id
            and eventocriativo_ai_chats.created_by = auth.uid()
        )
    ) with check (
        exists (
            select 1 from public.eventocriativo_ai_chats
            where eventocriativo_ai_chats.id = eventocriativo_ai_suggested_actions.chat_id
            and eventocriativo_ai_chats.created_by = auth.uid()
        )
    );

drop policy if exists "Evento Criativo phrases authenticated read" on public.eventocriativo_daily_phrases;
create policy "Evento Criativo phrases authenticated read" on public.eventocriativo_daily_phrases
    for select using (auth.role() = 'authenticated');

