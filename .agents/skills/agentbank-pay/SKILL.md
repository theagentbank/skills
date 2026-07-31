---
name: agentbank-pay
description: Install, onboard, and use AgentBank's MCP for identity, payments, recipients, wallets, tracking, and safe recovery. Use when a user asks to set up AgentBank, onboard a new agent, send or receive money, manage an AgentBank wallet or recipient, or inspect/recover an AgentBank payment.
---

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

Read [onboarding.md](references/onboarding.md) when installing, onboarding,
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
  [onboarding.md](references/onboarding.md)
- KYC, badges, World ID, or AgentKit verification:
  [identity.md](references/identity.md)
- Creating, approving, funding, executing, or tracking a payment:
  [payments.md](references/payments.md)
- Saved recipients, QR/bank data, wallet lookup, balances, or allowances:
  [recipients-wallets.md](references/recipients-wallets.md)
- Failed, stuck, cancelled, reviewed, or recipient-correction states:
  [recovery.md](references/recovery.md)

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
