/**
 * RunClash GPS Safeguards Automated Test Suite
 * Tests strict GPS accuracy gating, stationary jitter protection,
 * impossible jump rejection, coordinate validity & ordering, and territory persistence checks.
 * All tests execute actual production functions and mock providers (zero source-text scraping).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { RunEngine } from '../src/run-engine/runEngine.js';
import { RUN_ENGINE_CONFIG } from '../src/run-engine/runEngineConfig.js';
import { isValidCoordinate, isValidPolygonCoords, validateTerritoryCapture } from '../src/territory-engine/geometryEngine.js';

function createFix(lat, lng, accuracy = 15, speed = null, timestampMs = Date.now()) {
  return {
    latitude: lat,
    longitude: lng,
    accuracy,
    speed,
    timestamp: timestampMs
  };
}

function offsetCoords(startLat, startLng, bearingDegrees, distanceMeters) {
  const R = 6371000;
  const rad = bearingDegrees * Math.PI / 180;
  const dLat = (distanceMeters * Math.cos(rad)) / R;
  const dLng = (distanceMeters * Math.sin(rad)) / (R * Math.cos(startLat * Math.PI / 180));
  return [startLat + (dLat * 180 / Math.PI), startLng + (dLng * 180 / Math.PI)];
}

test('GPS SAFEGUARDS 1 — Missing, invalid, zero, and negative accuracy strictly rejected', (t) => {
  const engine = new RunEngine();
  engine.startSession();
  assert.equal(engine.state, 'acquiring');

  const baseLat = 24.6071;
  const baseLng = 73.7508;
  const now = 1000000;

  // 1. null accuracy
  engine.handleRawGpsFix({ latitude: baseLat, longitude: baseLng, accuracy: null, timestamp: now });
  assert.equal(engine.state, 'acquiring', 'null accuracy must be rejected in acquiring');

  // 2. undefined accuracy
  engine.handleRawGpsFix({ latitude: baseLat, longitude: baseLng, accuracy: undefined, timestamp: now + 1000 });
  assert.equal(engine.state, 'acquiring', 'undefined accuracy must be rejected');

  // 3. zero accuracy (0 is not positive precision)
  engine.handleRawGpsFix({ latitude: baseLat, longitude: baseLng, accuracy: 0, timestamp: now + 2000 });
  assert.equal(engine.state, 'acquiring', '0 accuracy must be rejected');

  // 4. negative accuracy
  engine.handleRawGpsFix({ latitude: baseLat, longitude: baseLng, accuracy: -10, timestamp: now + 3000 });
  assert.equal(engine.state, 'acquiring', 'negative accuracy must be rejected');

  // 5. NaN accuracy
  engine.handleRawGpsFix({ latitude: baseLat, longitude: baseLng, accuracy: NaN, timestamp: now + 4000 });
  assert.equal(engine.state, 'acquiring', 'NaN accuracy must be rejected');

  // 6. string accuracy
  engine.handleRawGpsFix({ latitude: baseLat, longitude: baseLng, accuracy: "15", timestamp: now + 5000 });
  assert.equal(engine.state, 'acquiring', 'string accuracy must be rejected');

  // 7. poor accuracy > 20m threshold (e.g. 25m)
  engine.handleRawGpsFix({ latitude: baseLat, longitude: baseLng, accuracy: 25, timestamp: now + 6000 });
  assert.equal(engine.state, 'acquiring', 'accuracy > 20m must be rejected in acquiring');

  // 8. valid accuracy <= 20m
  engine.handleRawGpsFix({ latitude: baseLat, longitude: baseLng, accuracy: 15, timestamp: now + 7000 });
  assert.equal(engine.state, 'waiting', 'valid accuracy <= 20m must be accepted');
});

test('GPS SAFEGUARDS 2 — Poor accuracy (> 20m) rejected during waiting and tracking', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  const baseLat = 24.6071;
  const baseLng = 73.7508;

  // Acquire baseline with good accuracy (15m)
  engine.handleRawGpsFix(createFix(baseLat, baseLng, 15, null, now));
  assert.equal(engine.state, 'waiting');

  // In waiting: fix with accuracy 25m must be rejected without polluting buffer
  now += 1000;
  engine.handleRawGpsFix(createFix(baseLat + 0.0001, baseLng, 25, 1.5, now));
  assert.equal(engine.waitingBuffer.length, 0, 'Poor accuracy fix in waiting must not enter buffer');

  // Start real walk to enter tracking
  let [curLat, curLng] = [baseLat, baseLng];
  for (let sec = 1; sec <= 8; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }
  assert.equal(engine.state, 'tracking');
  const validDist = engine.getMetricsSnapshot(now).distance;

  // In tracking: fix with accuracy 22m (> 20m) must be rejected
  now += 1000;
  [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.5);
  engine.handleRawGpsFix(createFix(curLat, curLng, 22, 1.5, now));
  const afterDist = engine.getMetricsSnapshot(now).distance;
  assert.equal(afterDist, validDist, 'Distance must NOT increase on poor accuracy fix in tracking');
});

test('GPS SAFEGUARDS 3 — Stationary GPS jitter does not start run or accumulate distance', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  const baseLat = 24.6071;
  const baseLng = 73.7508;

  engine.handleRawGpsFix(createFix(baseLat, baseLng, 14, null, now));
  assert.equal(engine.state, 'waiting');

  // Simulate 120 seconds of stationary GPS jitter around base point (+- 3 meters)
  for (let sec = 1; sec <= 120; sec++) {
    now += 1000;
    const jitterLat = baseLat + (Math.random() - 0.5) * 0.00003;
    const jitterLng = baseLng + (Math.random() - 0.5) * 0.00003;
    engine.handleRawGpsFix(createFix(jitterLat, jitterLng, 12 + Math.random() * 5, 0, now));

    const snap = engine.getMetricsSnapshot(now);
    assert.equal(engine.state, 'waiting', 'Engine MUST remain in waiting during stationary jitter');
    assert.equal(snap.distance, 0, 'Distance must remain 0.0');
    assert.equal(snap.duration, 0, 'Duration must remain 0');
    assert.equal(snap.speed, 0, 'Speed must remain 0.0');
  }
});

test('GPS SAFEGUARDS 4 — Sudden location jump during waiting resets baseline without starting run', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  const coarseLat = 24.6000;
  const coarseLng = 73.7400;

  // Baseline initially established
  engine.handleRawGpsFix(createFix(coarseLat, coarseLng, 15, null, now));
  assert.equal(engine.state, 'waiting');

  // Next second: sudden 70-meter jump to real GPS location
  now += 1000;
  const [jumpLat, jumpLng] = offsetCoords(coarseLat, coarseLng, 0, 70.0);
  engine.handleRawGpsFix(createFix(jumpLat, jumpLng, 10, 0, now));

  // Must NOT trigger transition to tracking!
  assert.equal(engine.state, 'waiting', 'Waiting jump must NOT trigger transition to tracking');
  assert.equal(engine.waitingBaseline.lat, jumpLat, 'Baseline must be reacquired at new accurate fix');
  assert.equal(engine.waitingBuffer.length, 0, 'Waiting buffer must be cleared on jump');
});

test('GPS SAFEGUARDS 5 — Teleport jump during tracking is rejected', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [24.6071, 73.7508];

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));
  for (let sec = 1; sec <= 8; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }
  assert.equal(engine.state, 'tracking');
  const distBefore = engine.getMetricsSnapshot(now).distance;

  // 1-second interval: 100m teleport jump (360 km/h)
  now += 1000;
  const [teleLat, teleLng] = offsetCoords(curLat, curLng, 0, 100.0);
  engine.handleRawGpsFix(createFix(teleLat, teleLng, 10, 100.0, now));

  const distAfter = engine.getMetricsSnapshot(now).distance;
  assert.equal(distAfter, distBefore, 'Teleport jump in tracking must be rejected without increasing distance');
});

test('GPS SAFEGUARDS 6 — Safe step allowance accounts for elapsed time between GPS fixes', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [24.6071, 73.7508];

  engine.handleRawGpsFix(createFix(curLat, curLng, 15, null, now));
  for (let sec = 1; sec <= 8; sec++) {
    now += 1000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 1.3);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 1.3, now));
  }
  assert.equal(engine.state, 'tracking');
  const distBefore = engine.getMetricsSnapshot(now).distance;

  // Legitimate runner running at 12 km/h (3.33 m/s) with an 8-second GPS callback interval (distance = 26.6m)
  now += 8000;
  [curLat, curLng] = offsetCoords(curLat, curLng, 0, 26.6);
  // Feed fix with speed 12 km/h
  engine.handleRawGpsFix(createFix(curLat, curLng, 12, 3.33, now));

  const distAfter = engine.getMetricsSnapshot(now).distance;
  assert.ok(distAfter > distBefore, 'Multi-second valid run interval must NOT be rejected by a flat 25m cap');
});

test('GPS SAFEGUARDS 7 — Coordinate ordering strictly preserves [latitude, longitude]', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  const testLat = 24.6071209;
  const testLng = 73.7508451;

  engine.handleRawGpsFix(createFix(testLat, testLng, 12, null, 1000000));
  assert.equal(engine.lastPoint[0], testLat, 'Index 0 MUST be latitude');
  assert.equal(engine.lastPoint[1], testLng, 'Index 1 MUST be longitude');
});

test('GPS SAFEGUARDS 8 — Coordinate validation strictly rejects out-of-bounds coordinates', (t) => {
  // Valid coordinates
  assert.equal(isValidCoordinate([24.6071, 73.7508]), true);
  assert.equal(isValidCoordinate([0, 0]), true);
  assert.equal(isValidCoordinate([-90, 180]), true);
  assert.equal(isValidCoordinate([90, -180]), true);

  // Out of bounds latitude
  assert.equal(isValidCoordinate([91.0, 73.0]), false);
  assert.equal(isValidCoordinate([-90.1, 73.0]), false);

  // Out of bounds longitude
  assert.equal(isValidCoordinate([24.0, 180.5]), false);
  assert.equal(isValidCoordinate([24.0, -180.5]), false);

  // Non-numeric or missing
  assert.equal(isValidCoordinate(["24.0", 73.0]), false);
  assert.equal(isValidCoordinate([NaN, 73.0]), false);
  assert.equal(isValidCoordinate([null, 73.0]), false);
  assert.equal(isValidCoordinate([24.0]), false);
  assert.equal(isValidCoordinate(null), false);
  assert.equal(isValidCoordinate("24.0, 73.0"), false);
});

test('GPS SAFEGUARDS 9 — validateTerritoryCapture rejects invalid coordinates in path', (t) => {
  const baseLat = 24.6071;
  const baseLng = 73.7508;

  // Create a 10-point path where one coordinate has an out-of-range latitude (124.6)
  const invalidPath = [];
  for (let i = 0; i < 10; i++) {
    invalidPath.push(offsetCoords(baseLat, baseLng, i * 36, 20));
  }
  invalidPath[5] = [124.607, 73.750]; // Injected invalid coordinate

  const res = validateTerritoryCapture(invalidPath);
  assert.equal(res.valid, false);
  assert.equal(res.reason, 'INVALID_COORDINATES');
});

test('GPS SAFEGUARDS 10 — Production polygon and coordinate validation functions strictly enforce geometry rules', (t) => {
  const baseLat = 24.6071;
  const baseLng = 73.7508;

  // 1. isValidPolygonCoords validates flat coordinate rings
  const validRing = [
    [baseLat, baseLng],
    [baseLat + 0.001, baseLng],
    [baseLat + 0.001, baseLng + 0.001],
    [baseLat, baseLng]
  ];
  assert.equal(isValidPolygonCoords(validRing), true, 'Valid 4-point ring must pass');

  // 2. isValidPolygonCoords validates nested ring structures (e.g. GeoJSON MultiPolygon)
  assert.equal(isValidPolygonCoords([validRing]), true, 'Valid nested ring must pass');

  // 3. isValidPolygonCoords rejects rings containing out-of-bounds coordinates
  const outOfBoundsRing = [
    [baseLat, baseLng],
    [95.0, baseLng], // Invalid latitude
    [baseLat + 0.001, baseLng + 0.001],
    [baseLat, baseLng]
  ];
  assert.equal(isValidPolygonCoords(outOfBoundsRing), false, 'Ring with latitude > 90 must fail');

  const outOfBoundsLngRing = [
    [baseLat, baseLng],
    [baseLat + 0.001, 185.0], // Invalid longitude
    [baseLat + 0.001, baseLng + 0.001],
    [baseLat, baseLng]
  ];
  assert.equal(isValidPolygonCoords(outOfBoundsLngRing), false, 'Ring with longitude > 180 must fail');

  // 4. isValidPolygonCoords rejects insufficient points (< 3 valid points)
  assert.equal(isValidPolygonCoords([[baseLat, baseLng], [baseLat + 0.001, baseLng]]), false, 'Fewer than 3 points must fail');
  assert.equal(isValidPolygonCoords(null), false, 'null coords must fail');
  assert.equal(isValidPolygonCoords([]), false, 'empty coords must fail');

  // 5. Production RunEngine rejects out-of-bounds coordinates at GPS fix ingress
  const engine = new RunEngine();
  engine.startSession();
  const rejectedStart = engine.metrics.rejectedFixesCount;

  engine.handleRawGpsFix({ latitude: 91.5, longitude: 73.7, accuracy: 15, timestamp: 1000000 });
  assert.equal(engine.metrics.rejectedFixesCount, rejectedStart + 1, 'Lat > 90 must increment rejectedFixesCount');

  engine.handleRawGpsFix({ latitude: -91.5, longitude: 73.7, accuracy: 15, timestamp: 1001000 });
  assert.equal(engine.metrics.rejectedFixesCount, rejectedStart + 2, 'Lat < -90 must increment rejectedFixesCount');

  engine.handleRawGpsFix({ latitude: 24.6, longitude: 181.5, accuracy: 15, timestamp: 1002000 });
  assert.equal(engine.metrics.rejectedFixesCount, rejectedStart + 3, 'Lng > 180 must increment rejectedFixesCount');

  engine.handleRawGpsFix({ latitude: 24.6, longitude: -181.5, accuracy: 15, timestamp: 1003000 });
  assert.equal(engine.metrics.rejectedFixesCount, rejectedStart + 4, 'Lng < -180 must increment rejectedFixesCount');
  assert.equal(engine.state, 'acquiring', 'Out-of-bounds fixes must never advance engine state');
});

test('GPS SAFEGUARDS 11 — Production registerGpsWatch enforces maximumAge: 0, high accuracy, and strict accuracy verification via mock provider', (t) => {
  let capturedSuccessCb = null;
  let capturedErrorCb = null;
  let capturedOptions = null;
  let clearedWatchId = null;

  const mockGeolocation = {
    watchPosition(success, error, options) {
      capturedSuccessCb = success;
      capturedErrorCb = error;
      capturedOptions = options;
      return 777;
    },
    clearWatch(id) {
      clearedWatchId = id;
    }
  };

  const engine = new RunEngine();
  engine.startSession();
  assert.equal(engine.state, 'acquiring');

  // Call production registerGpsWatch with mock provider
  engine.registerGpsWatch(mockGeolocation);

  // 1. Verify exact production geolocation options passed to browser API
  assert.ok(capturedOptions, 'watchPosition must have been called with options');
  assert.equal(capturedOptions.maximumAge, 0, 'watchPosition MUST enforce maximumAge: 0 to prevent cached stale fixes');
  assert.equal(capturedOptions.enableHighAccuracy, true, 'watchPosition MUST enforce enableHighAccuracy: true');
  assert.equal(engine.watchId, 777, 'Engine must store watchId returned by geolocation provider');

  // 2. Duplicate registration attempt must be ignored
  engine.registerGpsWatch(mockGeolocation);
  assert.equal(engine.watchId, 777, 'Duplicate watch registration must not alter existing watchId');

  // 3. Behavioral test: Position fix delivered with null/missing accuracy is NOT defaulted to 15
  // If pos.coords.accuracy || 15 bug existed, accuracy would become 15 (<= 20) and advance engine to 'waiting'.
  // With fix, verifiedAccuracy is null, fix is rejected, engine stays in 'acquiring'.
  capturedSuccessCb({
    coords: { latitude: 24.6071, longitude: 73.7508, accuracy: null, speed: null, heading: null },
    timestamp: 1000000
  });
  assert.equal(engine.state, 'acquiring', 'Missing accuracy must NOT be defaulted to 15; state must remain acquiring');
  assert.equal(engine.metrics.rejectedFixesCount, 1, 'Rejected fixes count must increment on missing accuracy');

  // 4. Position fix delivered with zero accuracy
  capturedSuccessCb({
    coords: { latitude: 24.6071, longitude: 73.7508, accuracy: 0, speed: null, heading: null },
    timestamp: 1001000
  });
  assert.equal(engine.state, 'acquiring', 'Zero accuracy must be rejected; state must remain acquiring');
  assert.equal(engine.metrics.rejectedFixesCount, 2, 'Rejected fixes count must increment on 0 accuracy');

  // 5. Valid accuracy fix delivered through callback
  capturedSuccessCb({
    coords: { latitude: 24.6071, longitude: 73.7508, accuracy: 12, speed: 0, heading: 0 },
    timestamp: 1002000
  });
  assert.equal(engine.state, 'waiting', 'Usable fix (accuracy <= 20) must advance engine to waiting');

  // 6. Production clearGpsWatch invokes provider clearWatch
  engine.clearGpsWatch(mockGeolocation);
  assert.equal(clearedWatchId, 777, 'clearGpsWatch must call provider clearWatch with active watchId');
  assert.equal(engine.watchId, null, 'clearGpsWatch must set watchId to null');
});

test('GPS SAFEGUARDS 12 — Waiting jump timing measures speed against previous fix after prolonged stationary period', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  const baseLat = 24.6071;
  const baseLng = 73.7508;

  // Initial fix establishes baseline at t = 1000000
  engine.handleRawGpsFix(createFix(baseLat, baseLng, 14, null, now));
  assert.equal(engine.state, 'waiting');

  // User stands stationary for 60 seconds (60 fixes at 1 Hz, minimal jitter)
  for (let s = 1; s <= 60; s++) {
    now += 1000;
    engine.handleRawGpsFix(createFix(baseLat, baseLng, 12, 0, now));
    assert.equal(engine.state, 'waiting');
  }

  // At second 61 (now = 1061000), a sudden 35m jump occurs in 1 second
  // Elapsed time from baseline is 61s (which would give 2.0 km/h under old bug and evade jump guard!)
  // Elapsed time from previous fix is 1s -> speed is 35m / 1s * 3.6 = 126 km/h -> MUST BE DETECTED AS JUMP!
  now += 1000;
  const [jumpLat, jumpLng] = offsetCoords(baseLat, baseLng, 0, 35.0);
  engine.handleRawGpsFix(createFix(jumpLat, jumpLng, 10, 0, now));

  // Must detect jump, reacquire baseline at new location, clear buffer, and remain in waiting
  assert.equal(engine.state, 'waiting', 'Must not trigger tracking on jump');
  assert.equal(engine.waitingBaseline.lat, jumpLat, 'Baseline must reacquire at new fix');
  assert.equal(engine.waitingBuffer.length, 0, 'Buffer must be reset');
  const snap = engine.getMetricsSnapshot(now);
  assert.equal(snap.distance, 0, 'Distance must remain 0');
});

test('GPS SAFEGUARDS 13 — Out-of-order and non-positive elapsed time fixes in waiting handled safely', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  const baseLat = 24.6071;
  const baseLng = 73.7508;

  engine.handleRawGpsFix(createFix(baseLat, baseLng, 14, null, now));
  assert.equal(engine.state, 'waiting');

  // Fix 2 at now + 5000
  now += 5000;
  engine.handleRawGpsFix(createFix(baseLat, baseLng, 12, 0, now));
  assert.equal(engine.waitingBuffer.length, 1);

  // Out-of-order fix delivered late (timestamp = now - 3000)
  const rejectedCountBefore = engine.metrics.rejectedFixesCount;
  engine.handleRawGpsFix(createFix(baseLat + 0.0001, baseLng, 12, 0, now - 3000));
  assert.equal(engine.metrics.rejectedFixesCount, rejectedCountBefore + 1, 'Out-of-order fix must be rejected');
  assert.equal(engine.waitingBuffer.length, 1, 'Waiting buffer must not be corrupted by out-of-order fix');

  // Duplicate timestamp fix (timestamp = now)
  engine.handleRawGpsFix(createFix(baseLat, baseLng, 12, 0, now));
  assert.equal(engine.state, 'waiting');
  assert.equal(engine.getMetricsSnapshot(now).distance, 0);
});

test('GPS SAFEGUARDS 14 — Legitimate walking and running with delayed GPS callbacks still arm to tracking', (t) => {
  const engine = new RunEngine();
  engine.startSession();

  let now = 1000000;
  let [curLat, curLng] = [24.6071, 73.7508];

  // Baseline at t = 1000000
  engine.handleRawGpsFix(createFix(curLat, curLng, 14, null, now));
  assert.equal(engine.state, 'waiting');

  // Runner begins running at 12 km/h (3.33 m/s) with a 3-second callback interval (10m per fix)
  // Step is 10m (speed = 12 km/h, well below 30 km/h jump cap)
  for (let step = 1; step <= 3; step++) {
    now += 3000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 10.0);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 3.33, now));
  }

  // Must transition to tracking despite multi-second callback delay
  assert.equal(engine.state, 'tracking', 'Legitimate run with delayed callbacks must arm to tracking');

  // Once armed, runner continues running in tracking state and distance accumulates
  for (let step = 1; step <= 4; step++) {
    now += 3000;
    [curLat, curLng] = offsetCoords(curLat, curLng, 0, 10.0);
    engine.handleRawGpsFix(createFix(curLat, curLng, 12, 3.33, now));
  }

  assert.ok(engine.getMetricsSnapshot(now).distance > 0, 'Distance must accumulate once armed and running in tracking');
});
