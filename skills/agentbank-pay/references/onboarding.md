# Setup and onboarding

## Configure the MCP

The bootstrap expects this exact stdio server:

```text
name: agentbank
command: npx
args: -y agent-bank-mcp@latest
environment: empty
```

The published package supplies the deployed AgentBank endpoint defaults. New
installations must not add endpoint overrides.

The bootstrap performs a no-op for an exact match, adds a missing
configuration, and refuses to overwrite a conflict. For upgrade compatibility,
it also accepts an otherwise exact configuration containing only the former
`PROTOCOL_BASE_URL=https://protocol.agentbank.world` and
`APP_BASE_URL=https://app.agentbank.world` overrides. Run it only through
the availability gate in the main skill.

Hermes uses the manual command in the main skill and `/reload-mcp`; the
bootstrap script supports Codex and Claude Code only.

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
