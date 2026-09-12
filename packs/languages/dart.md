# Pack: Dart / Flutter

**Runner** `flutter test`; integration via `flutter test integration_test/`.
**Coverage** `flutter test --coverage`
**Tests** `test/` mirroring `lib/`; widget tests with `testWidgets`.

## Review focus

**Null safety.** `!` asserts non-null and throws when wrong. `late` defers the check to
first access, which moves a compile error to a runtime crash - use it only when
initialisation genuinely cannot happen in the constructor.

**Widget lifecycle.** Dispose every controller, `AnimationController`, `StreamSubscription`
and `FocusNode` in `dispose()` - the most common Flutter leak. Never call `setState`
after the widget is unmounted; check `mounted` after an await.

**Build method.** Must be pure and cheap - it runs on every frame that rebuilds. No I/O,
no allocation of expensive objects, no side effects. Use `const` constructors wherever
possible; they let Flutter skip rebuilding entire subtrees.

**Keys.** Needed when reordering or conditionally swapping widgets of the same type,
otherwise state attaches to the wrong element.

**Async.** An `await` across a `BuildContext` use is unsafe - the widget may be gone.
Capture what you need before awaiting, and check `mounted` after. `Future` errors that
are never awaited surface as unhandled.

**Layout.** Unbounded constraints inside a `Column` or `ListView` throw at runtime -
`Expanded`, `Flexible` or an explicit size resolves it.

**State management.** Whatever the project uses, the rule is the same: one source of
truth, and UI derives from it. Two places holding the same state will drift.

**Accessibility.** Wrap meaningful widgets in `Semantics`; verify with the large font
scale.
