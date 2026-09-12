# Pack: Vue / Nuxt

**Runner** vitest with @vue/test-utils or Testing Library.
**Tests** beside source or in `tests/` - follow the repo.

## Review focus

**Reactivity.** `ref` for primitives, `reactive` for objects. Destructuring a `reactive`
object loses reactivity - use `toRefs`. Replacing a `reactive` object wholesale breaks
the binding; mutate it or use a `ref`. Forgetting `.value` on a `ref` in script is the
most common Vue mistake and often silently does nothing.

**Computed vs watch.** Derived values belong in `computed` - it caches and is
declarative. A `watch` that sets other state is usually a `computed` written the hard
way. A `computed` with a side effect is a defect.

**Watchers.** `watch` is lazy, `watchEffect` runs immediately and tracks automatically.
Deep watching a large object is expensive. Stop watchers created outside `setup` or they
leak.

**Props and events.** Props are one-way - mutating a prop breaks the contract. Emit an
event instead. Define props with types and validators.

**Keys.** `v-for` needs a stable `:key` from the data; index keys corrupt state on
reorder. Never `v-if` and `v-for` on the same element - precedence differs between Vue 2
and 3 and the intent is unclear either way.

**Lifecycle.** Clean up intervals, listeners and subscriptions in `onUnmounted`.

**Template security.** `v-html` with user content is XSS.

**Nuxt.** Server-only code must not leak into the client bundle - check `useAsyncData`
and `useFetch` key stability, and that private runtime config is never referenced
client-side.
