---
name: agentbank-pay
description: Install, onboard, and use AgentBank's MCP for identity, payments, recipients, wallets, tracking, and safe recovery. Use when a user asks to set up AgentBank, onboard a new agent, send or receive money, manage an AgentBank wallet or recipient, or inspect/recover an AgentBank payment.
license: MIT
compatibility: Designed for Codex, Claude Code, and Hermes. Installation requires Node.js 22.20+ and internet access.
metadata:
  author: theagentbank
  version: "1.1.1"
---

<!-- GENERATED from theagentbank/skills. Do not edit this compatibility copy directly. -->

# AgentBank Pay

Use the AgentBank MCP as the authority for onboarding, approvals, routes,
payment instructions, transaction verification, and terminal payment state.
Never replace its tools with direct HTTP requests or locally constructed
protocol payloads.

## Availability gate

Check whether the active client exposes `whoami`, `get_instructions`, and
`begin_agent_onboarding`.

If the tools are loaded, call `whoami` immediately and preserve the user's
original task.

The published MCP package owns the deployed AgentBank endpoint defaults. Do not
add endpoint environment overrides to a normal installation.

If the tools are absent and the user explicitly asked to set up or onboard
AgentBank, configure only the active client. Inspect first and never overwrite
an existing conflicting server.

For Codex:

```bash
codex mcp get agentbank --json
```

Only when that reports the server is missing:

```bash
codex mcp add agentbank -- npx -y agent-bank-mcp@latest
```

For Claude Code, use `claude mcp get agentbank`, then add a missing server with
`claude mcp add --scope user agentbank -- npx -y agent-bank-mcp@latest`.
For Hermes, run `hermes mcp add agentbank --command npx --args -y agent-bank-mcp@latest`,
then `/reload-mcp`.

If an `agentbank` server exists but differs from the documented command, stop
and show the conflict. After configuration, restart the active client once and
repeat: `Onboard a new agent`. Do not attempt onboarding before the tools load.

After installing in Hermes, reload the MCP and preserve the original request
once the tools become available.

For a payment-only request with missing tools, explain the required user-level
MCP configuration and obtain permission before changing it.

Read the "Setup and onboarding" section below when installing, onboarding,
checking account readiness, revoking an installation, or resuming after the
one-time restart.

## Safety invariants

- Never request or expose private keys, seed phrases, AgentBank JWTs, Privy
  tokens, authorization keys, or World ID proofs.
- Never infer recipient fields, wallet addresses, token contracts, chains,
  decimals, amounts, or calldata from weak context.
- Use decimal strings for human amounts and structured asset objects.
- Keep estimates recipient-free. Resolve recipient data only after the human
  elects to create the reviewed route and before `create_payment`.
- Show recipient, send amount, receive amount, every fee and currency, route,
  expiry, and material warnings before creating a payment.
- Set `confirmed_by_user=true` only after the human confirms that complete
  summary. Reconfirm after a material change.
- Use only a current server-generated instruction to move funds.
- A transaction receipt is evidence, not payment completion. Trust
  `get_payment`.
- Reuse a `request_id` only to retry the identical mutation and payload.
- Treat an approval-threshold update as a security-policy change. Call
  `update_payment_approval_policy` only after explicit human confirmation.
- Follow the payment's returned approval status. Never infer World ID behavior
  from a fixed threshold.
- Never expose partner identity or use hidden primitive intent, route,
  approval, settlement, or raw-swap mutations.

## Runtime guidance

At the start of an unfamiliar or resumed workflow, call `get_instructions` with
the relevant journey:

```text
setup
pay
track
recover
manage_recipients
manage_wallets
```

The MCP resources `agentbank://guides/routing` and
`agentbank://instructions/{journey}` are also authoritative. Follow newer
runtime guidance when it does not conflict with the invariants above.


## Detailed workflow references

# Setup and onboarding

## Onboard

As soon as the tools load, call `whoami`.

If it succeeds, call `get_account_status` and continue with the existing
installation.

If it returns `MISSING_CREDENTIAL`:

1. Call `begin_agent_onboarding` once. It creates or resumes the local
   installation and Privy device flow.
2. Show `authorization_url`; explain that opening it once claims the agent and
   grants shared Privy wallet access.
3. Immediately call `wait_for_agent_onboarding` with the returned
   `enrollment_id`. If it times out while pending, call it again with the same
   enrollment ID.
4. Verify `humanfx_claimed`, `privy_authorized`, `wallet_bound`, and
   `authenticated`.
5. Call `whoami`, `check_my_scopes`, `get_account_status`, and `list_wallets`.

Browser approval is the only human onboarding step. Never ask for signing
material, start a second flow while one is pending, or call a legacy
registration alias.

Wallet binding creates the onboarding-bound Privy wallet as the default crypto
recipient. Older installations may be backfilled when `list_recipients` finds
no crypto recipient. The record is scoped to the human owner, so sibling
installations may see it. Match its chain and address against `list_wallets`,
then treat a match as the system-created wallet destination rather than an
unexpected manually saved recipient.

## World ID approval policy

Call `get_payment_approval_policy` when the human asks how this installation's
payment approval threshold is configured. The policy applies only to the
current installation; sibling agents owned by the same human have independent
policies.

`update_payment_approval_policy` changes a security policy. Before calling it:

1. Show the current policy and proposed threshold.
2. Explain that World ID is required when locked USD-stable volume is greater
   than that threshold, while non-USD-stable routes always require World ID.
3. Obtain explicit human confirmation.
4. Pass `world_id_approval_threshold_usd` as a non-negative decimal string.

The value supports at most 18 fractional digits and must not use a negative,
exponent, or invalid leading-zero form. Query the current policy instead of
assuming its default. For every payment, follow the returned
`approval_required` or `approval_ready` status rather than predicting it.

## Revoke

When the human asks to log out or reset:

1. Explain that revocation invalidates this installation, its sessions, and its
   bound wallet authorization, then clears local credentials.
2. Obtain explicit confirmation.
3. Call `revoke_agent({"confirm":true})`.

---

# Identity and verification

Call `check_verification_status` when KYC or badges affect a task. Its markets
describe provider-agnostic KYC readiness by country, not live route
availability; use quote-book tools for live corridors.

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

---

# Payments and tracking

## Understand the request

For an estimate, collect the source asset and chain or fiat currency,
exact-source or exact-destination amount, destination asset/currency and
country, and optional routing preference. Do not request, create, or pass a
recipient merely to estimate a payment. Collect it only after the human elects
to create the reviewed route.

```text
balanced
lowest_total_cost
fastest
highest_success_rate
```

Use `balanced` by default. Do not silently split an amount, switch chains,
change exactness, or change recipients.

Use structured assets:

```json
{ "type": "crypto", "ticker": "USDC", "chain": "worldchain" }
```

```json
{ "type": "fiat", "symbol": "VND" }
```

Use `list_currencies` whenever a code, chain, address, or decimals need
verification.

## Find a live route

Call `list_quote_book_pairs` for live direct on/off-ramp corridors. Route
discovery and estimation do not require a recipient.

For fiat-to-fiat or source-token-to-fiat:

1. Join relevant live on-ramp and off-ramp pairs on one common crypto asset and
   chain.
2. Set `route.intermediate_asset` explicitly in `estimate_payment`.
3. Prefer the requested route; otherwise compare executable outcomes including
   all fees.

There is no automatic route planner. `browse_quote_book` is rough anonymous
discovery; read rate, percentage fee, flat fee, and fee currency together.
`get_ramp_quote` is direct on/off-ramp only.

## Estimate and confirm

Call `estimate_payment` for direct ramps, same-chain crypto swaps, and explicit
two-hop routes. For two hops, pass the intermediate asset. Do not provide
`recipient_id` or `recipient_fields`: estimates are recipient-free route
previews.

Require `status=estimate_ready`. The estimate is ephemeral, has no estimate ID,
and does not create a payment. Read the returned `source_amount`,
`destination_amount`, every leg's fee and currency, expiry, route,
`intermediate_amount`, and returned `hops`. Expect
`next_action.type=review_estimate`; `recipient_validation` is no longer part of
the estimate.

The returned hops contain route data only: `hop_index`, `intent_id`,
`direction`, `source`, and optional `client_quote_id`. Never add
`recipient_fields` or `recipient_ref` to these public hops.

Treat those returned effective amounts as the review truth. For an exact-source
two-hop route, the downstream locked quote may cause the exact-output upstream
leg to report a different `source_amount` from the initially requested
discovery amount. Surface that difference and obtain confirmation for the
returned amount; never silently reuse the original amount.

If the human wants to create the reviewed payment, collect or select the final
recipient now. A pure swap without a recipient uses the onboarding-bound wallet
internally; all other routes require the recipient once in
`create_payment.destination`.

If `estimate_payment` returns `QUOTE_UNAVAILABLE` or
`status=estimate_unavailable`:

1. Call `browse_quote_book` for each matching direct leg; inspect upstream and
   downstream legs separately for a two-hop route.
2. Compare the effective requested amount with each live band's `min_amount`,
   `max_amount`, expiry, `fee_pct`, `flat_fee`, and `fee_ccy`. Raw `rate` alone
   does not prove executability.
3. Explain whether no live band exists, the effective amount falls outside the
   band after fees, or the quote expired. Never invent a customer rate.
4. Call `check_verification_status` only when the response identifies KYC or
   rail readiness as a blocker, or when the human asks. Its `markets` output is
   not live quote readiness.
5. Ask whether to use an in-band amount or another route, then obtain a fresh
   estimate and confirmation after any change.

Show one confirmation:

```text
Recipient: [rail and sufficient destination details]
You send: [amount and asset]
Recipient receives: [amount and asset]
Fees: [each amount and currency]
Route: [direct, swap, or source -> intermediate -> destination]
Estimate expires: [time]
Expected duration: [when available]
Material warnings: [only relevant warnings]
```

After confirmation, call `create_payment` with a new stable request ID,
`confirmed_by_user=true`, the reviewed request, the final recipient once in
`destination.recipient_id` or `destination.recipient_fields` when required,
the top-level intermediate asset for two hops, and the exact current estimate
`hops` unchanged. Do not pass an estimate ID.

For a two-hop route, preserve hop order. The MCP internally injects
`recipient_ref:{"hop_index":1}` into hop 0 and the top-level destination
recipient into hop 1. Do not construct that plumbing yourself.

## Approval and continuation

For `approval_required`, show `approval.approval_url`, explain that the payment
owner signs in before World ID is shown, state expiry, and ask the human to
approve in World App. Never request or reconstruct a raw proof.

Core evaluates this installation's current World ID approval policy against the
locked route. Do not assume a fixed threshold. Non-USD-stable routes always
require World ID. Follow the returned status: for `approval_ready` with
`approval:null`, call `continue_payment` directly; for `approval_required`,
show the approval URL, wait for the human, and poll `get_payment` until ready.

## Follow the instruction exactly

Use `action_url` or `presentation_url` for human-executed fiat funding. Show the
exact amount and expiry, ask the human to pay, and poll `get_payment`. Do not
call `execute_payment_instruction` for fiat funding.

For a direct crypto deposit:

1. Show exact chain, asset, amount, full destination, memo/reference, and
   expiry.
2. Call `get_wallet_balances`.
3. Obtain explicit confirmation.
4. Call `execute_payment_instruction` with the current payment and instruction
   IDs, a stable request ID, and `confirmed_by_user=true`.
5. If pending, retry the identical call with the same request ID.

For `swap_execution`, show the confirmed source ceiling, destination amount,
asset, chain, and recipient, then execute the instruction as above. Never
construct calldata, token addresses, approval targets, or a call order; Core
owns and verifies the pinned plan.

For linked two-hop payments, act only on the first/source hop and then track the
aggregate. Never separately fund hop 1: that duplicates funding.

## Track

Poll `get_payment` according to `next_action.poll_after_seconds`. It is the
authoritative state.

Do not report a multi-hop payment complete until the aggregate is `completed`.
When complete, report each available `hops[].receipt.crypto_tx_hash` as that
hop's chain reference.

Use `list_payments` for history. If an earlier payment is ambiguous, compare
assets, amounts, state, and time, then ask which one the human means.

---

# Recipients and wallets

## Saved recipients

Call `list_recipients`, reuse only a clear rail-and-fields match, and call
`get_recipient` for complete fields. Ask the human to choose if multiple
records match. `verified=false` alone does not make a recipient invalid.

## New recipient data

When the human elects to create a reviewed payment and supplies an image, QR
payload, pasted bank text, account details, or structured bank data, call
`create_recipient` before `create_payment`. Estimates are recipient-free. Use
the returned `recipient_id` or canonical `recipient_fields` only in
`create_payment.destination`; never manually copy unvalidated fields.

For a curated fiat rail, collect a non-empty `holder_name` from the human in
addition to the QR, bank details, or payment key. Treat it as an unverified
payout detail. Do not infer it from an EMV QR display label. Core derives
`bank_name` from its configured bank-code map when available; otherwise it
retains a caller-provided bank display name. On a rail with a configured bank
map, provide either a valid `bank_code` or a resolvable `bank_name`; Core
canonicalizes known codes and resolves known names.

For the current IDR direct-bank rail, collect `account_number`, `holder_name`,
and either a valid bank code or resolvable bank name. SeaBank currently
canonicalizes to `SEABANK`. Existing fiat recipient responses may gain a
response-only canonical `bank_name` when returned by `list_recipients`; do not
assume every recipient response is enriched. This enrichment does not mean the
saved recipient was replaced.

For local stdio, an image can use absolute `image.path`; remote clients use
`image.data_base64`. QR images must contain a readable QR. Pass text-only
screenshots as visible `pasted_text` or `bank_info`.

For `information_required`, ask only for listed missing or invalid fields. Keep
the request ID only if the payload is unchanged; use a new one after a change.

Use `update_recipient` only after the human confirms replacement fields. It
creates a replacement record and does not revoke the old one.

## Wallets

Onboarding creates the bound Privy wallet as the default crypto recipient.
Older installations may receive this record as a backfill when no crypto
recipient exists. Recipients are human-owner scoped, so sibling installations
may see the same record. Reuse it only when its chain and address match the
active wallet from `list_wallets`, instead of creating a duplicate.

For an on-ramp to the shared wallet, call `list_wallets` and use the active
Worldchain address. Never request its private key.

Call `get_wallet_balances` before a crypto deposit or swap instruction. Include
the native balance because a non-AgentKit-verified Privy EOA pays its own gas.

`get_token_allowance` reads allowance. `approve_token` is a compatibility
utility and is not part of the normal payment flow; Core performs exact
approval when required by `execute_payment_instruction`.

`get_transaction_receipt` can resolve a wallet submission, but cannot make a
payment successful. Continue to trust `get_payment`.

---

# Payment recovery

Always call `get_payment` before retrying, correcting, or cancelling.

## Review state

For `need_review`, wait for provider review and poll after
`next_action.poll_after_seconds`. Do not continue or correct the recipient.
This state does not by itself mean the saved recipient is invalid.

For `rail_not_ready`, follow the identity workflow. No payment was created.

## Recipient correction

Only for `recipient_correction_required`:

1. Read the failure and destination context.
2. Ask for corrected fields.
3. Show the change and obtain confirmation.
4. Call `correct_payment_recipient` with a new request ID and
   `confirmed_by_user=true`.
5. Resume polling.

## Cancellation

Call `cancel_payment` only after explicit confirmation and only before funds
move. A World ID challenge may remain visible until expiry, but cannot resume a
cancelled payment.

If `funds_moved=true`, do not promise cancellation, duplicate funding, or
automatically create a replacement.

## Failure

Read `failure.code`, `stage`, `message`, `retryable`, and `funds_moved`.

- If funds did not move and a route or approval expired, create a fresh
  estimate and obtain fresh confirmation before a new payment.
- If funds moved, explain the state and continue tracking or escalate. Do not
  invent partial two-hop recovery.
- Never convert failure to success from a wallet receipt alone.

Reuse the same request ID after an ambiguous submission of the same mutation.
Never create a replacement solely because a local MCP process restarted.
