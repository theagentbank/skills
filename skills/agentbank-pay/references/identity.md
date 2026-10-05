## 2. Handle identity requirements

Use `check_verification_status` when KYC or badges matter. Its `markets` result is provider-agnostic
KYC readiness by country, not live corridor availability; use the quote-book tools for live pairs and rates.

If KYC is missing:

1. Call `do_kyc`.
2. If it returns `already_verified`, continue.
3. If it returns `kyc_url`, show the URL to the human.
4. Ask the human to complete identity verification ("tap to verify your identity").
5. Call `check_verification_status` again before retrying a gated action.

If `create_payment` returns `status=need_review` with `reason=rail_not_ready`, no payment was created
and no funds moved. Show its KYC state, badges, and `markets` readiness. Wait until the market is
`APPROVED`, then retry `create_payment` with the same `request_id`; refresh and reconfirm if the quote
has expired. Do not call `continue_payment`, create a replacement payment, or ask for payment approval
while the rail is not ready.

Use `get_verification_guidance` for first-party profile or identity badge guidance. Never ask the human
to paste identity proofs into chat.

Payment approval is a separate per-payment action returned by `create_payment`.
Do not replace it with a badge check.

AgentKit wallet verification is separate from AgentBank KYC, WORLDID badges, and
payment approval. When requested:

1. Call `verify_agent_kit` without wallet IDs or addresses.
2. Show `verification_url` and ask the human to open or scan it in World App.
3. After the human finishes, call `verify_agent_kit` again until it returns
   `status=verified`.

Do not run the AgentKit CLI manually or request an identity proof. The tool uses
the pinned official verification flow, refreshes Core, and does not move funds.

