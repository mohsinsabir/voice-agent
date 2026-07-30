exports.up = (pgm) => {
  const name = process.env.DEFAULT_BUSINESS_NAME || "Bright Smile Dental";
  const timezone = process.env.DEFAULT_BUSINESS_TIMEZONE || "America/New_York";
  const safeName = name.replace(/'/g, "''");
  const safeTz = timezone.replace(/'/g, "''");

  // Works under FORCE RLS: set tenant GUC to the new id before insert.
  pgm.sql(`
    DO $$
    DECLARE
      bid uuid;
    BEGIN
      SELECT id INTO bid FROM businesses WHERE name = '${safeName}' LIMIT 1;
      IF bid IS NULL THEN
        bid := gen_random_uuid();
        PERFORM set_config('app.current_business_id', bid::text, true);
        INSERT INTO businesses (id, name, timezone, business_hours, active)
        VALUES (
          bid,
          '${safeName}',
          '${safeTz}',
          '{
            "mon": ["09:00","17:00"],
            "tue": ["09:00","17:00"],
            "wed": ["09:00","17:00"],
            "thu": ["09:00","17:00"],
            "fri": ["09:00","17:00"],
            "sat": ["09:00","13:00"],
            "sun": []
          }'::jsonb,
          true
        );
      END IF;
      RAISE NOTICE 'DEFAULT_BUSINESS_ID=%', bid;
    END
    $$;
  `);
};

exports.down = (pgm) => {
  const name = process.env.DEFAULT_BUSINESS_NAME || "Bright Smile Dental";
  const safeName = name.replace(/'/g, "''");
  pgm.sql(`
    DO $$
    DECLARE
      bid uuid;
    BEGIN
      SELECT id INTO bid FROM businesses WHERE name = '${safeName}' LIMIT 1;
      IF bid IS NOT NULL THEN
        PERFORM set_config('app.current_business_id', bid::text, true);
        DELETE FROM businesses WHERE id = bid;
      END IF;
    END
    $$;
  `);
};
