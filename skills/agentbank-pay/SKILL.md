---
name: agentbank-pay
description: Use the AgentBank MCP, local (Codex, Claude Code, Hermes) or hosted over OAuth (Meta Muse, Poke, ChatGPT, Claude, any agent that can call an HTTPS MCP server), for setup, identity, sending and collecting money, spending limits, recipients, tracking, x402 outbound payments, and safe recovery. Use when a person asks to set up AgentBank, send or receive money, check a balance or a payment, manage a recipient or spending limit, or recover a payment.
license: MIT
compatibility: "Local MCP clients (Codex, Claude Code, Claude Desktop, OpenClaw, Hermes) need Node.js 22.20+; hosted clients (ChatGPT, Claude, Meta Muse, Poke) connect to the HTTPS MCP server with OAuth."
metadata:
  author: "theagentbank"
  version: "2.0.1"
---

# AgentBank Pay

## Choose the MCP surface first

AgentBank is banking for AI agents. It connects agents to the financial rails
people and businesses already use. With AgentBank, an agent can collect money
locally, hold it, convert it, and send it anywhere in the world to any existing
bank account, in the local currency.

Before any setup or payment action, identify how AgentBank is connected. Do not
assume that every AgentBank MCP has local credentials or local wallet control.
Call `tools/list` and read the tool names:

- **Local stdio MCP:** `begin_agent_onboarding`,
  `wait_for_agent_onboarding`, and `execute_payment_instruction` are available.
  This surface uses a credential stored on the current device and can execute a
  current crypto instruction through the agent's local wallet, a signing key
  bound to this installation.
- **Hosted MCP over OAuth** (`https://mcp.useagentbank.com`): local
  onboarding and executor tools are absent. OAuth already supplies the owner
  context. It exposes `get_balance`, `set_spending_limit`,
  `pay_within_spending_limit`, `get_account_reference`, `track_payments` and
  the card tools `show_payment_approval`, `get_payment_instruction`,
  `show_payment_progress`. **Read the "Hosted surface" section next and skip
  every section marked local.**

If the surface is unclear, inspect the available tools before proceeding:
`begin_agent_onboarding` is a strong local stdio signal; hosted approval,
instruction, progress, or spending-limit tools are strong remote OAuth signals.
Never invent credentials or fall back to direct HTTP requests.

**Hosted behavior:** do not install the local MCP, start local onboarding,
call `relogin`/`revoke_agent`, or ask the human for any local device or wallet
setup. Call `whoami` and proceed in the OAuth owner's context.
Use the rendered approval and funding cards. After a hosted funding card,
wait for a new human response before taking any funding action; only use
`pay_within_spending_limit` when they explicitly choose automatic funding for the
current crypto instruction.

**Local stdio behavior:** if AgentBank tools are absent, install the MCP below.
When they are available, call `whoami`; use the local onboarding flow only when
it reports `MISSING_CREDENTIAL`. Use `execute_payment_instruction` only on this
surface and only with the current server-generated instruction.

## Local stdio prerequisite: install the AgentBank MCP

These installation commands apply only to local stdio MCP users. The published
package already defaults to the production AgentBank endpoints, so use these
commands without environment overrides:

### Codex

```bash
codex mcp add agentbank -- npx -y agent-bank-mcp@latest
```

### Claude Code

```bash
claude mcp add agentbank -- npx -y agent-bank-mcp@latest
```

### Hermes

```bash
hermes mcp add agentbank --command npx --args -y agent-bank-mcp@latest
```

After installation, start a new Codex or Claude Code conversation. In Hermes,
run `/reload-mcp`. Then confirm the client exposes `whoami`,
`get_instructions`, and `begin_agent_onboarding` before continuing. A remote
HTTP/OAuth user does not run these commands: their host configures the remote
connection and OAuth authorization.

Credential persistence is bound to the OS user and the stable
`AGENTBANK_MCP_PROFILE` (default `default`), not to `XDG_RUNTIME_DIR`, a desktop
session, or the calling MCP client. Use a distinct profile for each local human
or agent identity and keep it unchanged across restarts. On Linux, the default
vault relies on per-user file permissions plus the host's disk and backup
protection; copying the complete vault directory also copies its local key.

## Use the AgentBank MCP

For local stdio, make sure the AgentBank MCP is installed and loaded by checking
for `whoami`, `get_instructions`, and `begin_agent_onboarding`. If these tools
are absent, install the MCP using the matching command above, reload the
client, and check again. If the client cannot run its configuration command,
show the matching command to the human. Do not replace AgentBank MCP calls with
direct HTTP while it reloads.

For remote HTTP/OAuth, do not require or install local-only tools. Confirm that
`whoami` and the relevant payment tools are available, then use the connected
OAuth session.

When the tools are available, preserve the original task and continue immediately. Call `whoami`
without waiting for another user message, then use the relevant AgentBank MCP tools across setup,
payment, tracking, recovery, recipient, and wallet workflows.

Do not replace AgentBank MCP calls with direct HTTP requests, locally constructed protocol payloads,
or unrelated payment tools. Treat AgentBank Core as the authority for approvals, locked routes,
payment instructions, transaction verification, and terminal payment state.

Do not use or ask for legacy intent, route-agreement, approval, settlement, partner, raw-swap, or
progress-reporting mutations. They are not exposed by the production server.

## Safety rules

- Never request or expose private keys, seed phrases, AgentBank JWTs, wallet signing tokens, authorization keys, or identity and approval proofs.
- Never infer a wallet address, bank account, recipient, token contract, chain, decimals, amount, or calldata from weak context.
- Use decimal strings for human amounts.
- Show the complete recipient, source amount, destination amount, fees with fee currencies, route, and expiry before `create_payment`.
- Set `confirmed_by_user=true` only after the human confirms that summary.
- Use only a current server-generated payment instruction to move funds.
- A transaction hash or successful receipt is not payment completion. Trust
  `get_payment`.
- Do not expose partner identity. Current quote tools intentionally return
  anonymous offers.

Read [hosted.md](references/hosted.md) for "Hosted surface (consumer chats)".

## Runtime source of truth

Call `get_instructions` with the relevant journey when starting an unfamiliar
flow or recovering after an interruption:

```text
setup
pay
track
recover
manage_recipients
manage_wallets
```

The MCP also exposes `agentbank://guides/routing` and
`agentbank://instructions/{journey}` as resources. Follow newer runtime guidance
when it does not conflict with these safety rules.

## Request IDs

Generate a stable `request_id` for each logical create, continue, execute,
approve, cancel, recipient-correction, recipient-creation, or
recipient-replacement mutation.

Reuse the same ID only when retrying the same tool call with the same payload.
Use a different ID for a changed payload or a different transaction.
Do not treat a transaction request ID as a payment ID.

## Asset and amount format

Use canonical assets:

```json
{ "type": "crypto", "ticker": "USDC", "chain": "worldchain" }
```

```json
{ "type": "fiat", "symbol": "VND" }
```

For `exact_source`, put the exact amount in `source.amount`. For
`exact_destination`, put it in `destination.amount`.

Use `list_currencies` whenever a ticker, fiat code, chain, token address, or
decimals need verification. Always pass the complete structured asset object;
compound asset strings are invalid. These objects are tool inputs: on the
hosted surface the human only ever hears dollars and local currencies.

`get_supported_payment_capabilities` is optional product reference material. It
returns a static Markdown summary and never confirms that a route is currently
live, in the requested amount band, or ready for this user.

Read [x402.md](references/x402.md) for "x402 outbound payments".

Read [onboarding.md](references/onboarding.md) for "1. Set up the agent".

Read [identity.md](references/identity.md) for "2. Handle identity requirements".

Read [payments.md](references/payments.md) for "3. Understand the payment request".

Read [recipients-wallets.md](references/recipients-wallets.md) for "4. Resolve the recipient".

Read [payments.md](references/payments.md) for "5. Discover a supported route", "6. Estimate the complete payment", "7. Confirm once", "8. Create and approve the durable payment", "9. Follow the payment instruction".

Read [recovery.md](references/recovery.md) for "10. Track the payment", "11. Recover safely".

## 12. Tool selection reference

```text
Local setup: begin_agent_onboarding, wait_for_agent_onboarding, get_installation_status, revoke_agent
Hosted setup: whoami, check_my_scopes, get_account_reference
Identity: whoami, get_account_status, check_my_scopes, check_verification_status, do_kyc, get_verification_guidance
Discovery: list_currencies, get_supported_payment_capabilities, list_quote_book_pairs, browse_quote_book, estimate_payment
Plans: create_payment_plan, review_payment_plan, list_payment_plans, submit_payment_plan, cancel_payment_plan
Local payments: create_payment, continue_payment, execute_payment_instruction, get_payment, list_payments, cancel_payment, correct_payment_recipient
Hosted payments: create_payment, continue_payment, pay_within_spending_limit, get_payment, track_payments, list_payments, cancel_payment, correct_payment_recipient, get_payment_link
Recipients: list_recipients, get_recipient, create_recipient, update_recipient
Local wallet: list_wallets, verify_agent_kit, get_wallet_balances, get_token_allowance, approve_token, get_transaction_receipt
Hosted balance and spending limits: get_account_reference, get_balance, set_spending_limit, list_spending_limits, get_spending_limit, show_spending_limit
Hosted bank directory: get_supported_bank_names
Guidance: get_instructions
```

Hosted notes: `get_balance` = the human's AgentBank balance in dollars (no
inputs). `get_account_reference` = the `account_id` for
`pay_within_spending_limit` (also present in `funding_options`).
`pay_within_spending_limit` inputs: `request_id`, `payment_id`,
`instruction_id`, `account_id`, `confirmed_by_user`. Local stdio keeps
`get_wallet_balances`, `list_wallets` and `execute_payment_instruction`.
