import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';

const readNormalized = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

describe('RunClash Account Upgrade & Guest Protection Test Suite', () => {
  const authServiceCode = readNormalized('src/services/authService.js');
  const useIdentityCode = readNormalized('src/hooks/useIdentity.js');
  const profileScreenCode = readNormalized('src/screens/ProfileScreen.jsx');
  const protectModalCode = readNormalized('src/components/profile/ProtectAccountModal.jsx');
  const appCode = readNormalized('src/App.jsx');

  describe('Requirement 1 & 3: Architecture & In-Place updateUser Flow', () => {
    test('TEST 1.1: upgradeAnonymousAccount calls supabase.auth.updateUser and NEVER calls signUp', () => {
      assert.ok(authServiceCode.includes('supabase.auth.updateUser'), 'Must call supabase.auth.updateUser');
      
      // Ensure the upgrade function itself does not call signUp
      const upgradeFuncBody = authServiceCode.substring(
        authServiceCode.indexOf('export const upgradeAnonymousAccount'),
        authServiceCode.indexOf('export const recoverSession')
      );
      assert.ok(!upgradeFuncBody.includes('supabase.auth.signUp'), 'Upgrade flow must never call signUp() to avoid creating duplicate UUIDs');
    });

    test('TEST 1.2: upgradeAnonymousAccount verifies that current user is anonymous', () => {
      assert.ok(authServiceCode.includes('!currentUser.is_anonymous'), 'Must check currentUser.is_anonymous');
      assert.ok(authServiceCode.includes('already_permanent'), 'Must return already_permanent error code for non-anonymous users');
    });

    test('TEST 1.3: upgradeAnonymousAccount checks for active session before attempting upgrade', () => {
      assert.ok(authServiceCode.includes('sessionError || !sessionData?.session?.user'), 'Must check for valid active session');
      assert.ok(authServiceCode.includes('no_session'), 'Must return no_session error code when session is missing');
    });
  });

  describe('Requirement 4 & 5: Validation, Security & Error Handling', () => {
    test('TEST 2.1: Validates email format before API dispatch', () => {
      assert.ok(authServiceCode.includes('emailRegex.test'), 'Must validate email format with regex');
      assert.ok(authServiceCode.includes('invalid_email'), 'Must return invalid_email error code');
    });

    test('TEST 2.2: Enforces minimum 6-character password constraint', () => {
      assert.ok(authServiceCode.includes('password.length < 6'), 'Must check password length < 6');
      assert.ok(authServiceCode.includes('weak_password'), 'Must return weak_password error code');
    });

    test('TEST 2.3: Gracefully handles duplicate email (422 / already registered)', () => {
      assert.ok(authServiceCode.includes('already registered') || authServiceCode.includes('already in use'), 'Must detect duplicate email from Supabase error');
      assert.ok(authServiceCode.includes('email_taken'), 'Must return email_taken code');
      assert.ok(authServiceCode.includes('already associated with another account'), 'Must provide actionable message for duplicate email');
    });

    test('TEST 2.4: Gracefully handles network failures', () => {
      assert.ok(authServiceCode.includes('network_error'), 'Must catch and classify network errors');
      assert.ok(authServiceCode.includes('check your internet connection'), 'Must provide clear network failure feedback');
    });

    test('TEST 2.5: Distinguishes email confirmation required vs instant link', () => {
      assert.ok(authServiceCode.includes('requiresEmailConfirmation'), 'Must determine if email confirmation is required');
      assert.ok(authServiceCode.includes('updatedUser.new_email'), 'Must inspect new_email status');
    });
  });

  describe('Requirement 6, 7 & 8: Data Preservation & Token Safety', () => {
    test('TEST 3.1: Passwords and tokens are never printed to console logs', () => {
      const upgradeFuncBody = authServiceCode.substring(
        authServiceCode.indexOf('export const upgradeAnonymousAccount'),
        authServiceCode.indexOf('export const recoverSession')
      );
      assert.ok(!upgradeFuncBody.includes('console.log(password'), 'Must never log password');
      assert.ok(!upgradeFuncBody.includes('console.log(updateData'), 'Must never log full updateData with session tokens');
      assert.ok(!upgradeFuncBody.includes('console.log(sessionData'), 'Must never log sessionData tokens');
    });

    test('TEST 3.2: Does not call signOut or clear localStorage during upgrade', () => {
      const upgradeFuncBody = authServiceCode.substring(
        authServiceCode.indexOf('export const upgradeAnonymousAccount'),
        authServiceCode.indexOf('export const recoverSession')
      );
      assert.ok(!upgradeFuncBody.includes('signOut'), 'Upgrade must never call signOut');
      assert.ok(!upgradeFuncBody.includes('localStorage.clear()'), 'Upgrade must never clear all localStorage');
      assert.ok(!upgradeFuncBody.includes("removeItem('runclash-supabase-auth')"), 'Upgrade must not delete active auth token');
    });

    test('TEST 3.3: useIdentity updates currentProfile and preserves user identity without resetting', () => {
      assert.ok(useIdentityCode.includes('upgradeGuestAccount'), 'useIdentity must export upgradeGuestAccount');
      assert.ok(useIdentityCode.includes('is_guest: false'), 'useIdentity must flip is_guest to false upon upgrade');
      assert.ok(useIdentityCode.includes("localStorage.setItem('clash_user'"), 'useIdentity must sync clash_user cache with updated email');
    });
  });

  describe('Requirement 2 & UI: Accessibility and Profile/Settings Integration', () => {
    test('TEST 4.1: ProfileScreen displays Protect Account prompt for guest runners', () => {
      assert.ok(profileScreenCode.includes('ProtectAccountModal'), 'ProfileScreen must import ProtectAccountModal');
      assert.ok(profileScreenCode.includes('isGuestUser'), 'ProfileScreen must detect guest users');
      assert.ok(profileScreenCode.includes('Guest Account Unsecured'), 'ProfileScreen must render guest warning banner');
      assert.ok(profileScreenCode.includes('Protect Account (Link Email)'), 'ProfileScreen must render Protect Account CTA button');
    });

    test('TEST 4.2: App.jsx wires upgradeGuestAccount to ProfileScreen and Runner HQ Settings', () => {
      assert.ok(appCode.includes('upgradeGuestAccount'), 'App.jsx must destructure upgradeGuestAccount');
      assert.ok(appCode.includes('onUpgradeAccount={upgradeGuestAccount}'), 'App.jsx must pass onUpgradeAccount to ProfileScreen');
      assert.ok(appCode.includes('showProtectAccountModal'), 'App.jsx must control ProtectAccountModal visibility');
      assert.ok(appCode.includes('Account Security: Unprotected Guest'), 'App.jsx must render account security section in Runner HQ');
    });

    test('TEST 4.3: ProtectAccountModal enforces confirm password and clear feedback', () => {
      assert.ok(protectModalCode.includes('protect-account-email'), 'Must provide unique element ID for email');
      assert.ok(protectModalCode.includes('protect-account-password'), 'Must provide unique element ID for password');
      assert.ok(protectModalCode.includes('protect-account-confirm-password'), 'Must provide unique element ID for confirm password');
      assert.ok(protectModalCode.includes('Passwords do not match'), 'Must validate matching passwords');
      assert.ok(protectModalCode.includes('Verification Email Sent') || protectModalCode.includes('Account Secured!'), 'Must provide clear success screen');
    });
  });
});
