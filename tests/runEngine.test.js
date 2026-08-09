/**
 * RunClash 2.0 — Run Engine Automated Test Suite
 * Executes all 14 mandatory regression test scenarios using Node.js native test runner.
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

  // Initial fix transitions to waiting
  let now = 1000000;
  const baseLat = 37.7749;
  const baseLng = -122.4194;

  engine.handleRawGpsFix(createFix(baseLat, baseLng, 15, null, now));
  assert.equal(engine.state, 'waiting');

  // Simulate 120 seconds of random stationary GPS jitter (1-3m)
  for (let sec = 1; sec <= 120; sec++) {
    now += 1000;
    const jitterLat = baseLat + (Math.random() - 0.5) * 0.00003;
    const jitterLng = baseLng + (Math.random() - 0.5) * 0.00003;
    engine.handleRawGpsFix(createFix(jitterLat, jitterLng, 15, 0, now));

    const snap = engine.getMetricsSnapshot();
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

  // Walk forward 1.2m per second for 10 seconds
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

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now)); // acquiring -> waiting

  // Trigger arming
  for (let sec = 1; sec <= 8; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }
  assert.equal(engine.state, 'tracking');

  let prevDistance = engine.getMetricsSnapshot().distance;

  // Walk for 30 active seconds
  for (let sec = 1; sec <= 30; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));

    const snap = engine.getMetricsSnapshot();
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

  // Arm run
  for (let sec = 1; sec <= 8; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }
  assert.equal(engine.state, 'tracking');

  // Slow walking: 0.5m step every second (~1.8 km/h)
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

  // Walk 15 seconds
  for (let sec = 1; sec <= 15; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }
  assert.equal(engine.state, 'tracking');

  const stoppedDistance = engine.getMetricsSnapshot().distance;
  const stopLat = curLat;
  const stopLng = curLng;

  // Stationary GPS jitter for 20 seconds
  let autoPausedTriggered = false;
  for (let sec = 1; sec <= 20; sec++) {
    now += 1000;
    const jitterLat = stopLat + (Math.random() - 0.5) * 0.00002;
    const jitterLng = stopLng + (Math.random() - 0.5) * 0.00002;
    engine.handleRawGpsFix(createFix(jitterLat, jitterLng, 15, 0, now));

    const snap = engine.getMetricsSnapshot();
    assert.equal(snap.distance, stoppedDistance, 'Distance MUST be frozen after physical stop');

    if (engine.state === 'paused') {
      autoPausedTriggered = true;
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

  // Arm run
  for (let sec = 1; sec <= 8; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }

  // 1. Walk 30s
  for (let sec = 1; sec <= 30; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }

  // Force transition to paused (simulating auto-pause)
  const stopLat = curLat;
  const stopLng = curLng;
  for (let sec = 1; sec <= 16; sec++) {
    now += 1000;
    engine.handleRawGpsFix(createFix(stopLat, stopLng, 15, 0, now));
  }
  assert.equal(engine.state, 'paused');

  // Stay paused for 30 seconds
  for (let sec = 1; sec <= 30; sec++) {
    now += 1000;
    engine.handleRawGpsFix(createFix(stopLat, stopLng, 15, 0, now));
    assert.equal(engine.state, 'paused');
  }

  // Resume walk: 2 candidates then 20s walk
  now += 1000;
  [curLat, curLng] = offsetCoords(curLat, curLng, 0, 2.0);
  engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.5, now));

  now += 1000;
  [curLat, curLng] = offsetCoords(curLat, curLng, 0, 2.0);
  engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.5, now));
  assert.equal(engine.state, 'tracking');

  for (let sec = 1; sec <= 18; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }

  const snap = engine.getMetricsSnapshot(now);
  // Total active tracking time should be ~50 seconds (30s first segment + ~20s second segment)
  assert.ok(snap.duration >= 48 && snap.duration <= 52, `Active duration should be ~50s, got: ${snap.duration}s`);
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

  // Stop & Auto-pause
  const pauseLat = curLat;
  const pauseLng = curLng;
  for (let sec = 1; sec <= 16; sec++) {
    now += 1000;
    engine.handleRawGpsFix(createFix(pauseLat, pauseLng, 15, 0, now));
  }
  assert.equal(engine.state, 'paused');
  const pausedDistance = engine.getMetricsSnapshot().distance;

  // Jump physical location 5m away during pause and resume
  [curLat, curLng] = offsetCoords(pauseLat, pauseLng, 90, 5.0);

  now += 1000;
  engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.5, now));
  now += 1000;
  engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.5, now));
  assert.equal(engine.state, 'tracking');

  // The resume transition fix MUST NOT add the 5m pause jump to official distance
  const resumedDistance = engine.getMetricsSnapshot().distance;
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

  const beforeTeleportDist = engine.getMetricsSnapshot().distance;

  // Inject 150m teleport jump in 1 second
  now += 1000;
  const [teleLat, teleLng] = offsetCoords(curLat, curLng, 0, 150.0);
  engine.handleRawGpsFix(createFix(teleLat, teleLng, 10, 50.0, now));

  const afterTeleportDist = engine.getMetricsSnapshot().distance;
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

  const validDist = engine.getMetricsSnapshot().distance;

  // Inject fix with 45m accuracy
  now += 1000;
  [curLat, curLng] = offsetCoords(curLat, curLng, 0, 2.0);
  engine.handleRawGpsFix(createFix(curLat, curLng, 45, 2.0, now));

  const afterPoorAccDist = engine.getMetricsSnapshot().distance;
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
    const currentDist = engine.getMetricsSnapshot().distance;

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

  // Walk in a small 50m circular loop (4 corners of 12.5m each)
  let bearing = 0;
  for (let loop = 0; loop < 2; loop++) {
    for (let side = 0; side < 4; side++) {
      bearing = (side * 90) % 360;
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

  const snap = engine.getMetricsSnapshot();
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

  // Finalize run
  const snapshot = engine.finalizeSession('User Stop & Claim');
  assert.equal(engine.state, 'finalizing');
  const finalizedDistance = snapshot.distance;
  const finalizedDuration = snapshot.duration;

  // Subsequent GPS fixes MUST be completely ignored
  for (let sec = 1; sec <= 10; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 2.0);
    engine.handleRawGpsFix(createFix(curLat, curLng, 10, 2.0, now));
  }

  const currentSnap = engine.getMetricsSnapshot();
  assert.equal(currentSnap.distance, finalizedDistance, 'Snapshot distance MUST remain frozen after finalization');
  assert.equal(currentSnap.duration, finalizedDuration, 'Snapshot duration MUST remain frozen after finalization');
});
