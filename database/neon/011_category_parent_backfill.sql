-- Preserve imported IDs and metadata; restore only missing canonical parents.
begin;
update public.categories child set parent_id=parent.id
from public.categories parent
where child.parent_id is null
  and (child.id,parent.id) in (
    ('Gaming - Ação / Aventura','Gaming'),
    ('IRL - Vida Cotidiana','IRL'),
    ('Just Chatting - Bate-Papo','Just Chatting')
  );
commit;
