import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  calculateSectorHealth, 
  isDecayed, 
  getDecayStatus, 
  rechargeSector,
  DECAY_DURATION_HOURS,
  NEUTRAL_DURATION_HOURS,
  TOTAL_LIFESPAN_HOURS
} from '../src/territory-engine/decayEngine.js';

test('Decay Engine - calculateSectorHealth', async (t) => {
  const nowMs = new Date('2026-08-01T12:00:00Z').getTime();
  
  await t.test('1. Full health just after recharge', () => {
    const territory = { last_recharged_at: '2026-08-01T12:00:00Z' };
    const health = calculateSectorHealth(territory, nowMs);
    assert.equal(health, 100);
  });

  await t.test('2. 50% health after 36 hours', () => {
    // 36 hours ago
    const territory = { last_recharged_at: '2026-07-31T00:00:00Z' };
    const health = calculateSectorHealth(territory, nowMs);
    assert.equal(health, 50);
  });

  await t.test('3. 0% health after 72 hours', () => {
    // 72 hours ago
    const territory = { last_recharged_at: '2026-07-29T12:00:00Z' };
    const health = calculateSectorHealth(territory, nowMs);
    assert.equal(health, 0);
  });

  await t.test('4. 0% health if well past decay time', () => {
    // 100 hours ago
    const territory = { last_recharged_at: '2026-07-28T08:00:00Z' };
    const health = calculateSectorHealth(territory, nowMs);
    assert.equal(health, 0);
  });
  
  await t.test('5. Fallback to created_at if last_recharged_at missing', () => {
    const territory = { created_at: '2026-07-31T00:00:00Z' };
    const health = calculateSectorHealth(territory, nowMs);
    assert.equal(health, 50);
  });
});

test('Decay Engine - isDecayed', async (t) => {
  const nowMs = new Date('2026-08-01T12:00:00Z').getTime();
  
  await t.test('6. Not decayed at 71 hours', () => {
    // 71 hours ago
    const territory = { last_recharged_at: '2026-07-29T13:00:00Z' };
    assert.equal(isDecayed(territory, nowMs), false);
  });

  await t.test('7. Decayed at exactly 72 hours', () => {
    const territory = { last_recharged_at: '2026-07-29T12:00:00Z' };
    assert.equal(isDecayed(territory, nowMs), true);
  });
});

test('Decay Engine - getDecayStatus', async (t) => {
  const nowMs = new Date('2026-08-01T12:00:00Z').getTime();
  
  await t.test('8. Healthy status', () => {
    const territory = { last_recharged_at: '2026-08-01T00:00:00Z' }; // 12h elapsed -> 83% health
    const status = getDecayStatus(territory, nowMs);
    assert.equal(status.status, 'healthy');
    assert.equal(status.decayed, false);
    assert.equal(status.hoursRemaining, 60);
  });

  await t.test('9. Warning status (<25% health)', () => {
    // 60 hours elapsed (12 hours remaining) -> 12/72 = 16.6%
    const territory = { last_recharged_at: '2026-07-30T00:00:00Z' }; 
    const status = getDecayStatus(territory, nowMs);
    assert.equal(status.status, 'warning');
    assert.equal(status.hoursRemaining, 12);
  });

  await t.test('10. Critical status (<10% health)', () => {
    // 66 hours elapsed (6 hours remaining) -> 6/72 = 8.3%
    const territory = { last_recharged_at: '2026-07-29T18:00:00Z' }; 
    const status = getDecayStatus(territory, nowMs);
    assert.equal(status.status, 'critical');
    assert.equal(status.hoursRemaining, 6);
  });

  await t.test('11. Neutral status (72h to 96h)', () => {
    // 80 hours elapsed (decayed, 16h remaining in neutral)
    const territory = { last_recharged_at: '2026-07-29T04:00:00Z' }; 
    const status = getDecayStatus(territory, nowMs);
    assert.equal(status.status, 'neutral');
    assert.equal(status.decayed, true);
    assert.equal(status.health, 0);
    assert.equal(status.hoursRemaining, 16);
  });
  
  await t.test('12. Expired status (>96h)', () => {
    // 100 hours elapsed
    const territory = { last_recharged_at: '2026-07-28T08:00:00Z' }; 
    const status = getDecayStatus(territory, nowMs);
    assert.equal(status.status, 'expired');
    assert.equal(status.decayed, true);
    assert.equal(status.hoursRemaining, 0);
  });
});

test('Decay Engine - rechargeSector', async (t) => {
  await t.test('13. Recharge updates timestamps correctly', () => {
    const territory = { id: 't1', last_recharged_at: '2026-07-20T00:00:00Z' };
    const nowMs = new Date('2026-08-01T12:00:00Z').getTime();
    
    const recharged = rechargeSector(territory, nowMs);
    
    assert.equal(recharged.id, 't1');
    assert.equal(recharged.last_recharged_at, '2026-08-01T12:00:00.000Z');
    
    // Expires at should be now + 72 hours
    const expectedExpires = new Date(nowMs + 72 * 60 * 60 * 1000).toISOString();
    assert.equal(recharged.expires_at, expectedExpires);
  });
});
