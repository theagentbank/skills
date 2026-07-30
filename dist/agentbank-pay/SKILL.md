---
name: agentbank-pay
description: Install, onboard, and use AgentBank's MCP for identity, payments, recipients, wallets, tracking, and safe recovery. Use when a user asks to set up AgentBank, onboard a new agent, send or receive money, manage an AgentBank wallet or recipient, or inspect/recover an AgentBank payment.
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

If the tools are absent and the user explicitly asked to set up or onboard
AgentBank, run this skill's bootstrap:

```bash
node "<skill-directory>/scripts/setup-mcp.mjs" --client codex --json
```

Use `--client claude` in Claude Code. If the active client cannot be determined,
ask which client the user is using. Do not run both.

Interpret the result as follows:

- `configured`: configuration was added and verified.
- `already_configured`: the exact configuration already exists.
- `conflict`: stop and show the conflict; never remove or overwrite it.
- `client_unavailable`: explain that the selected client CLI is unavailable.

After `configured` or `already_configured`, if the MCP tools are still absent,
tell the user to restart the active coding agent once and repeat:
`Onboard a new agent`. Do not attempt onboarding before the tools load.

For a payment-only request with missing tools, explain the required user-level
MCP configuration and obtain permission before changing it.

Read onboarding.md when installing, onboarding,
checking account readiness, revoking an installation, or resuming after the
one-time restart.

## Safety invariants

- Never request or expose private keys, seed phrases, AgentBank JWTs, Privy
  tokens, authorization keys, or World ID proofs.
- Never infer recipient fields, wallet addresses, token contracts, chains,
  decimals, amounts, or calldata from weak context.
- Use decimal strings for human amounts and structured asset objects.
- Resolve recipient data before estimating a payment.
- Show recipient, send amount, receive amount, every fee and currency, route,
  expiry, and material warnings before creating a payment.
- Set `confirmed_by_user=true` only after the human confirms that complete
  summary. Reconfirm after a material change.
- Use only a current server-generated instruction to move funds.
- A transaction receipt is evidence, not payment completion. Trust
  `get_payment`.
- Reuse a `request_id` only to retry the identical mutation and payload.
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

## Route by task

- Setup, onboarding, readiness, or logout:
  onboarding.md
- KYC, badges, World ID, or AgentKit verification:
  identity.md
- Creating, approving, funding, executing, or tracking a payment:
  payments.md
- Saved recipients, QR/bank data, wallet lookup, balances, or allowances:
  recipients-wallets.md
- Failed, stuck, cancelled, reviewed, or recipient-correction states:
  recovery.md

Load only the references needed for the current task.

## Tool groups

```text
Setup: whoami, begin_agent_onboarding, wait_for_agent_onboarding, get_installation_status, get_account_status, check_my_scopes, revoke_agent
Identity: check_verification_status, do_kyc, get_verification_guidance, verify_agent_kit
Discovery: list_currencies, get_supported_payment_capabilities, list_quote_book_pairs, browse_quote_book, get_ramp_quote, estimate_payment
Payments: create_payment, continue_payment, execute_payment_instruction, get_payment, list_payments, cancel_payment, correct_payment_recipient
Recipients: list_recipients, get_recipient, create_recipient, update_recipient
Wallets: list_wallets, get_wallet_balances, get_token_allowance, approve_token, get_transaction_receipt
Guidance: get_instructions
```

## Detailed workflow references

# Setup and onboarding

## Configure the MCP

The bootstrap expects this exact stdio server:

```text
name: agentbank
command: npx
args: -y agent-bank-mcp@latest
PROTOCOL_BASE_URL=https://protocol.agentbank.world
APP_BASE_URL=https://staging.agentbank.world
```

It performs a no-op for an exact match, adds a missing configuration, and
refuses to overwrite a conflict. Run it only through the availability gate in
the main skill.

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
2. Show `verification_url` and ask the human to open or scan it in World App.
3. After completion, call `verify_agent_kit` again until it reports `verified`.

Do not run the AgentKit CLI manually or request a World ID proof.

---

# Payments and tracking

## Understand the request

Collect the source asset and chain or fiat currency, exact-source or
exact-destination amount, destination asset/currency and country, concrete
recipient or wallet, and optional routing preference:

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

Resolve recipient data first. Then call `list_quote_book_pairs` for live direct
on/off-ramp corridors.

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
two-hop routes. For two hops, pass the intermediate asset and concrete final
recipient.

Require `status=estimate_ready`. The estimate is ephemeral, has no estimate ID,
and does not create a payment. Read exact source/destination amounts, every
leg's fee and currency, expiry, route, intermediate amount, recipient
validation, and returned `hops`.

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
`confirmed_by_user=true`, the reviewed request, top-level intermediate asset
for two hops, and the exact current estimate `hops`. Do not pass an estimate ID.

For a two-hop route, preserve hop order and `recipient_ref`; the first hop
delivers directly to the downstream off-ramp destination.

## Approval and continuation

For `approval_required`, show `approval.approval_url`, explain that the payment
owner signs in before World ID is shown, state expiry, and ask the human to
approve in World App. Never request or reconstruct a raw proof.

If the payment returns `approval_ready` with no approval, call
`continue_payment` directly. Otherwise poll `get_payment` after approval and
continue when ready.

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

When the human supplies an image, QR payload, pasted bank text, account
details, or structured bank data, call `create_recipient` before estimating or
creating a payment. Use the returned `recipient_id` or canonical
`recipient_fields`; never manually copy unvalidated fields.

For local stdio, an image can use absolute `image.path`; remote clients use
`image.data_base64`. QR images must contain a readable QR. Pass text-only
screenshots as visible `pasted_text` or `bank_info`.

For `information_required`, ask only for listed missing or invalid fields. Keep
the request ID only if the payload is unchanged; use a new one after a change.

Use `update_recipient` only after the human confirms replacement fields. It
creates a replacement record and does not revoke the old one.

## Wallets

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
