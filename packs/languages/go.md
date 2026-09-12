# Pack: Go

**Runner** `go test ./...`
**Coverage** `go test ./... -cover -coverprofile=coverage.out`
**Tests** beside source as `*_test.go`, table-driven by convention.

## Review focus

**Errors.** Every returned error is checked - an ignored error is the defect Go is most
often criticised for and most often actually bitten by. Wrap with `fmt.Errorf("...: %w",
err)` to preserve the chain, and compare with `errors.Is` / `errors.As`, never by string.

**Nil.** A nil map is readable but panics on write. A nil interface holding a typed nil
pointer is not equal to nil - a genuine and common source of confusion. A nil slice is
fine to append to.

**Defer.** Runs at function exit, not scope exit - `defer` inside a loop accumulates.
Arguments are evaluated immediately, the call is deferred.

**Goroutines.** Every goroutine needs a defined end. A goroutine writing to an unread
channel leaks forever. Pass a `context.Context` for cancellation. A loop variable
captured by a goroutine is shared in Go versions before 1.22.

**Channels.** The sender closes, never the receiver. A send on a closed channel panics.
An unbuffered channel blocks until a receiver is ready.

**Slices.** `append` may or may not reallocate - two slices can share a backing array,
so a write through one is visible through the other. Copy when independence matters.

**Interfaces.** Accept interfaces, return structs. Define the interface where it is
consumed, not where it is implemented.

**Concurrency safety.** Run `go test -race`. A map written from two goroutines without a
lock is a crash, not just a race.
