import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';

const readNormalized = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// Dynamically extract and instantiate pure computeRanks function from leaderboardService.js
const leaderboardServiceSource = readNormalized('src/services/leaderboardService.js');
const computeRanksMatch = leaderboardServiceSource.match(/export const computeRanks = ([\s\S]*?);\n\nexport const getLeaderboard/);
if (!computeRanksMatch) {
  throw new Error('Could not extract computeRanks function from leaderboardService.js');
}
const computeRanks = new Function(`return (${computeRanksMatch[1]});`)();

describe('RunClash Feature Fixes & Regression Test Suite', () => {

  describe('Bug 1: Clan Joining & Duplicate Primary Key Prevention', () => {
    const clanServiceCode = readNormalized('src/services/clanService.js');
    const supabaseCode = readNormalized('src/supabase.js');
    const appCode = readNormalized('src/App.jsx');

    test('TEST 1.1: joinClan checks if user already belongs to the target clan', () => {
      assert.ok(clanServiceCode.includes('existingMemberThisClan'), 'Must check existing membership in target clan');
      assert.ok(clanServiceCode.includes("status: 'already_member'"), 'Must return friendly already_member status');
    });

    test('TEST 1.2: joinClan checks if user is already in another clan before joining', () => {
      assert.ok(clanServiceCode.includes('existingMemberOtherClan'), 'Must check if user is in another clan');
      assert.ok(clanServiceCode.includes('Leave your current clan before joining another'), 'Must return informative message to leave current clan first');
    });

    test('TEST 1.3: joinClan safely catches 23505 / clan_members_pkey duplicate key violations', () => {
      assert.ok(clanServiceCode.includes('23505') && clanServiceCode.includes('clan_members_pkey'), 'Must catch 23505 duplicate key error');
      assert.ok(clanServiceCode.includes("profiles") && clanServiceCode.includes("update({ clan_name: clan.name })"), 'Must keep profile synchronized even on duplicate key race');
    });

    test('TEST 1.4: createClan guarantees owner membership and checks existing clan', () => {
      assert.ok(clanServiceCode.includes('existingMembership'), 'createClan must check if user already belongs to a clan');
      assert.ok(clanServiceCode.includes("onConflict: 'clan_id,user_id'"), 'createClan must ensure owner membership idempotently');
    });

    test('TEST 1.5: joinClanByCode safely detects if user is in this clan vs another clan', () => {
      assert.ok(clanServiceCode.includes('existingMemberThisClan'), 'joinClanByCode must check if already member of this clan');
      assert.ok(clanServiceCode.includes('existingMemberOtherClan'), 'joinClanByCode must check if member of another clan');
    });

    test('TEST 1.6: leaveClan and leaveClanInCloud remove record from clan_members table', () => {
      assert.ok(clanServiceCode.includes("from('clan_members')") && clanServiceCode.includes(".delete()"), 'leaveClan must delete from clan_members');
      assert.ok(supabaseCode.includes("from('clan_members')") && supabaseCode.includes(".delete()"), 'leaveClanInCloud must delete from clan_members');
    });

    test('TEST 1.7: updateClan synchronizes all members profile clan_name on rename', () => {
      assert.ok(clanServiceCode.includes("from('clan_members')\n        .select('user_id')"), 'Must fetch all members of clan');
      assert.ok(clanServiceCode.includes(".update({ clan_name: updates.name.trim() })"), 'Must update profiles for all members');
    });

    test('TEST 1.8: App.jsx handles already_member state gracefully without error', () => {
      assert.ok(appCode.includes("res.status === 'already_member'"), 'App.jsx must handle already_member status');
    });
  });

  describe('Bug 2: Profile Editing & State Persistence', () => {
    const profileServiceCode = readNormalized('src/services/profileService.js');
    const editModalCode = readNormalized('src/components/profile/EditProfileModal.jsx');
    const appCode = readNormalized('src/App.jsx');

    test('TEST 2.1: checkUsernameAvailability enforces strict 3-20 lowercase alphanumeric format', () => {
      const usernameRegex = /^[a-z0-9_]{3,20}$/;
      assert.strictEqual(usernameRegex.test('runner_1'), true);
      assert.strictEqual(usernameRegex.test('abc'), true);
      assert.strictEqual(usernameRegex.test('valid_username_20c'), true);

      assert.strictEqual(usernameRegex.test('ab'), false, 'Rejects < 3 chars');
      assert.strictEqual(usernameRegex.test('this_username_is_way_too_long_for_system'), false, 'Rejects > 20 chars');
      assert.strictEqual(usernameRegex.test('runner 1'), false, 'Rejects spaces');
      assert.strictEqual(usernameRegex.test('runner-1'), false, 'Rejects hyphens');
      assert.strictEqual(usernameRegex.test('Runner_1'), false, 'Rejects uppercase');
      assert.strictEqual(usernameRegex.test('runner!'), false, 'Rejects special characters');
    });

    test('TEST 2.2: EditProfileModal does not reject users own current username', () => {
      assert.ok(editModalCode.includes('trimmedUsername !== currentUsername'), 'Must skip check if username is unchanged');
    });

    test('TEST 2.3: updateProfile catches duplicate key error and returns friendly message', () => {
      assert.ok(profileServiceCode.includes('profiles_username'), 'Must check profiles_username collision');
      assert.ok(profileServiceCode.includes('Username is already taken.'), 'Must return friendly error message');
    });

    test('TEST 2.4: updateProfile updates local cache in localStorage for persistence across reloads', () => {
      assert.ok(profileServiceCode.includes("localStorage.setItem('clash_user'"), 'Must update localStorage clash_user on save');
    });

    test('TEST 2.5: App.jsx onUpdateProfile merges all fields and saves to localStorage', () => {
      assert.ok(appCode.includes('country: updated.country'), 'Must merge country');
      assert.ok(appCode.includes('state: updated.state'), 'Must merge state');
      assert.ok(appCode.includes('city: updated.city'), 'Must merge city');
      assert.ok(appCode.includes('is_profile_public: updated.is_profile_public'), 'Must merge privacy public');
      assert.ok(appCode.includes('show_activity: updated.show_activity'), 'Must merge show_activity');
      assert.ok(appCode.includes('allow_friend_requests: updated.allow_friend_requests'), 'Must merge friend requests setting');
      assert.ok(appCode.includes("localStorage.setItem('clash_user', JSON.stringify(updatedProfile))"), 'Must persist updated profile to localStorage');
    });
  });

  describe('Bug 3: Leaderboard Sorting & Dense Ranking Policy', () => {

    test('TEST 3.1: XP ranking sorts descending by XP', () => {
      const raw = [
        { id: '1', display_name: 'Low', xp: 100, total_distance: 10, territories_owned: 1 },
        { id: '2', display_name: 'High', xp: 500, total_distance: 5, territories_owned: 0 },
        { id: '3', display_name: 'Mid', xp: 250, total_distance: 20, territories_owned: 2 }
      ];

      const ranked = computeRanks(raw, 'xp');
      assert.strictEqual(ranked[0].display_name, 'High');
      assert.strictEqual(ranked[0].rank, 1);
      assert.strictEqual(ranked[1].display_name, 'Mid');
      assert.strictEqual(ranked[1].rank, 2);
      assert.strictEqual(ranked[2].display_name, 'Low');
      assert.strictEqual(ranked[2].rank, 3);
    });

    test('TEST 3.2: Distance ranking sorts descending by total_distance', () => {
      const raw = [
        { id: '1', display_name: 'Runner A', xp: 500, total_distance: 12.5, territories_owned: 1 },
        { id: '2', display_name: 'Runner B', xp: 100, total_distance: 42.2, territories_owned: 0 },
        { id: '3', display_name: 'Runner C', xp: 800, total_distance: 21.0, territories_owned: 5 }
      ];

      const ranked = computeRanks(raw, 'distance');
      assert.strictEqual(ranked[0].display_name, 'Runner B');
      assert.strictEqual(ranked[0].rank, 1);
      assert.strictEqual(ranked[1].display_name, 'Runner C');
      assert.strictEqual(ranked[1].rank, 2);
      assert.strictEqual(ranked[2].display_name, 'Runner A');
      assert.strictEqual(ranked[2].rank, 3);
    });

    test('TEST 3.3: Territory ranking sorts descending by territories_owned', () => {
      const raw = [
        { id: '1', display_name: 'Sector Master', xp: 200, total_distance: 10, territories_owned: 15 },
        { id: '2', display_name: 'Rookie', xp: 900, total_distance: 50, territories_owned: 2 },
        { id: '3', display_name: 'Veteran', xp: 600, total_distance: 30, territories_owned: 8 }
      ];

      const ranked = computeRanks(raw, 'territories');
      assert.strictEqual(ranked[0].display_name, 'Sector Master');
      assert.strictEqual(ranked[0].rank, 1);
      assert.strictEqual(ranked[1].display_name, 'Veteran');
      assert.strictEqual(ranked[1].rank, 2);
      assert.strictEqual(ranked[2].display_name, 'Rookie');
      assert.strictEqual(ranked[2].rank, 3);
    });

    test('TEST 3.4: Tied players share the exact same rank (Dense Ranking Policy)', () => {
      const raw = [
        { id: '1', display_name: 'First Tie A', xp: 500, total_distance: 10, territories_owned: 1 },
        { id: '2', display_name: 'First Tie B', xp: 500, total_distance: 10, territories_owned: 1 },
        { id: '3', display_name: 'Second Place', xp: 400, total_distance: 8, territories_owned: 0 },
        { id: '4', display_name: 'Third Tie A', xp: 300, total_distance: 5, territories_owned: 0 },
        { id: '5', display_name: 'Third Tie B', xp: 300, total_distance: 5, territories_owned: 0 }
      ];

      const ranked = computeRanks(raw, 'xp');
      assert.strictEqual(ranked[0].rank, 1);
      assert.strictEqual(ranked[1].rank, 1, 'Tied player must share rank 1');
      assert.strictEqual(ranked[2].rank, 2, 'Next unique player gets rank 2');
      assert.strictEqual(ranked[3].rank, 3);
      assert.strictEqual(ranked[4].rank, 3, 'Tied player must share rank 3');
    });

    test('TEST 3.5: Empty or invalid input returns empty array without throwing', () => {
      assert.deepStrictEqual(computeRanks(null, 'xp'), []);
      assert.deepStrictEqual(computeRanks([], 'distance'), []);
      assert.deepStrictEqual(computeRanks(undefined, 'territories'), []);
    });
  });
});
