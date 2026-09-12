# Reference - Native and cross-platform app automation

Worked skeletons for the app targets. Rules and selection data:
`${CLAUDE_PLUGIN_ROOT}/registry/patterns.json` -> `automation_patterns.app`.

The shared idea across all of them is the same one the web reference uses: **a named
layer holds the addressing, the test body holds the intent.** Only the vocabulary
differs - page object, screen object, robot.

---

## Detox (React Native) - robot pattern

```
e2e/
  screens/         one robot per screen
    login.robot.ts
    dashboard.robot.ts
  flows/           journeys composed from robots
    sign-in.e2e.ts
  data/            API seeding, run before the app launches
```

A robot returns the robot for the screen it navigates to, so a flow reads as a chain of
user intentions:

```ts
// screens/login.robot.ts
import { element, by, waitFor } from 'detox';
import { DashboardRobot } from './dashboard.robot';

export class LoginRobot {
  async signIn(email: string, password: string) {
    await element(by.id('login-email')).typeText(email);
    await element(by.id('login-password')).typeText(password);
    await element(by.id('login-submit')).tap();
    return new DashboardRobot();
  }

  async expectVisible() {
    // Detox's synchronisation already knows about the bridge and animations.
    await waitFor(element(by.id('login-screen'))).toBeVisible().withTimeout(5000);
  }
}
```

```ts
// flows/sign-in.e2e.ts
describe('sign in', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });   // known state per journey
  });

  it('lands on the dashboard with the user name shown', async () => {
    const login = new LoginRobot();
    await login.expectVisible();
    const dashboard = await login.signIn(process.env.E2E_USER!, process.env.E2E_PASSWORD!);
    await dashboard.expectGreeting('Priya');
  });
});
```

**Match on `testID` only.** Text matching breaks the first time the app is localised, and
it breaks silently on a copy change - the test fails and the failure looks like a product
bug.

---

## Maestro - composed YAML flows

Maestro's value is that a flow stays readable by someone who does not write test code.
Deep abstraction destroys that; zero abstraction copies login into every file. One
subflow for setup, one flow per journey.

```yaml
# .maestro/sign-in.yaml
appId: com.example.app
env:
  BASE_ENV: staging
---
- runFlow: subflows/launch-clean.yaml
- tapOn:
    id: "login-email"
- inputText: "${E2E_USER}"
- tapOn:
    id: "login-password"
- inputText: "${E2E_PASSWORD}"
- tapOn:
    id: "login-submit"
- assertVisible:
    id: "dashboard-greeting"
```

A flow that only taps proves navigation, not behaviour - every flow ends in an explicit
`assertVisible` or `assertNotVisible`.

---

## Espresso (Android) - robot pattern

The canonical Android structure, precisely because matchers are verbose enough that
inlining them makes a test unreadable within a month.

```kotlin
class LoginRobot {
    fun signIn(email: String, password: String): DashboardRobot {
        onView(withId(R.id.login_email)).perform(typeText(email))
        onView(withId(R.id.login_password)).perform(typeText(password), closeSoftKeyboard())
        onView(withId(R.id.login_submit)).perform(click())
        return DashboardRobot()
    }
}

@Test fun signInLandsOnDashboard() {
    LoginRobot()
        .signIn(BuildConfig.E2E_USER, BuildConfig.E2E_PASSWORD)
        .assertGreetingVisible()
}
```

`IdlingResource` for async work - never `Thread.sleep`. Swap real dependencies for fakes
with Hilt test modules rather than testing against live services.

---

## XCUITest (iOS) - screen objects

```swift
struct LoginScreen {
    let app: XCUIApplication
    var email:  XCUIElement { app.textFields["login-email"] }
    var submit: XCUIElement { app.buttons["login-submit"] }

    func signIn(_ email: String, _ password: String) -> DashboardScreen {
        self.email.tap(); self.email.typeText(email)
        // ...
        submit.tap()
        return DashboardScreen(app: app)
    }
}
```

Query by `accessibilityIdentifier` - never by localised label, never by index.
`waitForExistence` for synchronisation, never `sleep()`. Select fixture state with launch
arguments so each test starts known without driving the UI to get there.

---

## Appium - only when it earns it

Bind Appium **only** when one suite must cover both platforms from shared code *and* a
real-device cloud grid is a requirement. Otherwise the per-platform native framework is
faster and less flaky, and that difference compounds over a suite's life.

One screen object per screen with a per-platform locator map, so the journey is written
once and only the addressing differs. W3C actions for gestures - never coordinate taps,
which break on every new device size.

---

## Flutter integration_test

Address by `Key` / `find.byKey`, never by widget type or text. `await
tester.pumpAndSettle()` for settlement, never a raw `Future.delayed`. Objects wrap
`WidgetTester` and expose intent methods; assertions stay in the test.

---

## Coverage on app targets

A happy path alone is a demo. The platform boundaries are where app bugs actually live,
and each of these is a case:

- **Permissions** - granted, denied, and denied-then-granted-in-settings.
- **Lifecycle** - cold start versus warm resume; state after backgrounding.
- **Connectivity** - offline, and recovery when it returns.
- **Navigation** - hardware back on Android; deep link into a screen mid-stack.
- **Form factor** - smallest supported screen, and the largest text size setting.

## Checklist before handoff

- [ ] Every matcher lives in a robot or screen object, never in a test body
- [ ] `testID` / `accessibilityIdentifier` addressing only - no text, no index
- [ ] No fixed sleep anywhere; framework synchronisation only
- [ ] Known state per journey - relaunch or reset, never carried over
- [ ] Platform boundaries covered, not just the happy path
- [ ] Credentials from the environment, with a `.env.example` entry
- [ ] CI runs it and uploads device logs, screenshots and video on failure
- [ ] The suite was actually executed here - if no simulator or device was available, say
      so plainly rather than reporting a pass that did not happen
