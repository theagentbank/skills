---
name: agentbank-pay
description: Install, onboard, and use AgentBank's MCP for identity, payments, recipients, wallets, tracking, and safe recovery. Use when a user asks to set up AgentBank, onboard a new agent, send or receive money, manage an AgentBank wallet or recipient, or inspect/recover an AgentBank payment.
license: MIT
compatibility: Designed for Codex, Claude Code, and Hermes. Installation requires Node.js 22.20+ and internet access.
metadata:
  author: theagentbank
  version: "1.5.0"
---

<!-- GENERATED from theagentbank/skills. Do not edit this compatibility copy directly. -->

# AgentBank Pay

Use the AgentBank MCP as the authority for onboarding, approvals, routes, payment instructions, transaction verification, and terminal payment state. Never replace its tools with direct HTTP requests or locally constructed protocol payloads.

## Availability gate

Check whether the active client exposes `whoami`, `get_instructions`, and `begin_agent_onboarding`.

If the tools are loaded, call `whoami` immediately and preserve the user's original task.

The published MCP package owns the deployed AgentBank endpoint defaults. Do not add endpoint environment overrides to a normal installation.

If the tools are absent and the user explicitly asked to set up or onboard AgentBank, configure only the active client. Inspect first and never overwrite an existing conflicting server.

For Codex:

```bash
codex mcp get agentbank --json
```

Only when that reports the server is missing:

```bash
codex mcp add agentbank -- npx -y agent-bank-mcp@latest
```

For Claude Code, use `claude mcp get agentbank`, then add a missing server with `claude mcp add --scope user agentbank -- npx -y agent-bank-mcp@latest`. For Hermes, run `hermes mcp add agentbank --command npx --args -y agent-bank-mcp@latest`, then `/reload-mcp`.

If an `agentbank` server exists but differs from the documented command, stop and show the conflict. After configuration, restart the active client once and repeat: `Onboard a new agent`. Do not attempt onboarding before the tools load.

Run onboarding only through the configured AgentBank MCP server in the active client and profile. Never use a standalone `npx` process or a temporary MCP client to bypass missing tools. After browser approval, call `whoami`, restart or reload that same client, and call `whoami` again. Report setup complete only after the post-restart call succeeds.

## Safety invariants

- Never request or expose private keys, seed phrases, AgentBank JWTs, Privy tokens, authorization keys, or World ID proofs.
- Never infer recipient fields, wallet addresses, token contracts, chains, decimals, amounts, or calldata from weak context.
- Use decimal strings for human amounts and structured asset objects.
- Use `get_supported_payment_capabilities` and `list_currencies` as the current authority for supported asset-and-chain pairs; do not assume every crypto route is on World Chain.
- Keep estimates recipient-free. Resolve recipient data only after the human elects to create the reviewed route and before `create_payment`.
- Show recipient, send amount, receive amount, every fee and currency, route, expiry, and material warnings before creating a payment.
- Set `confirmed_by_user=true` only after the human confirms that complete summary. Reconfirm after a material change.
- Use only a current server-generated instruction to move funds.
- A transaction receipt is evidence, not payment completion. Trust `get_payment`.
- Reuse a `request_id` only to retry the identical mutation and payload.
- Treat an approval-threshold update as a security-policy change. Call `update_payment_approval_policy` only after explicit human confirmation.
- Follow the payment's returned approval status. Never infer World ID behavior from a fixed threshold or route composition.
- Use payment plans only for multiple independently settled payments that the human wants to review together under one approval. Review every plan item before submission; a draft plan does not move funds.
- Treat `status=expired` with `failure.code=payment_expired` as terminal. Obtain a fresh estimate and confirmation, then create a new payment.
- Never expose partner identity or use hidden primitive intent, route, approval, settlement, or raw-swap mutations.

## Runtime guidance

For setup, pay, track, recover, recipient, or wallet work, call `get_instructions` with the relevant journey. The `agentbank://guides/routing` and `agentbank://instructions/{journey}` resources are also authoritative.


## Detailed workflow references

# Setup and onboarding

## Onboard

As soon as the tools load, call `whoami`.

If it succeeds, call `get_account_status` and continue with the existing installation.

If it returns `UNAUTHENTICATED` because the saved session expired, call `relogin` once and retry the original authenticated tool. `relogin` refreshes only the active local installation and never accepts or returns a credential, key, challenge, or signature. Do not begin new onboarding for an expired session.

If it returns a genuine `MISSING_CREDENTIAL`:

1. Call `begin_agent_onboarding` once. It creates or resumes the local installation and Privy device flow.
2. Show `authorization_url`; explain that opening it once claims the agent and grants shared Privy wallet access.
3. Immediately call `wait_for_agent_onboarding` with the returned `enrollment_id`. If it times out while pending, call it again with the same enrollment ID.
4. Verify `privy_authorized`, `wallet_bound`, and `authenticated`.
5. Call `whoami`, `check_my_scopes`, `get_account_status`, and `list_wallets`.

If `begin_agent_onboarding` returns `status=authorized`, `authenticated=true`, and `resumed=true`, an existing installation was restored. There is no browser URL or enrollment ID. Verify `whoami`, scopes, account, and wallets, then restart or reload the same client and require one more successful `whoami` before saying setup is complete.

For `CREDENTIAL_PROTECTOR_LOCKED`, `CREDENTIAL_PROTECTOR_UNAVAILABLE`, `CREDENTIAL_DEVICE_MISMATCH`, `CREDENTIAL_STORE_UNAVAILABLE`, `CREDENTIAL_STORE_CORRUPT`, `CREDENTIAL_STORE_CONFLICT`, `CREDENTIAL_PROFILE_MISMATCH`, or `SESSION_REFRESH_FAILED`, preserve the installation. Remedy the returned OS storage or connectivity condition and retry in the same client/profile; never start duplicate onboarding, clear credentials, revoke the agent, or ask for secret material.

Browser approval is the only human onboarding step. Never ask for signing material, start a second flow while one is pending, or call a legacy registration alias.

Denied, expired, cancelled, or revoked onboarding clears only the unfinished flow. A malformed or expired pending record is repaired without replacing an active installation. If authorization completed with the wallet bound, `begin_agent_onboarding` may restore the session and return `authenticated=true` and `resumed=true`; verify the same-client restart before reporting success.

## Credential persistence

AgentBank uses a deterministic encrypted per-profile vault. Codex, Claude Code/Desktop, and Hermes subprocesses share it; XDG, D-Bus, desktop-session, and client-process variables do not select another store. Roots are under the current user's local data directory on Windows/macOS and `~/.config/agentbank/mcp` on Linux. macOS uses Keychain, Windows current-user DPAPI, and Linux a private local key with `0700` directories and `0600` files.

`HFX_MCP_PROFILE` selects a profile; `HFX_MCP_DATA_DIR` optionally sets a managed root. `vault` is default; established `auto` and `keychain` are deterministic-vault aliases. Use `file` only for managed/headless passphrase storage with `HFX_MCP_KEY_STORE_SECRET` and optional `HFX_MCP_KEY_STORE_FILE`.

Do not claim that an earlier store will or will not be migrated unless the MCP returns that result. Never delete a credential store, change the profile, or paste secrets into chat as recovery. On Linux, copying the complete MCP data directory also copies its local vault key, so rely on disk encryption and protected backups when home-directory theft is in scope.

Wallet binding creates the onboarding-bound Privy wallet as the default crypto recipient. Older installations may be backfilled when `list_recipients` finds no crypto recipient. The record is scoped to the human owner, so sibling installations may see it. Match its chain and address against `list_wallets`, then treat a match as the system-created wallet destination rather than an unexpected manually saved recipient.

## World ID approval policy

Call `get_payment_approval_policy` when the human asks how this installation's payment approval threshold is configured. The policy applies only to the current installation; sibling agents owned by the same human have independent policies.

`update_payment_approval_policy` changes a security policy. Before calling it:

1. Show the current policy and proposed threshold.
2. Explain that the threshold applies only where the payment rules make it applicable; on-ramp-first payments currently bypass World ID.
3. Obtain explicit human confirmation.
4. Pass `world_id_approval_threshold_usd` as a non-negative decimal string.

The value supports at most 18 fractional digits and must not use a negative, exponent, or invalid leading-zero form. Query the current policy instead of assuming its default. For every payment or plan, follow the returned `approval_required` or `approval_ready` status rather than predicting it from amount or route.

## Revoke

When the human asks to log out or reset:

1. Explain that revocation invalidates this installation, its sessions, and its bound wallet authorization, then clears local credentials.
2. Obtain explicit confirmation.
3. Call `revoke_agent({"confirm":true})`.

---

# Identity and verification

Call `check_verification_status` when KYC or badges affect a task. Its `markets` describe provider-agnostic readiness by country and may include route direction and supported instruments. They are not amount-specific live quotes; use quote-book tools and `estimate_payment` for executable corridors.

If KYC is missing:

1. Call `do_kyc`.
2. Continue immediately for `already_verified`.
3. If it returns `kyc_url`, show the Didit URL and ask the human to complete it.
4. Call `check_verification_status` again before retrying a gated action.

Never ask the human to paste identity proofs into chat. The agent can start a KYC session but cannot complete it.

If `create_payment` returns `need_review` with `reason=rail_not_ready`, no payment was created and no funds moved. Show the returned readiness state. Wait until the market is `APPROVED`, then retry with the same request ID; refresh and reconfirm if the quote expired.

Payment World ID approval is a separate per-payment action returned by `create_payment`. Do not substitute a badge check.

AgentKit wallet verification is also separate:

1. Call `verify_agent_kit` without wallet IDs or addresses.
2. Show the returned hosted `verification_url` unchanged and ask the human to open or scan it in World App.
3. After completion, call `verify_agent_kit` again through pending or registering states until it returns `status=verified`.

Do not rewrite or reconstruct the verification URL, run the AgentKit CLI manually, or request a World ID proof.

---

# Payments and tracking

## Understand the request

For an estimate, collect the source asset and chain or fiat currency, exact-source or exact-destination amount, destination asset/currency and country, and optional routing preference. Do not request, create, or pass a recipient merely to estimate a payment. Collect it only after the human elects to create the reviewed route.

```text
balanced
lowest_total_cost
fastest
highest_success_rate
```

Use `balanced` by default. Do not silently split an amount, switch chains, change exactness, or change recipients.

Use structured assets:

```json
{ "type": "crypto", "ticker": "USDC", "chain": "worldchain" }
```

```json
{ "type": "crypto", "ticker": "USDT", "chain": "bsc" }
```

```json
{ "type": "fiat", "symbol": "VND" }
```

Use `get_supported_payment_capabilities` for the current high-level route catalog and `list_currencies` whenever a code, chain, address, or decimals need verification. The current catalog includes USDT on BNB Smart Chain (`bsc`) in addition to World Chain assets; never substitute a token or chain, or infer cross-chain swap support. Source and destination cannot be the same asset; ask what value the human actually wants moved instead of creating a no-op payment.

## Find a live route

Call `list_quote_book_pairs` for live direct on/off-ramp corridors. Route discovery and estimation do not require a recipient.

For fiat-to-fiat or source-token-to-fiat:

1. Join relevant live on-ramp and off-ramp pairs on one common crypto asset and chain.
2. Set `route.intermediate_asset` explicitly in `estimate_payment`.
3. Prefer the requested route; otherwise compare executable outcomes including all fees.

There is no automatic route planner. `browse_quote_book` is rough anonymous discovery; read rate, percentage fee, flat fee, and fee currency together. `get_ramp_quote` is direct on/off-ramp only.

## Estimate and confirm

Call `estimate_payment` for direct ramps, same-chain crypto swaps, and explicit two-hop routes. For two hops, pass the intermediate asset. Do not provide `recipient_id` or `recipient_fields`: estimates are recipient-free route previews.

Require `status=estimate_ready`. The estimate is ephemeral, has no estimate ID, and does not create a payment. Read the returned `source_amount`, `destination_amount`, every leg's fee and currency, expiry, route, `intermediate_amount`, and returned `hops`. Expect `next_action.type=review_estimate`; `recipient_validation` is no longer part of the estimate.

For a fiat destination, also read `recipient_requirements`. They are the authoritative instrument choices and field contract. Do not create a recipient or payment until the human chooses one listed `payment_instrument` and supplies its required fields.

The returned hops contain route data only: `hop_index`, `intent_id`, `direction`, `source`, and optional `client_quote_id`. Never add `recipient_fields` or `recipient_ref` to these public hops.

Treat those returned effective amounts as the review truth. For an exact-source two-hop route, the downstream locked quote may cause the exact-output upstream leg to report a different `source_amount` from the initially requested discovery amount. Surface that difference and obtain confirmation for the returned amount; never silently reuse the original amount.

If the human wants to create the reviewed payment, collect or select the final recipient now. A pure swap without a recipient uses the onboarding-bound wallet internally; all other routes require the recipient once in `create_payment.destination`.

If `estimate_payment` returns `QUOTE_UNAVAILABLE` or `status=estimate_unavailable`:

1. Call `browse_quote_book` for each matching direct leg; inspect upstream and downstream legs separately for a two-hop route.
2. Compare the effective requested amount with each live band's `min_amount`, `max_amount`, expiry, `fee_pct`, `flat_fee`, and `fee_ccy`. Raw `rate` alone does not prove executability.
3. Explain whether no live band exists, the effective amount falls outside the band after fees, or the quote expired. Never invent a customer rate.
4. Call `check_verification_status` only when the response identifies KYC or rail readiness as a blocker, or when the human asks. Its `markets` output is not live quote readiness.
5. Ask whether to use an in-band amount or another route, then obtain a fresh estimate and confirmation after any change.

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
Recipient instrument: [only when the estimate requires one]
```

After confirmation, call `create_payment` with a new stable request ID, `confirmed_by_user=true`, the reviewed request, the final recipient once in `destination.recipient_id` or `destination.recipient_fields` when required, the top-level intermediate asset for two hops, and the exact current estimate `hops` unchanged. Do not pass an estimate ID.

If Core returns `status=information_required` with `reason=recipient_incompatible`, no payment, settlement, or funds movement exists. Return to the current estimate's `recipient_requirements`, correct or create the recipient with a listed instrument, and obtain a fresh estimate and confirmation if it expired.

For a two-hop route, preserve hop order. The MCP internally injects `recipient_ref:{"hop_index":1}` into hop 0 and the top-level destination recipient into hop 1. Do not construct that plumbing yourself.

## Payment plans

Use a plan only when the human wants several independently settled payments reviewed together under one World ID approval. A plan never combines recipients, funds, or settlement instructions.

1. Call `create_payment_plan` with a concise description and a new stable request ID.
2. Estimate each item and show one consolidated review containing every recipient, amount, fee and fee currency, route, expiry, and warning.
3. Obtain explicit confirmation for the complete plan.
4. Call `create_payment` for each item with the returned `plan_id`, a unique positive `plan_position`, and a unique request ID. Plan-bound creates may omit `confirmed_by_user`; standalone creates still require it to be `true`.
5. Call `review_payment_plan` and verify every intended item and position.
6. Call `submit_payment_plan` with a new request ID and `confirmed_by_user=true`. Submission seals the plan and may return the one approval URL covering all items.
7. After approval, track and continue each payment independently.

`status=plan_draft` means the payment is durable but cannot be continued until the plan is submitted. Never modify a submitted plan. Use `list_payment_plans` to recover an interrupted plan, and `cancel_payment_plan` only after human confirmation and before funds move.

## Approval and continuation

For `approval_required`, show `approval.approval_url`, explain that the payment owner signs in before World ID is shown, state expiry, and ask the human to approve in World App. Never request or reconstruct a raw proof.

Core applies the installation threshold only where current payment rules make it applicable; on-ramp-first payments currently bypass World ID. Never predict approval from a fixed threshold, asset, amount, or route composition. Follow the returned status: for `approval_ready` with `approval:null`, call `continue_payment` directly; for `approval_required`, show the approval URL, wait for the human, and poll `get_payment` until ready.

## Follow the instruction exactly

Use `action_url` or `presentation_url` for human-executed fiat funding. Show the exact amount and expiry, ask the human to pay, and poll `get_payment`. Do not call `execute_payment_instruction` for fiat funding.

For a direct crypto deposit:

1. Show exact chain, asset, amount, full destination, memo/reference, and expiry.
2. Call `get_wallet_balances`.
3. Obtain explicit confirmation.
4. Call `execute_payment_instruction` with the current payment and instruction IDs, a stable request ID, and `confirmed_by_user=true`.
5. If pending, retry the identical call with the same request ID.

For `swap_execution`, show the confirmed source ceiling, destination amount, asset, chain, and recipient, then execute the instruction as above. Never construct calldata, token addresses, approval targets, or a call order; Core owns and verifies the pinned plan.

For linked two-hop payments, act only on the first/source hop and then track the aggregate. Never separately fund hop 1: that duplicates funding.

## External x402 payments

Use the dedicated x402 tools only when the human asks to pay a URL that returns an x402 payment challenge. Call `estimate_x402_outbound_payment` with the exact URL, request method/body, and proposed funding asset; it creates a durable intent but does not move funds. Show the returned external requirement, funding amount, fees, pay-to address, and expiry, then obtain explicit confirmation before `confirm_x402_outbound_payment`.

Follow the current server-generated funding action exactly and use `get_x402_outbound_payment` as the authoritative state; use `list_x402_outbound_payments` to recover a lost intent ID. Do not create a replacement intent after an interruption. Current public x402 flows support live fiat on-ramps, not manually funded USDC: never construct an x402 header, EIP-3009 authorization, transaction, signature, or `payment_signature` locally. A token transfer hash does not prove the external resource accepted payment.

## Track

Poll `get_payment` according to `next_action.poll_after_seconds`. It is the authoritative state.

Use its timeline for plan position, approval stage, source and destination progress, fiat collection/payout details, explorer links, and per-hop hashes. Do not flatten divergent or out-of-order progress into a completed state.

Do not report a multi-hop payment complete until the aggregate is `completed`. When complete, report each available `hops[].receipt.crypto_tx_hash` as that hop's chain reference.

Use `list_payments` for owner-scoped history. An authorized sibling installation may recover the same owner's payment. If an earlier payment is ambiguous, compare assets, amounts, state, and time, then ask which one the human means.

---

# Recipients and wallets

## Saved recipients

Call `list_recipients`, reuse only a clear rail-and-fields match, and call `get_recipient` for complete fields. Ask the human to choose if multiple records match. `verified=false` alone does not make a recipient invalid.

## New recipient data

When the human elects to create a reviewed fiat payment, read that estimate's `recipient_requirements`. Ask the human to choose exactly one listed `payment_instrument`, then call `create_recipient` with that instrument and its required fields before `create_payment`. Never infer an instrument from a QR, bank fields, or weak context. Estimates remain recipient-free; use returned `recipient_id` or canonical `recipient_fields` only in `create_payment.destination`.

The quote is authoritative: `qr` requires `country` and `qr_content`; `bank_transfer` requires `country`, `bank_name`, `account_number`, and `holder_name`; `mobile_money` requires `country`, `mobile_money_network_code`, and `mobile_money_destination`. The mobile-money destination is opaque: do not force E.164 or request a holder name unless the selected requirement requires it. When `holder_name_must_match_kyc=true`, explain that the submitted name must equal the user's verified KYC legal name; never request or disclose that name.

Before collecting a bank-transfer recipient, ask the human for their exact bank name and submit it as `bank_name`. If Core rejects it, show the supported-values error and ask the human to choose again. Never guess a provider `bank_code` or claim a guessed name is canonical. Provider `bank_code` values may appear in canonical responses but are not a public input.

For local stdio, an image can use absolute `image.path`; remote clients use `image.data_base64`. QR images must contain a readable QR. Pass text-only screenshots as visible `pasted_text` or `bank_info`.

For `information_required`, ask only for listed missing or invalid fields. Keep the request ID only if the payload is unchanged; use a new one after a change.

Use `update_recipient` only after the human confirms replacement fields. Pass `payment_instrument` when changing the instrument. It creates a replacement record and does not revoke the old one.

## Wallets

Onboarding creates the bound Privy wallet as the default crypto recipient. Older installations may receive this record as a backfill when no crypto recipient exists. Recipients are human-owner scoped, so sibling installations may see the same record. Reuse it only when its chain and address match the active wallet from `list_wallets`, instead of creating a duplicate.

For an on-ramp to the shared wallet, call `list_wallets` and use the active wallet address for the reviewed asset chain (for example, World Chain USDC or BNB Smart Chain USDT). Never request its private key or substitute a chain.

Call `get_wallet_balances` before a crypto deposit or swap instruction. Include the native balance because a non-AgentKit-verified Privy EOA pays its own gas.

`get_token_allowance` reads allowance. `approve_token` is a compatibility utility and is not part of the normal payment flow; Core performs exact approval when required by `execute_payment_instruction`.

`get_transaction_receipt` can resolve a wallet submission, but cannot make a payment successful. Continue to trust `get_payment`.

---

# Payment recovery

Always call `get_payment` before retrying, correcting, or cancelling.

## Review state

For `need_review`, wait for provider review and poll after `next_action.poll_after_seconds`. Do not continue or correct the recipient. This state does not by itself mean the saved recipient is invalid.

For `rail_not_ready`, follow the identity workflow. No payment was created.

## Recipient correction

Only for `recipient_correction_required`:

1. Read the failure and destination context.
2. Ask for corrected fields.
3. Show the change and obtain confirmation.
4. Call `correct_payment_recipient` with a new request ID and `confirmed_by_user=true`.
5. Resume polling.

## Cancellation

Call `cancel_payment` only after explicit confirmation and only before funds move. Cancellation also cancels a pending approval; never tell the human to finish an approval for a cancelled payment.

For a draft or submitted plan, call `review_payment_plan` first. Use `cancel_payment_plan` only after explicit confirmation; it cancels unstarted items and releases unopened route locks but cannot interrupt moved funds.

If `funds_moved=true`, do not promise cancellation, duplicate funding, or automatically create a replacement.

## Failure

Read `failure.code`, `stage`, `message`, `retryable`, and `funds_moved`.

- For terminal `status=expired` with `failure.code=payment_expired`, the locked pre-funding route expired before continuation. It is not retryable for that payment: obtain a fresh estimate and confirmation, then create a new payment with a new logical request ID.
- If funds did not move and a route or approval expired, create a fresh estimate and obtain fresh confirmation before a new payment.
- If funds moved, explain the state and continue tracking or escalate. Do not invent partial two-hop recovery.
- Never convert failure to success from a wallet receipt alone.

Reuse the same request ID after an ambiguous submission of the same mutation. Never create a replacement solely because a local MCP process restarted. An authorized sibling installation may inspect or cancel an owner-scoped payment, but must apply the same confirmation and funds-moved rules.
