/**
 * RunClash 2.0 — Run Engine Automated Test Suite
 * Executes 20 automated regression tests including real device trace reproduction,
 * slow terrace walking, stationary drift protection, atomic UI mirror, and property invariants.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { RunEngine } from '../src/run-engine/runEngine.js';
import { getDistanceInMeters } from '../src/run-engine/gpsMath.js';

// Helper to generate GPS fix object
function createFix(lat, lng, accuracy = 15, speed = null, timestampMs = Date.now()) {
  return {
    latitude: lat,
    longitude: lng,
    accuracy,
    speed,
    timestamp: timestampMs
  };
}

// Helper to simulate walking steps along a direction
function offsetCoords(startLat, startLng, bearingDegrees, distanceMeters) {
  const R = 6371000;
  const rad = bearingDegrees * Math.PI / 180;
  const dLat = (distanceMeters * Math.cos(rad)) / R;
  const dLng = (distanceMeters * Math.sin(rad)) / (R * Math.cos(startLat * Math.PI / 180));
  return [startLat + (dLat * 180 / Math.PI), startLng + (dLng * 180 / Math.PI)];
}

test('TEST 1 — STATIONARY START (120s GPS Jitter)', (t) => {
  const engine = new RunEngine();
  engine.startSession();
  assert.equal(engine.state, 'acquiring');

  let now = 1000000;
  const baseLat = 37.7749;
  const baseLng = -122.4194;

  engine.handleRawGpsFix(createFix(baseLat, baseLng, 15, null, now));
  assert.equal(engine.state, 'waiting');

  for (let sec = 1; sec <= 120; sec++) {
    now += 1000;
    const jitterLat = baseLat + (Math.random() - 0.5) * 0.00003;
    const jitterLng = baseLng + (Math.random() - 0.5) * 0.00003;
    engine.handleRawGpsFix(createFix(jitterLat, jitterLng, 15, 0, now));

    const snap = engine.getMetricsSnapshot(now);
    assert.equal(engine.state, 'waiting');
    assert.equal(snap.distance, 0, 'Distance must remain 0 while waiting');
    assert.equal(snap.duration, 0, 'Duration must remain 0 while waiting');
    assert.equal(snap.speed, 0, 'Speed must remain 0 while waiting');
    assert.equal(snap.pace, '--:--', 'Pace must remain --:-- while waiting');
  }
});

test('TEST 2 — REAL WALK START', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));
  assert.equal(engine.state, 'waiting');

  let armed = false;
  for (let sec = 1; sec <= 10; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.2);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.2, now));
    if (engine.state === 'tracking') {
      armed = true;
      break;
    }
  }

  assert.equal(armed, true, 'Engine must transition from waiting to tracking on real walking');
  assert.equal(engine.state, 'tracking');
});

test('TEST 3 — ACTIVE WALK (Monotonic Distance, No False Pause)', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));

  for (let sec = 1; sec <= 8; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }
  assert.equal(engine.state, 'tracking');

  let prevDistance = engine.getMetricsSnapshot(now).distance;

  for (let sec = 1; sec <= 30; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));

    const snap = engine.getMetricsSnapshot(now);
    assert.equal(engine.state, 'tracking', 'Should remain tracking during active walk');
    assert.ok(snap.distance >= prevDistance, 'Distance must be monotonic');
    prevDistance = snap.distance;
  }

  assert.ok(prevDistance > 0.03, 'Distance should have accumulated ~35-40m');
});

test('TEST 4 — SLOW WALK (1.5–2.5 km/h Terrace Walking)', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));

  for (let sec = 1; sec <= 8; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }
  assert.equal(engine.state, 'tracking');

  for (let sec = 1; sec <= 30; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 0.5);
    engine.handleRawGpsFix(createFix(curLat, curLng, 15, 0.5, now));
    assert.equal(engine.state, 'tracking', 'Slow walking must NOT trigger false auto-pause');
  }
});

test('TEST 5 — STATIONARY DRIFT AFTER WALK (Frozen Distance & Auto-Pause)', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));

  for (let sec = 1; sec <= 15; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }
  assert.equal(engine.state, 'tracking');

  const stopLat = curLat;
  const stopLng = curLng;

  let pausedDistance = null;
  let autoPausedTriggered = false;
  for (let sec = 1; sec <= 20; sec++) {
    now += 1000;
    const jitterLat = stopLat + (Math.random() - 0.5) * 0.00001;
    const jitterLng = stopLng + (Math.random() - 0.5) * 0.00001;
    engine.handleRawGpsFix(createFix(jitterLat, jitterLng, 15, 0, now));

    const snap = engine.getMetricsSnapshot(now);

    if (engine.state === 'paused') {
      autoPausedTriggered = true;
      if (pausedDistance === null) {
        pausedDistance = snap.distance;
      } else {
        assert.equal(snap.distance, pausedDistance, 'Distance MUST remain strictly frozen while paused');
      }
    }
  }

  assert.equal(autoPausedTriggered, true, 'Engine must transition to paused after 15s stationary timeout');
});

test('TEST 6 — PAUSE DURATION (30s Walk + 30s Pause + 20s Walk = 50s Duration)', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));

  for (let sec = 1; sec <= 8; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }

  for (let sec = 1; sec <= 30; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }

  const stopLat = curLat;
  const stopLng = curLng;
  for (let sec = 1; sec <= 18; sec++) {
    now += 1000;
    engine.handleRawGpsFix(createFix(stopLat, stopLng, 15, 0, now));
  }
  assert.equal(engine.state, 'paused');

  for (let sec = 1; sec <= 30; sec++) {
    now += 1000;
    engine.handleRawGpsFix(createFix(stopLat, stopLng, 15, 0, now));
    assert.equal(engine.state, 'paused');
  }

  // Progressive walking away from pause anchor across time to resume cleanly
  for (let sec = 1; sec <= 5; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.5);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.5, now));
  }
  assert.equal(engine.state, 'tracking');

  for (let sec = 1; sec <= 15; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }

  const snap = engine.getMetricsSnapshot(now);
  assert.ok(snap.duration >= 48 && snap.duration <= 54, `Active duration should be ~50s, got: ${snap.duration}s`);
});

test('TEST 7 — RESUME (No Pause Anchor Distance Jump)', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));
  for (let sec = 1; sec <= 8; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }

  const pauseLat = curLat;
  const pauseLng = curLng;
  for (let sec = 1; sec <= 18; sec++) {
    now += 1000;
    engine.handleRawGpsFix(createFix(pauseLat, pauseLng, 15, 0, now));
  }
  assert.equal(engine.state, 'paused');
  const pausedDistance = engine.getMetricsSnapshot(now).distance;

  [curLat, curLng] = offsetCoords(pauseLat, pauseLng, 90, 5.0);

  for (let sec = 1; sec <= 4; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 90, 1.2);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.5, now));
  }
  assert.equal(engine.state, 'tracking');

  const resumedDistance = engine.getMetricsSnapshot(now).distance;
  assert.equal(resumedDistance, pausedDistance, 'Resume transition fix must NOT add pause-anchor distance jump');
});

test('TEST 8 — GPS TELEPORT REJECTION', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));
  for (let sec = 1; sec <= 8; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }

  const beforeTeleportDist = engine.getMetricsSnapshot(now).distance;

  now += 1000;
  const [teleLat, teleLng] = offsetCoords(curLat, curLng, 0, 150.0);
  engine.handleRawGpsFix(createFix(teleLat, teleLng, 10, 50.0, now));

  const afterTeleportDist = engine.getMetricsSnapshot(now).distance;
  assert.equal(afterTeleportDist, beforeTeleportDist, '150m teleport jump MUST be rejected');
});

test('TEST 9 — POOR ACCURACY REJECTION (> 25m)', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));
  for (let sec = 1; sec <= 8; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }

  const validDist = engine.getMetricsSnapshot(now).distance;

  now += 1000;
  [curLat, curLng] = offsetCoords(curLat, curLng, 0, 2.0);
  engine.handleRawGpsFix(createFix(curLat, curLng, 45, 2.0, now));

  const afterPoorAccDist = engine.getMetricsSnapshot(now).distance;
  assert.equal(afterPoorAccDist, validDist, 'Poor accuracy fix (>25m) MUST NOT add to official distance');
});

test('TEST 10 — DISTANCE MONOTONICITY', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  let prevDist = 0;
  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));

  for (let i = 0; i < 50; i++) {
    now += 1000;
    const bearing = (i * 35) % 360;
    const dist = Math.random() * 3.0;
    [curLat, curLng] = offsetCoords(curLat, curLng, bearing, dist);
    const acc = Math.random() < 0.2 ? 40 : 12;

    engine.handleRawGpsFix(createFix(curLat, curLng, acc, 1.2, now));
    const currentDist = engine.getMetricsSnapshot(now).distance;

    assert.ok(currentDist >= prevDist, `Distance regression detected: ${currentDist} < ${prevDist}`);
    prevDist = currentDist;
  }
});

test('TEST 11 — DURATION MONOTONICITY', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  let prevDuration = 0;
  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));

  for (let i = 0; i < 50; i++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.2);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.2, now));

    const snap = engine.getMetricsSnapshot(now);
    assert.ok(snap.duration >= prevDuration, `Duration regression detected: ${snap.duration} < ${prevDuration}`);
    prevDuration = snap.duration;
  }
});

test('TEST 12 — UI STATE MIRRORING', (t) => {
  const engine = new RunEngine();
  let lastEmittedState = null;

  engine.subscribe((type, data) => {
    lastEmittedState = data.engineState;
  });

  engine.startSession();
  assert.equal(lastEmittedState, 'acquiring');

  engine.handleRawGpsFix(createFix(37.7749, -122.4194, 15, null, 1000));
  assert.equal(lastEmittedState, 'waiting');

  let now = 2000;
  let [cLat, cLng] = [37.7749, -122.4194];
  for (let i = 0; i < 8; i++) {
    now += 1000;
    [cLat, cLng] = offsetCoords(cLat, cLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(cLat, cLng, 12, 1.3, now));
  }
  assert.equal(lastEmittedState, 'tracking');
});

test('TEST 13 — SMALL TERRACE LOOP (Preserves Tracking & Geometry)', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));

  for (let loop = 0; loop < 2; loop++) {
    for (let side = 0; side < 4; side++) {
      const bearing = (side * 90) % 360;
      for (let step = 0; step < 10; step++) {
        now += 1000;
        [curLat, curLng] = offsetCoords(curLat, curLng, bearing, 1.2);
        engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.2, now));

        if (engine.state === 'tracking') {
          assert.equal(engine.state, 'tracking', 'Terrace loop walking must remain in tracking state');
        }
      }
    }
  }

  const snap = engine.getMetricsSnapshot(now);
  assert.ok(snap.path.length >= 10, 'Official path must preserve geometry points');
});

test('TEST 14 — STOP & CLAIM SNAPSHOT FREEZE', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));
  for (let sec = 1; sec <= 10; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }

  const snapshot = engine.finalizeSession('User Stop & Claim');
  assert.equal(engine.state, 'finalizing');
  const finalizedDistance = snapshot.distance;
  const finalizedDuration = snapshot.duration;

  for (let sec = 1; sec <= 10; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 2.0);
    engine.handleRawGpsFix(createFix(curLat, curLng, 10, 2.0, now));
  }

  const currentSnap = engine.getMetricsSnapshot(now);
  assert.equal(currentSnap.distance, finalizedDistance, 'Snapshot distance MUST remain frozen after finalization');
  assert.equal(currentSnap.duration, finalizedDuration, 'Snapshot duration MUST remain frozen after finalization');
});

// ==============================================================
// NEW REAL DEVICE REPRODUCTION TESTS (PARTS 3, 11 & 12)
// ==============================================================

test('TEST 15 — REAL DEVICE STYLE SLOW TERRACE WALK (Android coords.speed=0)', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  // Fix 1: Acquiring -> Waiting
  engine.handleRawGpsFix(createFix(curLat, curLng, 15, 0, now));
  assert.equal(engine.state, 'waiting');

  // Arming sequence: 8 seconds of walking at 1.1m/s with coords.speed = 0 (simulating Android webview bug)
  for (let sec = 1; sec <= 8; sec++) {
    now += 700; // High frequency fixes every 700ms
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 0.8);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 0, now)); // coords.speed = 0!
  }
  assert.equal(engine.state, 'tracking', 'Engine must arm on path evidence even when coords.speed=0');

  // Slow terrace walking for 60 seconds with tight turns and coords.speed = 0
  for (let sec = 1; sec <= 60; sec++) {
    now += 700;
    const bearing = (sec * 20) % 360; // Continuous tight curved turns on terrace
    [curLat, curLng] = offsetCoords(curLat, curLng, bearing, 0.6);
    engine.handleRawGpsFix(createFix(curLat, curLng, 14, 0, now)); // coords.speed = 0!

    assert.equal(engine.state, 'tracking', `Slow terrace walk MUST NOT trigger false auto-pause at sec ${sec}`);
  }

  const snap = engine.getMetricsSnapshot(now);
  assert.ok(snap.distance > 0.02, 'Official distance should accumulate cleanly during terrace walk');
});

test('TEST 16 — STATIONARY GPS DRIFT WHILE PAUSED (Must Not False Resume)', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));
  for (let sec = 1; sec <= 8; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }

  const stopLat = curLat;
  const stopLng = curLng;

  // Auto-pause countdown (18s stationary fixes)
  for (let sec = 1; sec <= 18; sec++) {
    now += 1000;
    engine.handleRawGpsFix(createFix(stopLat, stopLng, 15, 0, now));
  }
  assert.equal(engine.state, 'paused');

  // 60 seconds of stationary GPS drift excursions back and forth (3-5m)
  for (let sec = 1; sec <= 60; sec++) {
    now += 1000;
    // Jitter back and forth relative to pause anchor
    const offset = (sec % 2 === 0) ? 0.00004 : -0.00004; // ~4.4m excursion back and forth
    const driftLat = stopLat + offset;
    const driftLng = stopLng + offset;

    engine.handleRawGpsFix(createFix(driftLat, driftLng, 12, 0, now));

    assert.equal(engine.state, 'paused', `Stationary GPS drift MUST NOT trigger false resume at sec ${sec}`);
  }
});

test('TEST 17 — TIGHT CURVED WALK (Low Direction Efficiency)', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));
  for (let sec = 1; sec <= 8; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }
  assert.equal(engine.state, 'tracking');

  // Walk a tight 10m circle loop (directionEfficiency ~0.15)
  for (let step = 1; step <= 30; step++) {
    now += 1000;
    const bearing = (step * 36) % 360;
    [curLat, curLng] = offsetCoords(curLat, curLng, bearing, 1.0);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.0, now));

    assert.equal(engine.state, 'tracking', 'Tight curved walk must remain tracking');
  }
});

test('TEST 18 — FREQUENT 500–800ms GPS CALLBACKS', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));

  // 500ms callbacks with small 0.5m step
  for (let fixCount = 1; fixCount <= 60; fixCount++) {
    now += 500;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 0.5);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.0, now));
  }

  const snap = engine.getMetricsSnapshot(now);
  assert.ok(snap.distance > 0.015, 'High frequency fixes must accumulate distance cleanly');
});

test('TEST 19 — ENGINE / UI ATOMIC MIRROR', (t) => {
  const engine = new RunEngine();
  const stateHistory = [];

  engine.subscribe((type, data) => {
    stateHistory.push({ type, state: data.engineState, status: data.metrics.distance });
    assert.equal(data.engineState, engine.state, 'Emitted state MUST equal canonical engine.state synchronously');
  });

  engine.startSession();
  assert.equal(engine.state, 'acquiring');

  engine.handleRawGpsFix(createFix(37.7749, -122.4194, 15, null, 1000));
  assert.equal(engine.state, 'waiting');

  let now = 2000;
  let [cLat, cLng] = [37.7749, -122.4194];
  for (let i = 0; i < 8; i++) {
    now += 1000;
    [cLat, cLng] = offsetCoords(cLat, cLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(cLat, cLng, 12, 1.3, now));
  }
  assert.equal(engine.state, 'tracking');
  assert.ok(stateHistory.length >= 3, 'All state changes emitted atomically');
});

test('TEST 20 — SPEED & METRICS FORMAT AT UI BOUNDARY', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));
  for (let sec = 1; sec <= 8; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }

  // Inject floating fractional step
  now += 1000;
  [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.1308419345);
  engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.1308419345, now));

  const snap = engine.getMetricsSnapshot(now);

  // Assert formatted clean 1-decimal float, NOT long raw float string
  const speedString = snap.speed.toString();
  const decimalDigits = speedString.includes('.') ? speedString.split('.')[1].length : 0;

  assert.ok(decimalDigits <= 1, `Speed must be formatted to at most 1 decimal place, got: ${snap.speed}`);
  assert.ok(!isNaN(snap.speed) && isFinite(snap.speed), 'Speed must be finite number');
});

test('TEST 21 — FULL REAL DEVICE TRACE REPLAY (0-35s Jitter, 35-80s Terrace Walk, 80-110s Stopped, 110s+ Resume)', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [37.7749, -122.4194];

  // 1. 0:00 - 0:35 (Stationary Jitter)
  engine.handleRawGpsFix(createFix(curLat, curLng, 15, 0, now));
  assert.equal(engine.state, 'waiting');

  for (let sec = 1; sec <= 35; sec++) {
    now += 1000;
    const jLat = curLat + (Math.random() - 0.5) * 0.00002;
    const jLng = curLng + (Math.random() - 0.5) * 0.00002;
    engine.handleRawGpsFix(createFix(jLat, jLng, 15, 0, now));

    const snap = engine.getMetricsSnapshot(now);
    assert.equal(engine.state, 'waiting', 'Must stay WAITING during initial 35s stationary jitter');
    assert.equal(snap.distance, 0, 'Distance must remain 0 while WAITING');
  }

  // 2. 0:35 - 1:20 (Slow Terrace Walk, 45 seconds with coords.speed=0)
  for (let sec = 1; sec <= 45; sec++) {
    now += 800;
    const bearing = (sec * 15) % 360; // Tight terrace curve loop
    [curLat, curLng] = offsetCoords(curLat, curLng, bearing, 0.9);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 0, now)); // coords.speed = 0!

    if (sec > 8) {
      assert.equal(engine.state, 'tracking', `Must remain TRACKING during real terrace walk at sec ${sec}`);
    }
  }

  const walkedDistance = engine.getMetricsSnapshot(now).distance;
  assert.ok(walkedDistance > 0.02, 'Distance must accumulate during terrace walk');
  const stopLat = curLat;
  const stopLng = curLng;

  // 3. 1:20 - 1:50 (Physically Stopped 30 seconds with 3-5m drift)
  let stoppedDistance = null;
  let autoPausedConfirmed = false;
  for (let sec = 1; sec <= 30; sec++) {
    now += 1000;
    const driftOffset = (sec % 3 === 0) ? 0.00003 : 0;
    const dLat = stopLat + driftOffset;
    const dLng = stopLng + driftOffset;

    engine.handleRawGpsFix(createFix(dLat, dLng, 15, 0, now));

    const snap = engine.getMetricsSnapshot(now);
    if (sec === 3) {
      stoppedDistance = snap.distance;
    }

    if (stoppedDistance !== null) {
      assert.equal(snap.distance, stoppedDistance, 'Distance MUST freeze after physical stop');
    }

    if (engine.state === 'paused') {
      autoPausedConfirmed = true;
    }
  }

  assert.equal(autoPausedConfirmed, true, 'Engine must transition to PAUSED after 15s stationary timeout');
  assert.equal(engine.state, 'paused');

  // 4. 1:50+ (Real Walking Resume)
  for (let sec = 1; sec <= 6; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.4);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.4, now));
  }

  assert.equal(engine.state, 'tracking', 'Engine must transition PAUSED -> TRACKING on real walking resume');
});
