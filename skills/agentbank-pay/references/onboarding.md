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
