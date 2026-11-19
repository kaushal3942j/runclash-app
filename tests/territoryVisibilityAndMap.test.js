import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { 
  isValidCoordinate, 
  isValidPolygonCoords, 
  normalizePolygonCoords 
} from '../src/territory-engine/geometryEngine.js';

// Extract ensureClosedPolygon from src/supabase.js cleanly for Node test execution
const supabaseSrc = fs.readFileSync('src/supabase.js', 'utf8');
const fnMatch = supabaseSrc.match(/export const ensureClosedPolygon = (\(coords\) => \{[\s\S]*?\n\};)/);
const ensureClosedPolygon = fnMatch ? new Function('return ' + fnMatch[1])() : null;

describe('RunClash Real-World Fixes: Territory Cross-Device Visibility & Map Lifecycle Suite', () => {

  // --------------------------------------------------------------------------
  // PROBLEM 1: TERRITORIES NOT VISIBLE TO OTHER DEVICES
  // --------------------------------------------------------------------------

  describe('Problem 1: Territory Persistence, Geometry Normalization & Visibility', () => {

    test('1.1: normalizePolygonCoords parses and normalizes stringified JSON coordinates', () => {
      const rawCoords = [
        [24.571, 73.681],
        [24.582, 73.692],
        [24.565, 73.705],
        [24.571, 73.681]
      ];
      const stringifiedCoords = JSON.stringify(rawCoords);

      const normalized = normalizePolygonCoords(stringifiedCoords);
      assert.ok(Array.isArray(normalized), 'Normalized coords must be an array');
      assert.equal(normalized.length, 4);
      assert.equal(normalized[0][0], 24.571);
      assert.equal(normalized[0][1], 73.681);
      assert.equal(isValidPolygonCoords(normalized), true);
      // isValidPolygonCoords directly on JSON string also returns true
      assert.equal(isValidPolygonCoords(stringifiedCoords), true);
    });

    test('1.2: normalizePolygonCoords normalizes array of {lat, lng} objects to [lat, lng]', () => {
      const objectCoords = [
        { lat: 24.571, lng: 73.681 },
        { lat: 24.582, lng: 73.692 },
        { lat: 24.565, lng: 73.705 },
        { lat: 24.571, lng: 73.681 }
      ];

      const normalized = normalizePolygonCoords(objectCoords);
      assert.ok(Array.isArray(normalized));
      assert.equal(normalized.length, 4);
      assert.deepEqual(normalized[0], [24.571, 73.681]);
      assert.equal(isValidPolygonCoords(normalized), true);
    });

    test('1.3: normalizePolygonCoords unrolls nested MultiPolygon/hole rings', () => {
      const nestedCoords = [
        [
          [24.571, 73.681],
          [24.582, 73.692],
          [24.565, 73.705],
          [24.571, 73.681]
        ]
      ];

      const normalized = normalizePolygonCoords(nestedCoords);
      assert.ok(Array.isArray(normalized));
      assert.equal(normalized.length, 4);
      assert.deepEqual(normalized[0], [24.571, 73.681]);
      assert.equal(isValidPolygonCoords(nestedCoords), true);
    });

    test('1.4: ensureClosedPolygon handles stringified coords and ensures closed ring', () => {
      assert.ok(ensureClosedPolygon, 'ensureClosedPolygon must be exported from supabase.js');
      const rawCoords = [
        [24.571, 73.681],
        [24.582, 73.692],
        [24.565, 73.705]
      ];
      const stringified = JSON.stringify(rawCoords);

      const closed = ensureClosedPolygon(stringified);
      assert.ok(Array.isArray(closed));
      assert.equal(closed.length, 4); // 3 points + closed first point
      assert.deepEqual(closed[0], closed[3]);
    });

    test('1.5: subscribeToTerritories in src/supabase.js parses string coords into arrays', () => {
      assert.ok(supabaseSrc.includes('let parsedCoords = t.coords;'));
      assert.ok(supabaseSrc.includes('JSON.parse(parsedCoords)'));
      assert.ok(supabaseSrc.includes('coords: parsedCoords || t.coords'));
    });

    test('1.6: Solo Map renders rival territories with high-contrast, vivid styling (not 0.08 grey)', () => {
      const appCode = fs.readFileSync('src/App.jsx', 'utf8');
      assert.ok(appCode.includes("polyColor = '#8B5CF6';"), 'Rival territories must have vibrant Cyber Purple color');
      assert.ok(appCode.includes("fillOp = 0.22;"), 'Rival fill opacity must be prominent (0.22+)');
      assert.ok(appCode.includes("lineWeight = 2.5;"), 'Rival border weight must be strong (2.5)');
    });

    test('1.7: Clan Map renders neutral / independent territories with vivid Amber (not 0.05 faint dashes)', () => {
      const appCode = fs.readFileSync('src/App.jsx', 'utf8');
      assert.ok(appCode.includes("polyColor = '#F59E0B';"), 'Independent clan sectors must be styled with visible Amber (#F59E0B)');
      assert.ok(appCode.includes("fillOp = 0.20;"), 'Independent clan fill opacity must be visible (0.20+)');
    });

    test('1.8: Case-insensitive ownership matching for UUIDs', () => {
      const appCode = fs.readFileSync('src/App.jsx', 'utf8');
      assert.ok(appCode.includes('(currentUser?.uid || currentUser?.id || \'\').toLowerCase()'));
      assert.ok(appCode.includes('(terr.ownerId || terr.owner_id || \'\').toLowerCase()'));
      assert.ok(supabaseSrc.includes('sUser.id.toLowerCase() === validOwnerId.toLowerCase()'));
    });

    test('1.9: Map territory rendering cleans up removed/expired layers', () => {
      const appCode = fs.readFileSync('src/App.jsx', 'utf8');
      assert.ok(appCode.includes('const activeIds = new Set((territories || []).filter(Boolean).map(t => t.id));'));
      assert.ok(appCode.includes('mapInstanceRef.current.removeLayer(territoryPolygonsRef.current[id]);'));
      assert.ok(appCode.includes('delete territoryPolygonsRef.current[id];'));
    });

    test('1.10: territoryService.saveTerritory strictly requires res.success === true', () => {
      const terrCode = fs.readFileSync('src/services/territoryService.js', 'utf8');
      assert.ok(terrCode.includes('success: Boolean(res && res.success)'));
    });
  });

  // --------------------------------------------------------------------------
  // PROBLEM 2: MAP BLANK/BLACK SCREEN PREVENTION & RECOVERY
  // --------------------------------------------------------------------------

  describe('Problem 2: Leaflet Lifecycle, Tile Fallback & Recovery Mechanism', () => {

    test('2.1: Map setup useEffect does NOT depend on currentUser or identity updates', () => {
      const appCode = fs.readFileSync('src/App.jsx', 'utf8');
      const mapSetupMatch = appCode.match(/\/\/ Leaflet Map Setup[\s\S]*?useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/);
      assert.ok(mapSetupMatch, 'Map setup useEffect must have an empty dependency array [] to prevent unmounting on stats/XP updates');
    });

    test('2.2: Stale _leaflet_id is cleared before initialization to prevent "Map container is already initialized"', () => {
      const appCode = fs.readFileSync('src/App.jsx', 'utf8');
      assert.ok(appCode.includes('if (mapElement._leaflet_id && !mapInstanceRef.current) {'));
      assert.ok(appCode.includes('mapElement._leaflet_id = null;'));
    });

    test('2.3: MapLibre vector errors and WebGL context loss trigger raster OSM fallback', () => {
      const appCode = fs.readFileSync('src/App.jsx', 'utf8');
      assert.ok(appCode.includes('glMap.on(\'error\','));
      assert.ok(appCode.includes('addOsmRasterFallback()'));
      assert.ok(appCode.includes('webglcontextlost'));
    });

    test('2.4: Tile errors are detected and user recovery retry action is provided', () => {
      const appCode = fs.readFileSync('src/App.jsx', 'utf8');
      assert.ok(appCode.includes("rasterLayer.on('tileerror',"));
      assert.ok(appCode.includes('setMapTileError(true);'));
      assert.ok(appCode.includes('const retryMapTiles = () => {'));
      assert.ok(appCode.includes('mapInstanceRef.current.invalidateSize();'));
      assert.ok(appCode.includes('refreshTerritories();'));
      assert.ok(appCode.includes('{mapTileError && ('));
    });

    test('2.5: ResizeObserver and visibilitychange handle mobile resume and tab navigation', () => {
      const appCode = fs.readFileSync('src/App.jsx', 'utf8');
      assert.ok(appCode.includes('new ResizeObserver('));
      assert.ok(appCode.includes('document.addEventListener(\'visibilitychange\', handleVisibilityChange);'));
      assert.ok(appCode.includes('refreshTerritories();'));
    });

    test('2.6: recenterMap falls back to tactical sectors if user GPS position is not yet locked', () => {
      const appCode = fs.readFileSync('src/App.jsx', 'utf8');
      assert.ok(appCode.includes('mapInstanceRef.current && territories && territories.length > 0'));
      assert.ok(appCode.includes('mapInstanceRef.current.setView(norm[0], 15.5);'));
      assert.ok(appCode.includes('Centered on tactical sector'));
    });

    test('2.7: #map DOM container has solid dark fallback background color to prevent black/white flashes', () => {
      const appCode = fs.readFileSync('src/App.jsx', 'utf8');
      assert.ok(appCode.includes('backgroundColor: \'#0B0B0D\''));
    });
  });
});
