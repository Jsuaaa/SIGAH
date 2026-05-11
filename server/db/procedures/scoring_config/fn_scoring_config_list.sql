-- Return every scoring_config row, ordered by key.

CREATE OR REPLACE FUNCTION fn_scoring_config_list()
RETURNS SETOF scoring_config
LANGUAGE sql STABLE AS $$
    SELECT * FROM scoring_config ORDER BY key ASC;
$$;
