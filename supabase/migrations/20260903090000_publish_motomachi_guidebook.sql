-- Make the first guidebook reachable from the Daigo exploration page. The
-- application also provides a temporary empty-state fallback while its first
-- recommendations are being curated.
update public.stays
set is_published = true,
    updated_at = now()
where slug = 'motomachi';
