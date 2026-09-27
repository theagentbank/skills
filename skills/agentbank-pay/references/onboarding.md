## 1. Set up the agent

### Determine the MCP surface

- **Local stdio:** `begin_agent_onboarding` and `execute_payment_instruction`
  are available. It authenticates an installation on this device.
- **Hosted OAuth:** `set_spending_limit` and `pay_within_spending_limit` are
  available, while local onboarding tools are absent. OAuth already identifies
  the human and the durable hosted installation; never attempt local onboarding
  or request a local credential.

As soon as the MCP tools are available, call `whoami` without waiting for
another user message.

For hosted OAuth, then call `check_my_scopes` and `get_account_reference`. If an account is
needed but absent, tell the human to finish their AgentBank sign-in; do not call
`begin_agent_onboarding`. The hosted setup flow ends here.

For local stdio, continue with the installation flow below.

### Local stdio onboarding

If it succeeds, call `get_account_status` and continue with the existing
installation.

If it returns `UNAUTHENTICATED` because the stored session expired, call
`relogin` once, then retry the original tool call. `relogin` signs a fresh
challenge only for the active local installation; it never accepts or returns
a credential, key, challenge, or signature. Do not begin a new onboarding flow
for an expired session.

If it returns `MISSING_CREDENTIAL`:

1. Call `begin_agent_onboarding` once immediately. This creates or resumes the
   local installation and the local wallet device flow.
2. Show `authorization_url` and explain that its one browser approval claims
   the agent and gives it access to its local wallet, a custodial signing key
   bound to this installation and stored in the local credential vault.
3. Call `wait_for_agent_onboarding` immediately with the returned
   `enrollment_id`; it polls while the human approves. If it times out while the
   enrollment remains pending, call it again with the same enrollment ID.
4. Verify that the result reports the wallet authorized (`privy_authorized`),
   `wallet_bound`, and `authenticated`.
5. Call `whoami`, `check_my_scopes`, `get_account_status`, and `list_wallets`.

For `CREDENTIAL_PROTECTOR_LOCKED`, `CREDENTIAL_PROTECTOR_UNAVAILABLE`,
`CREDENTIAL_DEVICE_MISMATCH`, `CREDENTIAL_STORE_UNAVAILABLE`,
`CREDENTIAL_STORE_CORRUPT`, `CREDENTIAL_STORE_CONFLICT`,
`CREDENTIAL_PROFILE_MISMATCH`, or `SESSION_REFRESH_FAILED`, do not start a new
onboarding flow. Preserve the installation, show the returned remediation, and
retry only after the OS credential condition or connectivity problem is fixed.

Browser approval is the only required human step. Do not ask the human to
repeat the setup request after MCP availability is confirmed. Do not call a legacy registration
alias or start a second onboarding flow while one is pending.

When the human asks to log out or reset this local agent:

1. Explain that revocation invalidates the installation, sessions, and bound
   wallet authorization for this agent and clears local credentials.
2. Obtain explicit confirmation.
3. Call `revoke_agent({"confirm":true})`.

For hosted OAuth, connection revocation is managed from the human-facing
AgentBank connection settings. Never call a local revocation tool for it.

