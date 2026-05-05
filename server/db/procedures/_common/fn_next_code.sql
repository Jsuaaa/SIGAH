-- Generate the next sequential code of the form `<PREFIX>-<YEAR>-NNNNN`
-- (RN-07). NNNNN is zero-padded to five digits and resets every year.
--
-- Usage:
--   SELECT fn_next_code('FAM');  -- e.g. FAM-2026-00001
--
-- Concurrency: the underlying counter row is locked with SELECT … FOR UPDATE
-- so concurrent transactions never observe the same value. The caller must
-- already be inside a transaction (every SP that mutates business data is).

CREATE OR REPLACE FUNCTION fn_next_code(p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
    v_year  INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
    v_next  INTEGER;
BEGIN
    -- Insert the (prefix, year) row if it doesn't exist yet, then lock it.
    INSERT INTO code_counters (prefix, year, last_value)
    VALUES (p_prefix, v_year, 0)
    ON CONFLICT (prefix, year) DO NOTHING;

    UPDATE code_counters
       SET last_value = last_value + 1
     WHERE prefix = p_prefix
       AND year   = v_year
    RETURNING last_value INTO v_next;

    RETURN p_prefix || '-' || v_year::TEXT || '-' || LPAD(v_next::TEXT, 5, '0');
END $$;
