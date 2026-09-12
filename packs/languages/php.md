# Pack: PHP / Laravel

**Runner** PHPUnit or Pest.
**Coverage** `phpunit --coverage-text`
**Tests** `tests/Unit` and `tests/Feature`.

## Review focus

**Types.** Declare `strict_types=1`. Type every parameter, return and property - PHP
coerces silently otherwise, and `"1abc" == 1` is the kind of surprise that follows.
Use `===` always.

**Eloquent N plus one.** Accessing a relation inside a loop without `with()` is the
standard Laravel performance defect. Enable `preventLazyLoading` in development.
`chunk` or `cursor` for large result sets - `all()` loads everything into memory.

**Mass assignment.** `$fillable` or `$guarded` must be deliberate. `Model::create($request->all())`
with a permissive `$guarded` lets a user set any column, including a role or an id.

**Query safety.** `DB::raw` and `whereRaw` with interpolated input is SQL injection -
bind parameters.

**Authorization.** A route protected by authentication is not protected by authorization.
Every action on a specific record needs a policy check. Route-model binding fetches the
record but does not check ownership.

**Output.** Blade `{{ }}` escapes; `{!! !!}` does not and is XSS with user content.

**Validation.** At the boundary, via a Form Request, before the data reaches a model.

**N+1 of a different kind.** Queueing a job per item inside a loop, or firing an event
per row, scales badly - batch instead.

**Config.** `env()` outside config files returns null once config is cached. Secrets in
`.env`, never committed.
