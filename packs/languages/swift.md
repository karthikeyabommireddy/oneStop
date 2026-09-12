# Pack: Swift

**Runner** XCTest or swift-testing, via `xcodebuild test` or `swift test`.
**Coverage** `xcodebuild test -enableCodeCoverage YES`
**Tests** a test target; UI tests in a separate UI testing bundle.

## Review focus

**Optionals.** Force unwrap (`!`) is a crash where a condition was merely unlikely. Use
`guard let` for early exit and `if let` for scoped use. Implicitly unwrapped optionals
outside IBOutlets are a hazard.

**Memory.** ARC does not collect cycles. A closure capturing `self` strongly inside a
property that retains the closure is a leak - `[weak self]` in escaping closures, and
`guard let self` inside. Delegates are `weak`. Parent-child references need one side
`weak` or `unowned`.

**Value semantics.** Structs copy; classes reference. A struct containing a class still
shares that class instance after a copy, which is a routine source of surprise.

**Concurrency (Swift 6).** Actor isolation is compiler-enforced. A type crossing an
isolation boundary must be `Sendable`. `@MainActor` for anything touching UI. A
non-isolated `async` function can resume on any executor - never assume the main thread.
`Task` is not cancelled automatically; check `Task.isCancelled` in loops.

**Error handling.** `try?` discards the error - fine only when the failure genuinely
carries no information. `try!` is a crash.

**SwiftUI.** `@State` for value types owned by the view, `@StateObject` to create an
observable object, `@ObservedObject` only for one passed in - creating an
`@ObservedObject` in the view body recreates it on every render. Avoid heavy work in
`body`; it runs often.
