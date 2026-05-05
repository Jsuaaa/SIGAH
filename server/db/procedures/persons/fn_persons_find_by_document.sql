-- Find a person by exact document. Returns the person row plus a `family`
-- JSONB blob with the parent family's columns so the API can render both in
-- one round-trip (HU-05 CA4 — search by document returns person + family).
-- Returns no rows when the document is not registered.

CREATE OR REPLACE FUNCTION fn_persons_find_by_document(p_document TEXT)
RETURNS TABLE (
    person JSONB,
    family JSONB
)
LANGUAGE sql STABLE AS $$
    SELECT to_jsonb(p) AS person,
           to_jsonb(f) AS family
      FROM persons p
      JOIN families f ON f.id = p.family_id
     WHERE p.document = p_document
     LIMIT 1;
$$;
