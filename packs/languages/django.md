# Pack: Django

**Runner** pytest with pytest-django, or `manage.py test`.
**Tests** `tests/` per app; use `pytest.mark.django_db` for database access.

## Review focus

**ORM performance.** N plus one from accessing a related object in a loop is the
dominant Django defect - `select_related` for forward FK and one-to-one,
`prefetch_related` for reverse and many-to-many. `.count()` on an already-evaluated
queryset re-queries; use `len()` there. `.exists()` beats truthiness on a large set.
A queryset is lazy and cached once evaluated - slicing after evaluation re-queries.

**Migrations.** A migration that adds a non-null column without a default breaks running
old code during deploy. Data migrations belong in `RunPython` with a reverse. Renaming a
field is two deploys, not one. Always check `makemigrations --check` in CI.

**Security.** `raw()` and `extra()` with string interpolation is SQL injection - use
parameters. `mark_safe` on user content is XSS. `DEBUG = True` in production leaks the
settings and stack traces. Object-level permission checks are not implied by
`LoginRequiredMixin` - a detail view fetching by pk without an ownership filter is the
classic IDOR.

**Settings.** Secrets from environment, never committed. `ALLOWED_HOSTS` set.
`SECRET_KEY` rotated out of the repo.

**Signals.** They hide control flow and fire in unexpected contexts (fixtures, bulk
operations skip them entirely). Prefer explicit calls; `bulk_create` does not send
`post_save`.

**Transactions.** `select_for_update` needs a transaction to do anything.
`transaction.on_commit` for side effects that must not fire on rollback.

**DRF.** Serializer validation belongs in `validate_<field>` / `validate`. Check
permission classes on every viewset - a missing one defaults to open.
