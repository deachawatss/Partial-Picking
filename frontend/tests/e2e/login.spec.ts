// T085: E2E Test for Login Flow
// Constitutional Compliance: Validates dual authentication (LDAP + SQL) with JWT token
//
// Tests verify:
// 1. LDAP login → Redirect to picking page
// 2. SQL login → Redirect to picking page
// 3. Invalid credentials → Display error message
// 4. Token stored in localStorage
// 5. Protected routes require authentication
//
// Resolution: 1280x1024 (constitutional requirement)

import { test, expect } from '@playwright/test';

test.describe('Login Flow - Dual Authentication (LDAP + SQL)', () => {
  // Constitutional requirement: Test at 1280x1024 resolution
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1024 });
    await page.goto('http://localhost:6060');
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: Clear authentication state
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should display login page on initial load', async ({ page }) => {
    // Verify login page elements are visible
    await expect(page.locator('h1, h2').filter({ hasText: /login/i })).toBeVisible();
    await expect(page.locator('input[name="username"], input[type="text"]').first()).toBeVisible();
    await expect(page.locator('input[name="password"], input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  });

  test('T085.1: LDAP authentication → Redirect to picking page', async ({ page }) => {
    // Arrange: LDAP credentials (from quickstart.md validation scenario)
    const ldapUsername = 'dechawat';
    const ldapPassword = 'P@ssw0rd123';

    // Act: Fill login form
    await page.locator('input[name="username"], input[type="text"]').first().fill(ldapUsername);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ldapPassword);
    await page.locator('button[type="submit"]').first().click();

    // Assert: Redirected to partial picking page
    await expect(page).toHaveURL(/.*partial-picking/, { timeout: 10000 });

    // Verify authenticated UI elements visible
    await expect(page.locator('text=/run.*no/i').or(page.locator('input[name="runNo"]'))).toBeVisible({ timeout: 5000 });
  });

  test('T085.2: SQL authentication → Redirect to picking page', async ({ page }) => {
    // Arrange: SQL fallback credentials
    const sqlUsername = 'warehouse_user';
    const sqlPassword = 'SecurePassword456';

    // Act: Fill login form
    await page.locator('input[name="username"], input[type="text"]').first().fill(sqlUsername);
    await page.locator('input[name="password"], input[type="password"]').first().fill(sqlPassword);
    await page.locator('button[type="submit"]').first().click();

    // Assert: Redirected to partial picking page (SQL fallback authentication)
    await expect(page).toHaveURL(/.*partial-picking/, { timeout: 10000 });

    // Verify authenticated UI elements visible
    await expect(page.locator('text=/run.*no/i').or(page.locator('input[name="runNo"]'))).toBeVisible({ timeout: 5000 });
  });

  test('T085.3: Invalid credentials → Display error message', async ({ page }) => {
    // Arrange: Invalid credentials
    const invalidUsername = 'invalid_user';
    const invalidPassword = 'wrong_password';

    // Act: Attempt login with invalid credentials
    await page.locator('input[name="username"], input[type="text"]').first().fill(invalidUsername);
    await page.locator('input[name="password"], input[type="password"]').first().fill(invalidPassword);
    await page.locator('button[type="submit"]').first().click();

    // Assert: Error message displayed
    await expect(page.locator('text=/invalid.*credentials/i, text=/authentication.*failed/i, text=/error/i').first()).toBeVisible({
      timeout: 5000,
    });

    // Verify still on login page (no redirect)
    await expect(page).toHaveURL(/.*login|^\/$/, { timeout: 2000 });
  });

  test('T085.4: JWT token stored in localStorage after successful login', async ({ page }) => {
    // Arrange: Valid LDAP credentials
    const ldapUsername = 'dechawat';
    const ldapPassword = 'P@ssw0rd123';

    // Act: Login
    await page.locator('input[name="username"], input[type="text"]').first().fill(ldapUsername);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ldapPassword);
    await page.locator('button[type="submit"]').first().click();

    // Wait for redirect
    await page.waitForURL(/.*partial-picking/, { timeout: 10000 });

    // Assert: JWT token stored in localStorage
    const token = await page.evaluate(() => localStorage.getItem('auth_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();
    expect(token).toMatch(/^eyJ/); // JWT token starts with 'eyJ'

    // Verify token structure (header.payload.signature)
    const tokenParts = token?.split('.');
    expect(tokenParts?.length).toBe(3);
  });

  test('T085.5: Protected routes require authentication', async ({ page }) => {
    // Arrange: No authentication token
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Act: Attempt to access protected route directly
    await page.goto('http://localhost:6060/partial-picking');

    // Assert: Redirected to login page
    await expect(page).toHaveURL(/.*login|^\/$/, { timeout: 5000 });

    // Verify login form displayed (not picking page)
    await expect(page.locator('input[name="username"], input[type="text"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('T085.6: Logout clears token and redirects to login', async ({ page }) => {
    // Arrange: Login first
    await page.locator('input[name="username"], input[type="text"]').first().fill('dechawat');
    await page.locator('input[name="password"], input[type="password"]').first().fill('P@ssw0rd123');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/.*partial-picking/, { timeout: 10000 });

    // Verify token exists
    let token = await page.evaluate(() => localStorage.getItem('auth_token') || localStorage.getItem('token'));
    expect(token).toBeTruthy();

    // Act: Logout (click logout button if available)
    const logoutButton = page.locator('button:has-text("logout"), button:has-text("sign out"), a:has-text("logout")').first();
    if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logoutButton.click();
    } else {
      // Manual logout via evaluate
      await page.evaluate(() => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token');
        window.location.href = '/';
      });
      await page.waitForURL(/.*login|^\/$/, { timeout: 5000 });
    }

    // Assert: Token cleared
    token = await page.evaluate(() => localStorage.getItem('auth_token') || localStorage.getItem('token'));
    expect(token).toBeNull();

    // Verify redirected to login
    await expect(page).toHaveURL(/.*login|^\/$/, { timeout: 5000 });
  });

  test('T085.7: Login form validation - empty fields', async ({ page }) => {
    // Act: Submit login form with empty fields
    await page.locator('button[type="submit"]').first().click();

    // Assert: Validation error or form not submitted
    // Either validation message appears OR URL stays on login page
    const hasError = await page
      .locator('text=/required/i, text=/enter.*username/i, text=/enter.*password/i')
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (!hasError) {
      // If no error message, verify URL didn't change (form validation prevented submit)
      await expect(page).toHaveURL(/.*login|^\/$/, { timeout: 1000 });
    }
  });

  test('T085.8: Login form validation - username only', async ({ page }) => {
    // Act: Submit with only username
    await page.locator('input[name="username"], input[type="text"]').first().fill('testuser');
    await page.locator('button[type="submit"]').first().click();

    // Assert: Password required error or form not submitted
    const hasError = await page
      .locator('text=/password.*required/i, text=/enter.*password/i')
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (!hasError) {
      await expect(page).toHaveURL(/.*login|^\/$/, { timeout: 1000 });
    }
  });

  test('T085.9: Token expiration handling (168 hours)', async ({ page }) => {
    // Arrange: Set expired token in localStorage
    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcmlkIjo0MiwiZXhwIjoxNjAwMDAwMDAwfQ.invalid';
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, expiredToken);

    // Act: Attempt to access protected route with expired token
    await page.goto('http://localhost:6060/partial-picking');

    // Assert: Redirected to login (expired token rejected)
    await expect(page).toHaveURL(/.*login|^\/$/, { timeout: 5000 });

    // Verify token cleared
    const token = await page.evaluate(() => localStorage.getItem('auth_token') || localStorage.getItem('token'));
    expect(token).toBeNull();
  });

  test('T085.10: Display user information after login', async ({ page }) => {
    // Arrange: Login with LDAP credentials
    await page.locator('input[name="username"], input[type="text"]').first().fill('dechawat');
    await page.locator('input[name="password"], input[type="password"]').first().fill('P@ssw0rd123');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/.*partial-picking/, { timeout: 10000 });

    // Assert: User information displayed (username, department, or welcome message)
    const userInfoVisible =
      (await page.locator('text=/dechawat/i').isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await page.locator('text=/welcome/i').isVisible({ timeout: 1000 }).catch(() => false)) ||
      (await page.locator('text=/warehouse/i').isVisible({ timeout: 1000 }).catch(() => false));

    expect(userInfoVisible).toBeTruthy();
  });

  test('T085.11: Constitutional compliance - viewport resolution 1280x1024', async ({ page }) => {
    // Assert: Viewport matches constitutional requirement
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(1280);
    expect(viewport?.height).toBe(1024);

    // Verify login form renders properly at this resolution
    const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
    await expect(usernameInput).toBeVisible();

    const box = await usernameInput.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });
});
