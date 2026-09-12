# Pack: Ruby / Rails

**Runner** RSpec (most common) or Minitest.
**Coverage** SimpleCov.
**Detecting it** `Gemfile`, `config/application.rb` for Rails.

## Review focus

**N+1 queries.** The dominant Rails defect. `includes`/`preload`/`eager_load` for
associations touched in a loop or a view. `bullet` in development catches them; its
absence in a mature codebase is itself worth noting.

**Strong parameters.** `params.require(:model).permit(...)` — a `permit!` anywhere is
mass assignment, letting a request set any attribute including `admin`.

**Callbacks.** `before_save`/`after_commit` chains hide control flow and fire in contexts
people forget — `update_column` and `insert_all` skip them entirely. Deep callback chains
are the Rails equivalent of action at a distance.

**Migrations.** `change` must be reversible or define `up`/`down`. Adding an index on a
large table needs `algorithm: :concurrently` with `disable_ddl_transaction!`. A migration
that references a model class breaks when that class later changes — use raw SQL or a
local stub.

**Security.** `html_safe` and `raw` on user content are XSS. String interpolation into
`where` is SQL injection — use the array or hash form. `send` with a user-supplied method
name is remote code execution.

**Scopes and defaults.** `default_scope` is regretted almost universally; it applies
everywhere including associations and is hard to escape.
