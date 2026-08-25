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

If it returns `UNAUTHENTICATED` because the saved session expired, call
`relogin` once and retry the original authenticated tool. `relogin` refreshes
only the active local installation and never accepts or returns a credential,
key, challenge, or signature. Do not begin new onboarding for an expired
session.

If it returns a genuine `MISSING_CREDENTIAL`:

1. Call `begin_agent_onboarding` once. It creates or resumes the local
   installation and Privy device flow.
2. Show `authorization_url`; explain that opening it once claims the agent and
   grants shared Privy wallet access.
3. Immediately call `wait_for_agent_onboarding` with the returned
   `enrollment_id`. If it times out while pending, call it again with the same
   enrollment ID.
4. Verify `privy_authorized`, `wallet_bound`, and `authenticated`.
5. Call `whoami`, `check_my_scopes`, `get_account_status`, and `list_wallets`.

If `begin_agent_onboarding` returns `status=authorized`, `authenticated=true`, and
`resumed=true`, an existing installation was restored. There is no browser URL or
enrollment ID. Verify `whoami`, scopes, account, and wallets, then restart or reload
the same client and require one more successful `whoami` before saying setup is complete.

For `CREDENTIAL_PROTECTOR_LOCKED`, `CREDENTIAL_PROTECTOR_UNAVAILABLE`, `CREDENTIAL_DEVICE_MISMATCH`, `CREDENTIAL_STORE_UNAVAILABLE`, `CREDENTIAL_STORE_CORRUPT`, `CREDENTIAL_STORE_CONFLICT`, `CREDENTIAL_PROFILE_MISMATCH`, or `SESSION_REFRESH_FAILED`, preserve the installation. Remedy the returned OS storage or connectivity condition and retry in the same client/profile; never start duplicate onboarding, clear credentials, revoke the agent, or ask for secret material.

Browser approval is the only human onboarding step. Never ask for signing
material, start a second flow while one is pending, or call a legacy
registration alias.

Denied, expired, cancelled, or revoked onboarding clears only the unfinished
flow. A malformed or expired pending record is repaired without replacing an
active installation. If authorization completed with the wallet bound,
`begin_agent_onboarding` may restore the session and return
`authenticated=true` and `resumed=true`; verify the same-client restart before
reporting success.

## Credential persistence

AgentBank uses a deterministic encrypted per-profile vault. Codex, Claude Code/Desktop, and Hermes subprocesses share it; XDG, D-Bus, desktop-session, and client-process variables do not select another store. Roots are under the current user's local data directory on Windows/macOS and `~/.config/agentbank/mcp` on Linux. macOS uses Keychain, Windows current-user DPAPI, and Linux a private local key with `0700` directories and `0600` files.

`HFX_MCP_PROFILE` selects a profile; `HFX_MCP_DATA_DIR` optionally sets a managed root. `vault` is default; established `auto` and `keychain` are deterministic-vault aliases. Use `file` only for managed/headless passphrase storage with `HFX_MCP_KEY_STORE_SECRET` and optional `HFX_MCP_KEY_STORE_FILE`.

Do not claim that an earlier store will or will not be migrated unless the MCP
returns that result. Never delete a credential store, change the profile, or
paste secrets into chat as recovery. On Linux, copying the complete MCP data
directory also copies its local vault key, so rely on disk encryption and
protected backups when home-directory theft is in scope.

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
2. Explain that the threshold applies only where the payment rules make it
   applicable; on-ramp-first payments currently bypass World ID.
3. Obtain explicit human confirmation.
4. Pass `world_id_approval_threshold_usd` as a non-negative decimal string.

The value supports at most 18 fractional digits and must not use a negative,
exponent, or invalid leading-zero form. Query the current policy instead of
assuming its default. For every payment or plan, follow the returned
`approval_required` or `approval_ready` status rather than predicting it from
amount or route.

## Revoke

When the human asks to log out or reset:

1. Explain that revocation invalidates this installation, its sessions, and its
   bound wallet authorization, then clears local credentials.
2. Obtain explicit confirmation.
3. Call `revoke_agent({"confirm":true})`.
