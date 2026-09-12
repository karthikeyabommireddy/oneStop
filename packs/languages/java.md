# Pack: Java

**Runner** JUnit 5, via `mvn test` or `gradle test`.
**Coverage** JaCoCo.
**Tests** `src/test/java`, mirroring the main package structure.

## Review focus

**Null.** The dominant defect source. Prefer `Optional` for return values that may be
absent - but never as a field or a parameter. Validate constructor and method arguments
at the boundary. `Objects.requireNonNull` documents intent and fails fast.

**Equals and hashCode.** Always together, always consistent, and both stable for any
object used as a map key. A mutable key whose hash changes after insertion is lost in
the map.

**Resources.** try-with-resources for anything `AutoCloseable`. A manual `close()` in a
`finally` leaks when the close itself throws.

**Collections.** `Arrays.asList` is fixed-size. Returning an internal mutable collection
leaks the object state - return a copy or an unmodifiable view. Modifying a collection
while iterating throws.

**Concurrency.** `synchronized` on the wrong object protects nothing. Prefer
`java.util.concurrent` over hand-rolled locking. `volatile` gives visibility, not
atomicity. Double-checked locking without `volatile` is broken.

**Streams.** A stream is consumed once. Side effects inside a stream operation are a
smell. `parallelStream` on a small or IO-bound workload is usually slower.

**Persistence (JPA/Hibernate).** Lazy loading outside a transaction throws. N plus one
from lazy relations in a loop is the standard performance defect - fetch joins fix it.
`@Transactional` on a private or self-invoked method does nothing.
