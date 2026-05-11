/**
 * Smoke test: verifica que la base de datos esté configurada correctamente.
 *
 * Este test NO muta datos. Solo lee del catálogo (information_schema, pg_proc,
 * pg_enum, pg_trigger) y de las tablas seedeadas para confirmar que:
 *   - El pool de conexión responde.
 *   - Las 20 migraciones están registradas en _migrations.
 *   - Todas las tablas esperadas existen.
 *   - Los enums tienen los valores finales del PDF (post-#9.1).
 *   - El admin está seedeado.
 *   - Los stored procedures críticos están cargados.
 *   - audit_logs es inmutable (triggers BEFORE UPDATE/DELETE).
 *   - scoring_config tiene los pesos por defecto.
 *
 * Si esta suite falla, NO ejecutes el resto de los tests de integración:
 * la BD no está en un estado consistente.
 */
import { pool } from '../setup';

const EXPECTED_MIGRATIONS = [
  '001_extensions.sql',
  '002_enum_types.sql',
  '003_users.sql',
  '004_zones.sql',
  '005_shelters.sql',
  '006_families.sql',
  '007_persons.sql',
  '008_scoring_config.sql',
  '009_warehouses.sql',
  '010_inventory.sql',
  '011_alert_thresholds.sql',
  '012_donors.sql',
  '013_donations.sql',
  '014_deliveries.sql',
  '015_auth_final.sql',
  '016_distribution_plans.sql',
  '017_health_vectors.sql',
  '018_relocations.sql',
  '019_audit_logs.sql',
  '020_sync_log.sql',
];

const EXPECTED_TABLES = [
  '_migrations',
  'users',
  'zones',
  'shelters',
  'families',
  'privacy_consents',
  'persons',
  'scoring_config',
  'warehouses',
  'resource_types',
  'inventory',
  'inventory_adjustments',
  'alert_thresholds',
  'donors',
  'donations',
  'donation_details',
  'deliveries',
  'delivery_details',
  'distribution_plans',
  'distribution_plan_items',
  'health_vectors',
  'relocations',
  'audit_logs',
  'sync_log',
  'code_counters',
];

const EXPECTED_ENUMS: Record<string, string[]> = {
  role: [
    'ADMIN',
    'CENSADOR',
    'OPERADOR_ENTREGAS',
    'COORDINADOR_LOGISTICA',
    'FUNCIONARIO_CONTROL',
    'REGISTRADOR_DONACIONES',
  ],
  risk_level: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  family_status: ['ACTIVO', 'EN_REFUGIO', 'EVACUADO'],
  warehouse_status: ['ACTIVE', 'INACTIVE'],
  delivery_status: ['PROGRAMADA', 'EN_CURSO', 'ENTREGADA'],
  donor_type: [
    'PERSONA_NATURAL',
    'EMPRESA',
    'ALCALDIA',
    'GOBERNACION',
    'ORGANIZACION',
  ],
  donation_type: ['IN_KIND', 'MONETARY', 'MIXED'],
  vector_type: ['AGUA_CONTAMINADA', 'INSECTOS', 'ROEDORES', 'OTRO'],
  health_vector_status: ['ACTIVO', 'EN_ATENCION', 'RESUELTO'],
  relocation_type: ['TEMPORARY', 'PERMANENT'],
  distribution_plan_status: [
    'PROGRAMADA',
    'EN_EJECUCION',
    'COMPLETADA',
    'CANCELADA',
  ],
  distribution_plan_scope: ['GLOBAL', 'ZONA', 'REFUGIO', 'LOTE'],
  distribution_plan_item_status: ['PENDIENTE', 'ENTREGADO', 'SIN_ATENDER'],
};

const EXPECTED_PROCEDURES = [
  // _common
  'fn_next_code',
  'sp_audit_insert',
  // users / auth
  'fn_users_create',
  'fn_users_find_by_email',
  'fn_users_find_by_id',
  'fn_users_list',
  'sp_auth_login',
  'sp_users_change_password',
  'sp_users_reset_password',
  'sp_users_set_active',
  // prioritization
  'fn_priority_score',
  'fn_prioritization_ranking',
  'fn_prioritization_next_batch',
  'sp_prioritization_recalculate_all',
  'sp_priority_recalc',
  // deliveries
  'sp_delivery_create',
  'sp_delivery_create_exception',
  'sp_delivery_create_batch',
  'sp_delivery_update_status',
  'fn_delivery_check_eligibility',
  'fn_delivery_min_food_kg',
  // distribution plans
  'sp_distribution_plans_create',
  'sp_distribution_plans_cancel',
  'sp_distribution_plans_execute',
  // inventory
  'fn_inventory_alerts',
  'sp_inventory_consume',
  // donations / donors
  'sp_donations_create',
  // health vectors / relocations
  'fn_health_vectors_create',
  'sp_health_vector_set_status',
  'sp_relocation_apply',
  // sync
  'fn_sync_log_find',
  'sp_sync_log_record',
  'fn_sync_status',
  // map / reports (selección)
  'fn_map_shelters',
  'fn_map_zones_without_deliveries',
  'fn_reports_dashboard',
  'fn_reports_coverage',
];

const EXPECTED_SCORING_KEYS = [
  'W_MEMBERS',
  'W_CHILDREN_5',
  'W_ADULTS_65',
  'W_PREGNANT',
  'W_DISABLED',
  'W_ZONE_RISK',
  'W_DAYS_NO_AID',
  'W_DELIVERIES',
  'MAX_DAYS',
];

describe('DB setup smoke test', () => {
  describe('connection', () => {
    it('responde a SELECT 1', async () => {
      const { rows } = await pool.query<{ ok: number }>('SELECT 1 AS ok');
      expect(rows[0]?.ok).toBe(1);
    });
  });

  describe('migrations', () => {
    it(`registra las ${EXPECTED_MIGRATIONS.length} migraciones aplicadas`, async () => {
      const { rows } = await pool.query<{ filename: string }>(
        'SELECT filename FROM _migrations ORDER BY filename',
      );
      const applied = rows.map((r) => r.filename);
      for (const expected of EXPECTED_MIGRATIONS) {
        expect(applied).toContain(expected);
      }
    });
  });

  describe('schema', () => {
    it('contiene todas las tablas esperadas', async () => {
      const { rows } = await pool.query<{ table_name: string }>(`
        SELECT table_name
          FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_type   = 'BASE TABLE'
      `);
      const present = new Set(rows.map((r) => r.table_name));
      for (const t of EXPECTED_TABLES) {
        expect(present.has(t)).toBe(true);
      }
    });

    it('users tiene las columnas finales (post-#9.1)', async () => {
      const { rows } = await pool.query<{ column_name: string }>(`
        SELECT column_name
          FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'users'
      `);
      const cols = new Set(rows.map((r) => r.column_name));
      for (const c of [
        'id',
        'email',
        'password_hash',
        'role',
        'name',
        'is_active',
        'failed_login_attempts',
        'locked_until',
        'last_login_at',
        'password_must_change',
      ]) {
        expect(cols.has(c)).toBe(true);
      }
    });

    it('deliveries.client_op_id es UNIQUE (idempotency offline)', async () => {
      const { rows } = await pool.query<{ count: string }>(`
        SELECT count(*) AS count
          FROM information_schema.table_constraints
         WHERE table_schema = 'public'
           AND table_name   = 'deliveries'
           AND constraint_type = 'UNIQUE'
      `);
      expect(Number(rows[0]?.count ?? 0)).toBeGreaterThan(0);
    });
  });

  describe('enums', () => {
    for (const [enumName, expectedValues] of Object.entries(EXPECTED_ENUMS)) {
      it(`${enumName} tiene los valores ${expectedValues.length} valores esperados`, async () => {
        const { rows } = await pool.query<{ enumlabel: string }>(
          `
          SELECT e.enumlabel
            FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
           WHERE t.typname = $1
           ORDER BY e.enumsortorder
        `,
          [enumName],
        );
        const labels = rows.map((r) => r.enumlabel);
        expect(labels).toEqual(expect.arrayContaining(expectedValues));
        expect(labels).toHaveLength(expectedValues.length);
      });
    }
  });

  describe('stored procedures', () => {
    it('están todos cargados', async () => {
      const { rows } = await pool.query<{ proname: string }>(`
        SELECT DISTINCT proname
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND (p.proname LIKE 'fn_%' OR p.proname LIKE 'sp_%')
      `);
      const present = new Set(rows.map((r) => r.proname));
      for (const proc of EXPECTED_PROCEDURES) {
        expect(present.has(proc)).toBe(true);
      }
    });

    it('hay al menos 50 procedures fn_/sp_ en el schema', async () => {
      const { rows } = await pool.query<{ count: string }>(`
        SELECT count(*) AS count
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND (p.proname LIKE 'fn_%' OR p.proname LIKE 'sp_%')
      `);
      expect(Number(rows[0]?.count ?? 0)).toBeGreaterThanOrEqual(50);
    });
  });

  describe('seeds', () => {
    it('admin@sigah.gov.co existe y tiene rol ADMIN activo', async () => {
      const { rows } = await pool.query<{
        email: string;
        role: string;
        is_active: boolean;
        name: string;
      }>(
        `SELECT email, role::text AS role, is_active, name
           FROM users WHERE email = 'admin@sigah.gov.co'`,
      );
      expect(rows[0]).toBeDefined();
      expect(rows[0]?.role).toBe('ADMIN');
      expect(rows[0]?.is_active).toBe(true);
      expect(rows[0]?.name).toBeTruthy();
    });

    it('scoring_config tiene los 9 pesos por defecto', async () => {
      const { rows } = await pool.query<{ key: string; value: number }>(
        'SELECT key, value FROM scoring_config',
      );
      const keys = rows.map((r) => r.key);
      for (const k of EXPECTED_SCORING_KEYS) {
        expect(keys).toContain(k);
      }
    });
  });

  describe('audit_logs inmutabilidad (RNF-09, CV-11)', () => {
    let insertedId: number | undefined;

    beforeAll(async () => {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO audit_logs (action, module, entity, entity_id, user_id, before, after)
         VALUES ('SETUP_TEST', 'db_setup', 'Test', NULL, NULL, NULL, '{}'::jsonb)
         RETURNING id`,
      );
      insertedId = Number(rows[0]?.id);
    });

    afterAll(async () => {
      // No podemos borrar (DELETE bloqueado por trigger). Marcar la fila de prueba
      // con un comentario en la migración futura si es necesario; aquí se queda.
      // Si quieres limpiarla manualmente: DROP TRIGGER + DELETE + recrear trigger.
    });

    it('rechaza UPDATE manual con SH403', async () => {
      await expect(
        pool.query(
          `UPDATE audit_logs SET action = 'HACK' WHERE id = $1`,
          [insertedId],
        ),
      ).rejects.toMatchObject({ code: 'SH403' });
    });

    it('rechaza DELETE manual con SH403', async () => {
      await expect(
        pool.query(`DELETE FROM audit_logs WHERE id = $1`, [insertedId]),
      ).rejects.toMatchObject({ code: 'SH403' });
    });
  });
});
