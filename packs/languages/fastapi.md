# Pack: FastAPI

**Runner** pytest with `httpx.AsyncClient` or `TestClient`.

## Review focus

**Async correctness.** A blocking call inside an `async def` endpoint stalls the entire
event loop - a synchronous database driver, `requests`, `time.sleep`, or heavy CPU work.
Either use an async driver or declare the endpoint `def` so FastAPI runs it in a
threadpool. This is the single most damaging FastAPI mistake.

**Dependencies.** `Depends` results are cached per request by default. A dependency with
`yield` runs cleanup after the response - exceptions in the cleanup are easy to lose.
Do not open a database session at module scope; it will not survive.

**Pydantic models.** Separate the request model, the response model and the database
model. A database model returned directly leaks fields - use `response_model` so the
serialisation is explicit and hashed passwords or internal flags cannot escape.

**Validation.** Pydantic validates shape, not business rules - authorisation and
ownership checks are yours. A path parameter accepted as an id and used without an
ownership check is the classic IDOR.

**Status codes and errors.** Declare them. `HTTPException` with a meaningful detail, and
a consistent error shape across the API. A handler returning 200 with an error body is
a contract defect.

**OpenAPI.** The generated schema is the contract - check that it matches what clients
are told. Undocumented error responses are undocumented behavior.

**Background tasks.** `BackgroundTasks` runs in the same process and dies with it - not
a substitute for a real queue for anything that must not be lost.
