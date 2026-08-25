# Identity and verification

Call `check_verification_status` when KYC or badges affect a task. Its `markets`
describe provider-agnostic readiness by country and may include route direction
and supported instruments. They are not amount-specific live quotes; use
quote-book tools and `estimate_payment` for executable corridors.

If KYC is missing:

1. Call `do_kyc`.
2. Continue immediately for `already_verified`.
3. If it returns `kyc_url`, show the Didit URL and ask the human to complete it.
4. Call `check_verification_status` again before retrying a gated action.

Never ask the human to paste identity proofs into chat. The agent can start a
KYC session but cannot complete it.

If `create_payment` returns `need_review` with `reason=rail_not_ready`, no
payment was created and no funds moved. Show the returned readiness state. Wait
until the market is `APPROVED`, then retry with the same request ID; refresh
and reconfirm if the quote expired.

Payment World ID approval is a separate per-payment action returned by
`create_payment`. Do not substitute a badge check.

AgentKit wallet verification is also separate:

1. Call `verify_agent_kit` without wallet IDs or addresses.
2. Show the returned hosted `verification_url` unchanged and ask the human to
   open or scan it in World App.
3. After completion, call `verify_agent_kit` again through pending or
   registering states until it returns `status=verified`.

Do not rewrite or reconstruct the verification URL, run the AgentKit CLI
manually, or request a World ID proof.
