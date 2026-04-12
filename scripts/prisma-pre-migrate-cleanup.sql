-- Safe before migrate deploy: legacy LowStockAlertState rows block NOT NULL supplierId if tooling used db push.
DO $$
BEGIN
  IF to_regclass('public."LowStockAlertState"') IS NOT NULL THEN
    EXECUTE 'DELETE FROM "LowStockAlertState"';
  END IF;
END $$;
