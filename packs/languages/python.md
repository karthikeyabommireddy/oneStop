# Pack: Python

**Runner** pytest (default), unittest.
**Coverage** `pytest --cov --cov-report=term-missing`
**Tests** `tests/`, named `test_*.py` - follow the repo.

## Review focus

**Mutable default arguments.** `def f(x=[])` shares one list across every call. The
classic Python defect - use `None` and build inside.

**Late binding in closures.** A lambda or comprehension capturing a loop variable sees
its final value. Bind it as a default argument.

**Exceptions.** A bare `except:` catches `KeyboardInterrupt` and `SystemExit`. Catch the
narrowest type that makes sense, and never swallow silently. Re-raise with `raise` to
preserve the traceback, and use `raise ... from e` when wrapping.

**Resources.** Always a context manager for files, sockets, locks and connections. A
manual `close()` leaks on the exception path.

**Type hints.** Hints are not enforced at runtime - validate external input explicitly
(pydantic, dataclasses with checks). `Optional` that is never checked is a latent
`AttributeError` on `None`.

**Comparison and truthiness.** `is` for identity only - never for value comparison of
numbers or strings. A falsy check treats `0`, `""` and `[]` as absent; use
`is not None` when absence is what you mean.

**Concurrency.** The GIL means threads do not parallelise CPU work - use processes.
Async code must never call a blocking function directly; it stalls the whole loop.

**Imports and packaging.** A circular import usually signals a boundary drawn wrong.
Module-level side effects run at import time, which makes testing hard.
