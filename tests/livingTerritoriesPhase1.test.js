import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isValidPolygonCoords } from '../src/territory-engine/geometryEngine.js';
import { 
  calculateSectorHealth, 
  getDecayStatus, 
  rechargeSector, 
  DECAY_DURATION_HOURS 
} from '../src/territory-engine/decayEngine.js';

describe('Phase 1: Living Territories Data Integration & Geometry Defense', () => {

  // =========================================================================
  // 1. Polygon Coordinates Defense Tests
  // =========================================================================
  describe('isValidPolygonCoords - Geometry Layer Protection', () => {
    test('1. Rejects null, undefined, and non-array inputs', () => {
      assert.equal(isValidPolygonCoords(null), false);
      assert.equal(isValidPolygonCoords(undefined), false);
      assert.equal(isValidPolygonCoords('not an array'), false);
      assert.equal(isValidPolygonCoords(12345), false);
      assert.equal(isValidPolygonCoords({ lat: 24.5, lng: 73.7 }), false);
    });

    test('2. Rejects empty array or arrays with fewer than 3 points', () => {
      assert.equal(isValidPolygonCoords([]), false);
      assert.equal(isValidPolygonCoords([[24.5, 73.7]]), false);
      assert.equal(isValidPolygonCoords([[24.5, 73.7], [24.6, 73.8]]), false);
    });

    test('3. Rejects arrays containing corrupt or non-numeric points', () => {
      assert.equal(isValidPolygonCoords([[24.5, 73.7], null, [24.6, 73.8]]), false);
      assert.equal(isValidPolygonCoords([[24.5, 73.7], [NaN, 73.8], [24.7, 73.9]]), false);
      assert.equal(isValidPolygonCoords([[24.5, 73.7], ['24.6', '73.8'], [24.7, 73.9]]), false);
      assert.equal(isValidPolygonCoords([[24.5, 73.7], [Infinity, 73.8], [24.7, 73.9]]), false);
    });

    test('4. Accepts valid flat polygon coordinates (>= 3 usable points)', () => {
      const triangle = [
        [24.571, 73.681],
        [24.582, 73.692],
        [24.593, 73.674]
      ];
      assert.equal(isValidPolygonCoords(triangle), true);

      const closedQuad = [
        [24.571, 73.681],
        [24.582, 73.692],
        [24.593, 73.674],
        [24.571, 73.681]
      ];
      assert.equal(isValidPolygonCoords(closedQuad), true);
    });

    test('5. Supports nested MultiPolygon / ring structures', () => {
      const nestedValid = [
        [
          [24.571, 73.681],
          [24.582, 73.692],
          [24.593, 73.674],
          [24.571, 73.681]
        ]
      ];
      assert.equal(isValidPolygonCoords(nestedValid), true);

      const nestedTooShort = [
        [
          [24.571, 73.681],
          [24.582, 73.692]
        ]
      ];
      assert.equal(isValidPolygonCoords(nestedTooShort), false);
    });
  });

  // =========================================================================
  // 2. Timestamp Extraction & Fallback Simulation (loadTerritories logic)
  // =========================================================================
  describe('loadTerritories Timestamp Mapping Logic', () => {
    // Pure reproduction of loadTerritories mapping function
    function mapTerritoryRow(t) {
      const lastRechargedAt = t.last_recharged_at || t.claimed_at || t.created_at || null;
      const createdAt = t.created_at || t.claimed_at || null;
      const expiresAt = t.expires_at || null;
      const decayHoursSetting = t.decay_hours !== undefined && t.decay_hours !== null ? t.decay_hours : (t.max_decay_hours || 72);

      const now = new Date();
      let remainingDecayHours = decayHoursSetting;
      if (expiresAt && !isNaN(new Date(expiresAt).getTime())) {
        const expiresDate = new Date(expiresAt);
        const diffMs = expiresDate.getTime() - now.getTime();
        remainingDecayHours = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
      } else if (lastRechargedAt && !isNaN(new Date(lastRechargedAt).getTime())) {
        const rechargeDate = new Date(lastRechargedAt);
        const totalSpanMs = (decayHoursSetting || 72) * 3600000;
        const diffMs = (rechargeDate.getTime() + totalSpanMs) - now.getTime();
        remainingDecayHours = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
      }

      return {
        id: t.id,
        name: t.name,
        ownerId: t.owner_id,
        owner_id: t.owner_id,
        ownerName: t.owner_name || 'Unclaimed',
        clan: t.clan_name,
        clan_name: t.clan_name,
        area: t.area_sqm ? `${t.area_sqm} m²` : (t.area || '0 m²'),
        area_sqm: t.area_sqm || 0,
        decay_hours: decayHoursSetting,
        decayHours: remainingDecayHours,
        maxDecayHours: t.max_decay_hours || 72,
        max_decay_hours: t.max_decay_hours || 72,
        last_recharged_at: lastRechargedAt,
        lastRechargedAt: lastRechargedAt,
        created_at: createdAt,
        createdAt: createdAt,
        expires_at: expiresAt,
        expiresAt: expiresAt,
        coords: t.coords
      };
    }

    test('6. Preserves explicit last_recharged_at, created_at, and expires_at', () => {
      const row = {
        id: 't-101',
        name: 'Sector 281',
        owner_id: 'usr-1',
        clan_name: 'Alpha Crew',
        area_sqm: 1250,
        created_at: '2026-10-10T10:00:00Z',
        last_recharged_at: '2026-10-11T12:00:00Z',
        expires_at: '2026-10-14T12:00:00Z',
        decay_hours: 72,
        coords: [[24.5, 73.6], [24.6, 73.7], [24.5, 73.7]]
      };

      const mapped = mapTerritoryRow(row);
      assert.equal(mapped.last_recharged_at, '2026-10-11T12:00:00Z');
      assert.equal(mapped.lastRechargedAt, '2026-10-11T12:00:00Z');
      assert.equal(mapped.created_at, '2026-10-10T10:00:00Z');
      assert.equal(mapped.createdAt, '2026-10-10T10:00:00Z');
      assert.equal(mapped.expires_at, '2026-10-14T12:00:00Z');
      assert.equal(mapped.expiresAt, '2026-10-14T12:00:00Z');
      assert.equal(mapped.decay_hours, 72);

      // Verify decay status calculates healthy with authentic timestamps
      const testNowMs = new Date('2026-10-11T14:00:00Z').getTime(); // 2 hours after recharge
      const decayStatus = getDecayStatus(mapped, testNowMs);
      assert.equal(decayStatus.status, 'healthy');
      assert.equal(decayStatus.decayed, false);
      assert.ok(decayStatus.health > 95, `Health was ${decayStatus.health}`);
    });

    test('7. Historical fallback: uses claimed_at if last_recharged_at is missing', () => {
      const row = {
        id: 't-102',
        name: 'Sector 617',
        owner_id: 'usr-2',
        claimed_at: '2026-10-11T08:00:00Z',
        created_at: '2026-10-11T08:00:00Z',
        last_recharged_at: null,
        expires_at: '2026-10-14T08:00:00Z',
        decay_hours: 72
      };

      const mapped = mapTerritoryRow(row);
      assert.equal(mapped.last_recharged_at, '2026-10-11T08:00:00Z');
      assert.equal(mapped.lastRechargedAt, '2026-10-11T08:00:00Z');
      assert.equal(mapped.created_at, '2026-10-11T08:00:00Z');

      const testNowMs = new Date('2026-10-11T10:00:00Z').getTime();
      const health = calculateSectorHealth(mapped, testNowMs);
      assert.ok(health > 90, `Health was ${health}`);
    });

    test('8. Historical fallback: uses created_at if last_recharged_at and claimed_at are missing', () => {
      const row = {
        id: 't-103',
        name: 'Sector 940',
        created_at: '2026-10-12T00:00:00Z',
        last_recharged_at: null,
        claimed_at: null
      };

      const mapped = mapTerritoryRow(row);
      assert.equal(mapped.last_recharged_at, '2026-10-12T00:00:00Z');
      assert.equal(mapped.created_at, '2026-10-12T00:00:00Z');

      const testNowMs = new Date('2026-10-12T12:00:00Z').getTime(); // 12h elapsed
      const status = getDecayStatus(mapped, testNowMs);
      assert.equal(status.status, 'healthy');
      assert.equal(status.decayed, false);
      assert.equal(status.hoursRemaining, 60);
    });

    test('9. Missing all timestamps: does NOT invent fake timestamps, yields null', () => {
      const row = {
        id: 't-104',
        name: 'Legacy Unknown Sector',
        last_recharged_at: null,
        claimed_at: null,
        created_at: null,
        expires_at: null
      };

      const mapped = mapTerritoryRow(row);
      assert.equal(mapped.last_recharged_at, null);
      assert.equal(mapped.created_at, null);
      assert.equal(mapped.expires_at, null);

      // Verify that decayEngine correctly reports expired status for null timestamp
      const status = getDecayStatus(mapped, Date.now());
      assert.equal(status.status, 'expired');
      assert.equal(status.health, 0);
      assert.equal(status.hoursRemaining, 0);
    });
  });

  // =========================================================================
  // 3. updateTerritory Payload Mapping Simulation Tests
  // =========================================================================
  describe('updateTerritory Payload Mapping Logic', () => {
    // Pure reproduction of updateTerritory payload mapping
    function buildUpdatePayload(updates = {}) {
      const mapped = {};
      const ownerIdVal = updates.owner_id !== undefined ? updates.owner_id : updates.ownerId;
      if (ownerIdVal !== undefined) mapped.owner_id = ownerIdVal;

      const ownerNameVal = updates.owner_name !== undefined ? updates.owner_name : updates.ownerName;
      if (ownerNameVal !== undefined) mapped.owner_name = ownerNameVal;

      const clanVal = updates.clan_name !== undefined ? updates.clan_name : (updates.clan !== undefined ? updates.clan : undefined);
      if (clanVal !== undefined) mapped.clan_name = clanVal;

      if (updates.name !== undefined) mapped.name = updates.name;
      if (updates.color !== undefined) mapped.color = updates.color;
      if (updates.is_active !== undefined) mapped.is_active = updates.is_active;
      if (updates.status !== undefined) mapped.status = updates.status;

      // Handle decay_hours / decayHours (0 is valid number)
      const decayHoursVal = updates.decay_hours !== undefined ? updates.decay_hours : updates.decayHours;
      if (decayHoursVal !== undefined && decayHoursVal !== null) {
        const num = Number(decayHoursVal);
        if (!Number.isNaN(num)) {
          mapped.decay_hours = num;
        }
      }

      // Handle expires_at / expiresAt
      const expiresAtVal = updates.expires_at !== undefined ? updates.expires_at : updates.expiresAt;
      if (expiresAtVal !== undefined && expiresAtVal !== null) {
        mapped.expires_at = typeof expiresAtVal === 'number'
          ? new Date(expiresAtVal).toISOString()
          : (expiresAtVal instanceof Date ? expiresAtVal.toISOString() : expiresAtVal);
      } else if (decayHoursVal !== undefined && decayHoursVal !== null && mapped.expires_at === undefined) {
        const num = Number(decayHoursVal);
        if (!Number.isNaN(num)) {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + num);
          mapped.expires_at = expiresAt.toISOString();
        }
      }

      // Handle last_recharged_at / lastRechargedAt
      const lastRechargedAtVal = updates.last_recharged_at !== undefined ? updates.last_recharged_at : updates.lastRechargedAt;
      if (lastRechargedAtVal !== undefined && lastRechargedAtVal !== null) {
        mapped.last_recharged_at = typeof lastRechargedAtVal === 'number'
          ? new Date(lastRechargedAtVal).toISOString()
          : (lastRechargedAtVal instanceof Date ? lastRechargedAtVal.toISOString() : lastRechargedAtVal);
      }

      return mapped;
    }

    test('10. Builds payload with snake_case fields (as used in useShield)', () => {
      const input = {
        last_recharged_at: '2026-10-13T12:00:00.000Z',
        expires_at: '2026-10-16T12:00:00.000Z',
        decay_hours: 72
      };

      const payload = buildUpdatePayload(input);
      assert.equal(payload.last_recharged_at, '2026-10-13T12:00:00.000Z');
      assert.equal(payload.expires_at, '2026-10-16T12:00:00.000Z');
      assert.equal(payload.decay_hours, 72);
    });

    test('11. Builds payload with camelCase fields for backward compatibility', () => {
      const input = {
        lastRechargedAt: '2026-10-13T15:30:00.000Z',
        expiresAt: '2026-10-16T15:30:00.000Z',
        decayHours: 48
      };

      const payload = buildUpdatePayload(input);
      assert.equal(payload.last_recharged_at, '2026-10-13T15:30:00.000Z');
      assert.equal(payload.expires_at, '2026-10-16T15:30:00.000Z');
      assert.equal(payload.decay_hours, 48);
    });

    test('12. Preserves numeric 0 without treating it as missing', () => {
      const input = {
        decay_hours: 0,
        expires_at: '2026-10-13T00:00:00.000Z'
      };

      const payload = buildUpdatePayload(input);
      assert.strictEqual(payload.decay_hours, 0);
      assert.equal(payload.expires_at, '2026-10-13T00:00:00.000Z');
    });

    test('13. Explicit expires_at is not overwritten by decayHours calculation', () => {
      const explicitExpires = '2026-10-20T00:00:00.000Z';
      const input = {
        expires_at: explicitExpires,
        decayHours: 72
      };

      const payload = buildUpdatePayload(input);
      assert.equal(payload.expires_at, explicitExpires);
      assert.equal(payload.decay_hours, 72);
    });

    test('14. Supports Date objects and numeric epoch ms timestamps', () => {
      const dateObj = new Date('2026-10-13T18:00:00.000Z');
      const epochMs = dateObj.getTime();

      const payload = buildUpdatePayload({
        last_recharged_at: dateObj,
        expires_at: epochMs
      });

      assert.equal(payload.last_recharged_at, '2026-10-13T18:00:00.000Z');
      assert.equal(payload.expires_at, '2026-10-13T18:00:00.000Z');
    });
  });
});
