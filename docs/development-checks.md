# Development checks and optional tracing

The development acceptance target is CU-01–CU-05 and T01–T10 from the brief. The existing reserved benchmark cases are not read or run by these checks. Retrieval evaluation remains separate from full-turn generation/validation; full response latency now includes generation.

## Safe commands

Install the locked dependencies, generate the Prisma client, and run:

~~~sh
bun install --frozen-lockfile --ignore-scripts
bun run db:generate
bun run --no-env-file scripts/test-runner.ts
bun run --no-env-file scripts/pruebas.ts
bun run --no-env-file typecheck
bun run --no-env-file build
~~~

The test command gives each invocation a new SQLite file under the OS temporary directory, removes inherited provider credentials, forces offline defaults, and permits only loopback HTTP test doubles. Redirects are rejected, including redirects from loopback doubles. A preload guard refuses direct 'bun test' use with a configured user database. The acceptance runner gives each T-case its own database and exits nonzero on a failed case. Its output defaults to ignored db/pruebas-dev.json; it does not rewrite frozen acceptance evidence. A deliberate failing assertion verifies command exit propagation. Git attributes preserve the four source files covered by snapshot checksums on Windows.

Next reads its own environment files during builds. For credential-free local build verification, use a separate validation checkout without .env files; Bun's no-env-file flag alone does not control Next.

CI runs locked installation, generation, type checking, local tests, acceptance, and a strict production build. It uses no service credentials and runs no ingestion, model download, reserved benchmark, publication, or deployment.

## Optional LangSmith adapter

The server adapter uses langsmith 0.10.8 with custom traceable instrumentation; no LangChain migration or provider-client replacement. Roots cover complete text/voice-tool turns and draft composition; children cover actual retrieval, custom LLM fetch, and validation. Cache hits and the actual retrieval/redaction modes are technical fields, not inferred successes.

All gates are required: online mode, AGENTETVN_TRACING=on, AGENTETVN_TRACE_APPROVED=1, a user-configured API key, and the approved endpoint. Offline mode disables the adapter even if cloud variables are set. Defaults remain off. Inherited replica endpoints are disabled explicitly. The transport adapter strips SDK runtime, events, serialized data, attachments and per-call endpoint overrides. Traces contain allowlisted technical counts, enums and hashes only: no questions, source excerpts, corpus, vectors, output text, identities, prompts, voice transcripts, or raw errors. Missing/invalid commit or snapshot hashes are omitted; prompt-rule/evaluator versions are explicit tags.

Transport errors are sanitized and cannot repeat or fail an application operation. A manual SDK client flush is triggered asynchronously for roots and bounded to 500 ms; explicit flushTracing() is available before CLI exit. Unit tests use a local fake client to check disabled/offline/missing credentials, redaction, error preservation, parentage, network failure and bounded flush. No test sends traces to LangSmith.

User-only secret destination: ignored .env.local, with LANGSMITH_PROJECT=AgenteTVN and LANGSMITH_ENDPOINT=https://api.smith.langchain.com. Enter keys using a local editor. Secret entry alone never enables tracing. Broader public-source trace content requires a separate reviewed policy and approval.

References: [custom instrumentation](https://docs.langchain.com/langsmith/annotate-code), [masking](https://docs.langchain.com/langsmith/mask-inputs-outputs), [evaluation](https://docs.langchain.com/langsmith/evaluate-llm-application).

## Human review evidence

Use the documented brief questions for agenda, historical indicator context, independent provenance, contradiction/abstention and sector signals. Record question, snapshot hash, commit, retrieved citation IDs, result, missing evidence, reviewer, decision, date and reason. Independent topic/event labels and banking correctness review remain pending; automated checks do not supply human gold labels.
