import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';

describe('Profile, Refresh, and Social UI Fixes', () => {

  test('TEST 1: Profile stats avoid zero-flash and infinite loop', () => {
    const code = fs.readFileSync('src/screens/ProfileScreen.jsx', 'utf8');
    // Ensure onRefresh is no longer in the dependency array for fetchStats
    assert.ok(code.includes('}, [currentProfile?.uid]);'));
    // Ensure handleRefresh is defined separately
    assert.ok(code.includes('const handleRefresh = async () => {'));
  });

  test('TEST 2: Native pull-to-refresh reload control is disabled', () => {
    const css = fs.readFileSync('src/index.css', 'utf8');
    assert.ok(css.includes('overscroll-behavior-y: none;'));
  });

  test('TEST 3: Plus icon is removed from Social/Activity Feed', () => {
    const code = fs.readFileSync('src/screens/ActivityFeedScreen.jsx', 'utf8');
    assert.ok(!code.includes('<Plus size={24} />'));
  });
});
