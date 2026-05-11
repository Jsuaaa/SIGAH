/**
 * tests/unit/views.test.ts
 * Tests unitarios para los serializers de vistas (sin BD).
 * Verifica que campos sensibles sean excluidos de las respuestas API.
 * Cubre: HU-03 CA5 (no exponer password_hash), RGPD/privacidad de datos.
 */

import { userView, briefUserView } from '../../src/views/user.view';
import { familyView, familiesView } from '../../src/views/family.view';
import { donationView, donationsView } from '../../src/views/donation.view';
import type { User } from '../../src/types/entities';
import type { Family } from '../../src/types/entities';
import type { Donation } from '../../src/types/entities';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: 'test@sigah.gov.co',
    password_hash: '$2b$10$SECRET_HASH_DO_NOT_EXPOSE',
    role: 'ADMIN',
    name: 'Test User',
    is_active: true,
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: null,
    password_must_change: false,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeFamily(overrides: Partial<Family> = {}): Family {
  return {
    id: 1,
    family_code: 'FAM-2026-00001',
    head_document: '12345678',
    zone_id: 1,
    shelter_id: null,
    num_members: 4,
    num_children_under_5: 1,
    num_adults_over_65: 0,
    num_pregnant: 0,
    num_disabled: 0,
    priority_score: 25.5,
    priority_score_breakdown: {},
    status: 'ACTIVO',
    latitude: null,
    longitude: null,
    reference_address: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeDonation(overrides: Partial<Donation> = {}): Donation {
  return {
    id: 1,
    donation_code: 'DON-2026-00001',
    donor_id: 1,
    destination_warehouse_id: null,
    donation_type: 'IN_KIND',
    monetary_amount: null,
    date: new Date('2026-01-15'),
    notes: null,
    created_by: 1,
    created_at: new Date('2026-01-15'),
    updated_at: new Date('2026-01-15'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// userView — excluye password_hash (HU-03 CA5)
// ---------------------------------------------------------------------------

describe('userView', () => {
  it('excluye password_hash de la respuesta', () => {
    const user = makeUser();
    const result = userView(user);
    expect(result).not.toHaveProperty('password_hash');
  });

  it('conserva todos los campos no sensibles', () => {
    const user = makeUser();
    const result = userView(user);
    expect(result.id).toBe(1);
    expect(result.email).toBe('test@sigah.gov.co');
    expect(result.role).toBe('ADMIN');
    expect(result.name).toBe('Test User');
    expect(result.is_active).toBe(true);
    expect(result.failed_login_attempts).toBe(0);
    expect(result.locked_until).toBeNull();
    expect(result.password_must_change).toBe(false);
  });

  it('conserva la fecha created_at', () => {
    const user = makeUser();
    const result = userView(user);
    expect(result.created_at).toEqual(new Date('2026-01-01'));
  });
});

// ---------------------------------------------------------------------------
// briefUserView — subconjunto minimal para respuestas auth
// ---------------------------------------------------------------------------

describe('briefUserView', () => {
  it('excluye password_hash de la respuesta brief', () => {
    const user = makeUser();
    const result = briefUserView(user);
    expect(result).not.toHaveProperty('password_hash');
  });

  it('excluye failed_login_attempts del brief', () => {
    const user = makeUser({ failed_login_attempts: 3 });
    const result = briefUserView(user);
    expect(result).not.toHaveProperty('failed_login_attempts');
  });

  it('excluye locked_until del brief', () => {
    const user = makeUser({ locked_until: new Date() });
    const result = briefUserView(user);
    expect(result).not.toHaveProperty('locked_until');
  });

  it('incluye id, email, role, name, is_active, password_must_change', () => {
    const user = makeUser({ password_must_change: true });
    const result = briefUserView(user);
    expect(result.id).toBe(1);
    expect(result.email).toBe('test@sigah.gov.co');
    expect(result.role).toBe('ADMIN');
    expect(result.name).toBe('Test User');
    expect(result.is_active).toBe(true);
    expect(result.password_must_change).toBe(true);
  });

  it('NO incluye updated_at por defecto (withUpdatedAt=false)', () => {
    const user = makeUser();
    const result = briefUserView(user);
    expect(result).not.toHaveProperty('updated_at');
  });

  it('incluye updated_at cuando withUpdatedAt=true', () => {
    const user = makeUser();
    const result = briefUserView(user, true);
    expect(result.updated_at).toEqual(new Date('2026-01-01'));
  });
});

// ---------------------------------------------------------------------------
// familyView — passthrough (sin campos sensibles en families)
// ---------------------------------------------------------------------------

describe('familyView', () => {
  it('retorna la familia sin modificaciones', () => {
    const family = makeFamily();
    const result = familyView(family);
    expect(result).toEqual(family);
  });

  it('familiesView mapea un array correctamente', () => {
    const families = [makeFamily({ id: 1 }), makeFamily({ id: 2 })];
    const result = familiesView(families);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });

  it('familiesView retorna array vacío para input vacío', () => {
    expect(familiesView([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// donationView — passthrough
// ---------------------------------------------------------------------------

describe('donationView', () => {
  it('retorna la donación sin modificaciones', () => {
    const donation = makeDonation();
    const result = donationView(donation);
    expect(result).toEqual(donation);
  });

  it('donationsView mapea un array de donaciones', () => {
    const donations = [makeDonation({ id: 1 }), makeDonation({ id: 2 })];
    const result = donationsView(donations);
    expect(result).toHaveLength(2);
    expect(result[0].donation_code).toBe('DON-2026-00001');
  });
});
