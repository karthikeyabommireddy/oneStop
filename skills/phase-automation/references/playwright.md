# Reference - Playwright, fixture-composed page objects

The bound default for web automation. This is the worked skeleton; the rules behind it
are in `${CLAUDE_PLUGIN_ROOT}/registry/patterns.json` -> `automation_patterns.web`.

## Why this and not classic POM

Classic POM came from Selenium, where the framework gave you nothing: no waiting, no
isolation, no dependency injection. `BasePage` existed to hold the waits and the helpers
every page needed.

Playwright supplies all of that. What survives is the page object - a named home for one
screen's locators and intents. What does not survive is the inheritance tree:

- **`BasePage` becomes a god-object.** Every helper any page ever needed accumulates
  there, every page inherits all of it, and every spec transitively depends on the whole
  surface. Changing one helper risks every suite.
- **Constructing page objects in `beforeEach` re-implements fixtures badly** - without
  typing, without per-test teardown, and without the lazy instantiation that means a spec
  only builds the objects it actually asks for.

Fixtures give setup, teardown, typed injection and parallel-safe isolation for free.
Compose; do not inherit.

## Directory structure

```
tests/e2e/
  playwright.config.ts
  tests/                     specs only - no selectors, no waits, no plumbing
    checkout.spec.ts
    login.spec.ts
  pages/                     one object per screen area
    login.page.ts
    checkout.page.ts
  fixtures/
    test.ts                  test.extend - the single import every spec uses
  data/                      builders and factories
    user.ts
  support/
    auth.setup.ts            storageState, run once
    api.ts                   seeding through the API, not the UI
```

## The fixture file

The one import every spec uses. Page objects are declared here and instantiated lazily.

```ts
// fixtures/test.ts
import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { CheckoutPage } from '../pages/checkout.page';
import { seedOrder } from '../support/api';

type Fixtures = {
  loginPage: LoginPage;
  checkoutPage: CheckoutPage;
  seededOrder: { id: string };
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
  // Setup before use(), teardown after. The test never sees either.
  seededOrder: async ({ request }, use) => {
    const order = await seedOrder(request);
    await use(order);
    await request.delete(`/api/orders/${order.id}`);
  },
});

export { expect } from '@playwright/test';
```

## A page object

Exposes `Locator`s and intent methods. **It never asserts.**

```ts
// pages/login.page.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    // Role and label first. These survive a restyle; a CSS class does not.
    this.email    = page.getByLabel('Email');
    this.password = page.getByLabel('Password');
    this.submit   = page.getByRole('button', { name: 'Sign in' });
    this.error    = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async signIn(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
```

Why no assertions in here: when `expect` lives in the spec, a failure message names the
behaviour that broke. When it lives in the page object, every failure points at the same
helper and you have to read the suite to learn what was actually being checked.

## A spec

Reads as the journey. No selectors, no waits, no setup.

```ts
// tests/login.spec.ts
import { test, expect } from '../fixtures/test';

test('rejects a wrong password without revealing whether the account exists', async ({ loginPage }) => {
  await loginPage.goto();
  await loginPage.signIn('known@example.com', 'wrong-password');

  // Web-first assertion: retries until it passes or times out.
  await expect(loginPage.error).toHaveText('Email or password is incorrect');
});
```

## The config

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,   // flake must surface locally
  reporter: process.env.CI ? [['html'], ['github']] : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Authenticate once

Driving the login form in every spec is slow and makes every test a login test - so one
UI failure reddens the whole suite and tells you nothing about which feature broke.

```ts
// support/auth.setup.ts
import { test as setup } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

setup('authenticate', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.signIn(process.env.E2E_USER!, process.env.E2E_PASSWORD!);
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: '.auth/user.json' });
});
```

Credentials come from the environment with a `.env.example` entry. **Never hardcode a
credential in a spec**, and never commit `.auth/`.

Keep exactly one spec that exercises login through the UI - that flow still needs
coverage. Every other spec starts authenticated.

## Locator priority

| Priority | Use | Why |
|---|---|---|
| 1 | `getByRole('button', { name: 'Save' })` | survives restyling; fails when accessibility breaks, which is a bug worth catching |
| 2 | `getByLabel` / `getByPlaceholder` | ties the test to the visible contract |
| 3 | `getByTestId` | when nothing semantic identifies it - add the attribute rather than reaching for CSS |
| 4 | CSS | last resort, and only on a stable hand-authored class |
| never | XPath, `nth-child`, build-generated classes | see below |

**Build-generated classes are the trap that looks like a working selector.** An Angular
`ng-tns-c569083082-0` scope class, a CSS-module hash, a Tailwind JIT artefact - each is
regenerated on essentially every build. A spec using one passes on your machine and
breaks silently on the next deploy, and the failure looks like a product bug.

## The four flake sources, and the fix

| Symptom | Cause | Fix |
|---|---|---|
| passes locally, fails in CI | `expect(await locator.textContent())` - samples once | `await expect(locator).toHaveText()` - retries |
| passes, then fails, then passes | `page.waitForTimeout(2000)` | wait on the condition: a locator state, a response, a URL |
| green suite, broken feature | `if (await el.isVisible()) { ... }` - two outcomes, neither asserted | assert the expected state unconditionally |
| one failure reddens five specs | shared state between specs | seed per test through a fixture; tear down in the same fixture |

## Checklist before handoff

- [ ] Every spec reads as the journey - no selector, no wait, no `beforeEach` plumbing
- [ ] No `BasePage`; page objects hold collaborators rather than extending one
- [ ] No assertion inside a page object
- [ ] No `waitForTimeout`, no conditional assertion, no `test.only`
- [ ] Locators at priority 1-3; no build-generated class anywhere
- [ ] Auth via `storageState`; exactly one spec covers the login UI
- [ ] Data seeded through the API, torn down by the fixture that created it
- [ ] CI runs on pull requests and uploads trace, screenshot and video on failure
- [ ] The suite was actually executed here, and the result is reported honestly
