# Pack: Svelte / SvelteKit

Load alongside the `typescript` pack.

**Runner** Vitest with `@testing-library/svelte`.
**Detecting it** `svelte` in the manifest, `svelte.config.js`, or `X-Sveltekit-Page` on
a live response.

## Review focus

**Runes vs stores.** Svelte 5 introduced `$state`, `$derived`, `$effect`; Svelte 4 used
`let` + `$:` + stores. Mixing them in one codebase is the current common defect —
establish which the project targets before touching reactive code. `$:` reactive
statements do not exist in runes mode.

**`$effect` is not a general callback.** Writing state inside an effect that reads the
same state loops. Derived values belong in `$derived`, not an effect that assigns.

**Server/client boundary (SvelteKit).** `+page.server.ts` runs server-only; anything it
imports stays server-side. A secret imported into `+page.ts` (universal) reaches the
browser. Check the import graph, not just the file.

**Form actions.** SvelteKit's default CSRF protection checks `Origin` on non-GET
requests with a browser-form content-type. A JSON POST to a form action is rejected —
which surprises people writing API clients against a SvelteKit app.

**Stores.** A store subscribed with `$store` auto-unsubscribes; a manual `.subscribe()`
in a component does not. `derived` with an async callback needs the `set` form.

**`{#each}` needs a key** (`{#each items as item (item.id)}`) for correct DOM reuse.
