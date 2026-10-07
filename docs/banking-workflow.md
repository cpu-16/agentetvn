# Banking drafts from public evidence

The event panel retains its editorial package and adds a Banking mode. The banking draft is deterministic and extractive: at most 250 words across the whole bulletin, cited facts, separately marked hypotheses, sectors and horizon to verify, missing evidence and exactly three analyst questions. It uses the existing public evidence core. Historical indicators retain their year and unit; incompatible publication versions appear together. Untrusted sources and citations belonging to another event are rejected.

Banking drafts, generation cache identities and review histories use separate services and tables. Banking edits and review decisions never replace an editorial package or editorial review. No publication or banking transaction is implemented.

## Review and durable records

A signed-in reviewer starts review, reads the citations, saves any edits and explicitly confirms the exact current draft before approving it as a draft. The server requires the current draft version and review ID. Approval stores the exact saved JSON, SHA-256, source snapshot, draft version, actor and timestamp. A stale edit or decision returns 409. Retrying the same durable decision returns its original acknowledgement without inserting another decision.

An edit or regeneration advances the version monotonically, invalidating the previous current approval while retaining its original content in history. A snapshot mismatch invalidates the saved draft and resets current review. Concurrent generation shares only the banking promise; a later human edition wins over an older generation. The interface cancels requests on case changes and checks for unmount before applying responses.

## Validation and rollout limits

Development tests exercise the service and actual Request/Response route handlers against disposable SQLite: cited contract, incompatible figures, historical context, abstention, unsupported titles, unrelated/untrusted citations, malformed bodies, session requirements, editorial preservation, exact approval receipts, retry idempotency, concurrent edits, stale versions and snapshot mismatch. Automation actors are explicitly labeled as local tests. These checks provide structural and numerical citation validation, not independent semantic correctness or human gold labels. No live browser interaction or human banking acceptance is claimed.

The additive SQL in prisma/migrations/20261007030000_banking_briefs creates only the two banking tables and their indexes; an in-memory SQLite regression proves existing editorial sentinel rows survive. It has not been applied to a user database. The repository has no original migration baseline, so deploying migrations requires a separately reviewed baseline and backup plan. Do not run the existing data-loss database command as part of these checks.

This draft PR is stacked on test/challenge-acceptance. Review the testing PR first; do not merge or deploy either branch without the agreed human review. Optional tracing retains the testing branch's explicit gates and technical-only transport. No model calls, cloud traces or reserved evaluation runs are required for banking tests.

## Explicit public trace connection helper

scripts/trace-public-dev.ts is a one-shot CU-01 agenda check, requiring the explicit --approved-public-dev argument and approval for external disclosure. It keeps model paths disabled and sends only technical enums/counts and the public snapshot hash. Questions, source text and generated prose are not uploaded. It reads back the same completed run and checks the persisted payload before reporting a URL. Ordinary application tracing stays disabled by its existing gates.

The local helper has not been run against LangSmith. Live connection verification remains pending external-disclosure approval; no cloud success is inferred from mocked SDK tests.
