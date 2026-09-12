# Pack: Angular

Load alongside the `typescript` pack.

**Runner** Karma/Jasmine on older projects, Jest or Vitest on newer ones — detect from
`angular.json` and the manifest, never assume.
**E2E** Playwright or Cypress. Protractor is dead; if a project still uses it, migrating
is a finding, not a suggestion.

## Detecting it

`@angular/core` in the manifest, `angular.json` at the root, or `ng-version="..."` on
the rendered `<html>`. The rendered attribute is the reliable one when inspecting a live
app whose source you do not have.

## Selector traps — read this before writing any E2E selector

**Never select on `ng-tns-c*` classes.** Angular emits build-generated scope classes like
`ng-tns-c569083082-0`. The numeric component id is regenerated on essentially every
build, so a selector using one passes locally and breaks silently on the next deploy.
This is the single most expensive Angular automation mistake.

**Never select on `ng-dirty` / `ng-valid` / `ng-touched` / `ng-pristine`.** These are
form *state* classes that change as the user interacts. They are useful to *assert* on;
they are never a stable way to *find* an element. Browser autofill also sets them, which
makes them actively misleading in a fresh-page test.

**Prefer, in order:** `data-testid` (many Angular codebases ship one — check before
adding), a stable `id`, `getByRole` with an accessible name, then a semantic structural
anchor. Angular Material components render deep wrappers, so anchor on the
`mat-*` element or its test id, never on the inner `div` chain.

**Hash routing is common** (`/#/auth/login`). A Playwright `page.goto` to the bare origin
may land on a redirect; assert the resolved route, not the requested one.

## Review focus

**Change detection.** Default change detection re-checks the whole tree; `OnPush` is the
correct default for presentational components. A component doing work in a template
expression or a getter runs that work on every cycle — move it to a signal, a `computed`,
or a pipe.

**Signals vs zone.js.** Modern Angular (16+) supports signals, and 18+ supports zoneless.
Mixing paradigms carelessly is the current common defect: mutating a plain field and
expecting a signal-driven view to update, or calling `markForCheck` in a zoneless app.
Establish which model the project uses before changing reactive code.

**Subscription leaks.** The classic Angular memory leak. Every manual `.subscribe()`
needs teardown — `takeUntilDestroyed()`, `takeUntil(destroy$)`, or an `async` pipe, which
unsubscribes for you and is the preferred answer. A `subscribe` in `ngOnInit` with no
teardown is a finding.

**RxJS.** Nested subscribes should be a flattening operator (`switchMap`, `concatMap`,
`mergeMap`, `exhaustMap`) — and which one matters: `switchMap` cancels in-flight work,
which is right for typeahead and wrong for a save. `shareReplay` without
`refCount: true` leaks a subscription to the source.

**Standalone vs NgModule.** New code should be standalone. Mixing is legal but a module
declaring a standalone component is an error, and the compiler message for it is
famously unhelpful.

**DI.** `providedIn: 'root'` for singletons. A service provided in a component gets a new
instance per component instance — occasionally intended, usually a surprise.

**Templates.** `[innerHTML]` with user content is XSS; Angular sanitises but
`bypassSecurityTrustHtml` defeats it entirely and needs justification at every call site.
`*ngFor` needs `trackBy` on any non-trivial list or the DOM is rebuilt on every change.
