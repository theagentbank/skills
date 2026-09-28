## Hosted surface (consumer chats)

This section is the whole playbook for the hosted MCP. The human is usually in
a consumer chat (Meta Muse, Poke, ChatGPT, Claude, an agent framework). Hosted
results already come back consumer-shaped: use them, and never fall back to
the local sections below for wording.

### Connecting a self-written client

If your host connects natively, skip this. If you write your own client:

- Endpoint `POST https://plugin.agentbank.world/mcp`, JSON-RPC over Streamable
  HTTP. Send `Accept: application/json, text/event-stream`; a response may be
  an SSE stream, take the last `data:` line. The server is stateless: a fresh
  `initialize` (`protocolVersion` `2025-06-18`; `2025-03-26` also works) per
  script run is fine and no session id is required.
- Auth is OAuth 2.1 authorization code with PKCE `S256`, public client
  (`token_endpoint_auth_method: none`). Read
  `https://protocol.agentbank.world/.well-known/oauth-authorization-server` for
  the authorize, token and registration endpoints; do not invent paths.
- Meta Muse's connect page does not perform dynamic registration: put the
  pre-issued client id `ab_mcp_XEXqSJxoelaxm6p16ybaihkIi6M` in the connector
  spec with those endpoints (callback
  `https://agent.meta.ai/api/hatch/oauth/callback`). Any other client registers
  once at the registration endpoint with its own callback and keeps the
  returned `client_id`.
- Send a descriptive `User-Agent`. A 401 on a tool call means the access token
  was rejected or expired: refresh it if you hold a refresh token, otherwise ask
  the human to reconnect AgentBank in your app; do not retry the same call.
- Never print, store or paste tokens, and never ask the human for a key.

### Reading hosted results

Every tool result has `structuredContent` (JSON) and a text copy. Read
`structuredContent`:

- `display`: `summary`, `recipient` ("BANH TRI TRUNG, ACB account 170196"),
  `recipient_details` (name, bank, account_number), `you_pay`,
  `recipient_gets`, `fee`, `rate`, `valid_until`, `balance`. Speak from these;
  never read raw amounts, asset objects, IDs or field names aloud. Account
  numbers are shown in full; they are not sensitive.
- `say_to_user`: one sentence of progress. Send it to the human **before** your
  next tool call so they never sit through a silent wait.
- `progress_steps` and `progress`: the payment journey in plain words,
  Confirmed → Approved → Payment received → Sending → Paying out → Delivered
  (Converting for a swap), each `completed`, `processing`, `pending`, `blocked`
  or `failed`, with `progress.tracker` ("Confirmed ✓ → Sending ✓ → Paying out
  (now) → Delivered") and `progress.current_step`. Report the current step
  every time it changes; never invent a stage.
- `next_action`: what to do next and, when polling, `poll_after_seconds`.
- `funding_options`: whether a spending limit can fund this payment
  (`spending_limit_available`, `spending_limit_id`, `account_id`, `reason`).
- `spending_limit`: `total_usd`, `per_payment_max_usd`, `window_hours`,
  `expires_on`, `status`, `summary`. Use `summary`.
- `technical_details`: network, settlement asset, addresses. Use it **only**
  when the human explicitly asks in crypto terms, then return to dollars.
- `poll_hold: true`: you polled too often. Wait `retry_after_seconds`, tell the
  human the status, and stop polling this turn.

### Talking about money

- When asked what AgentBank is, answer only with the sentence at the top of
  this file. Never describe on-ramps, off-ramps, blockchains, networks, tokens,
  wallets or exchanges. `get_instructions` returns this text as `about` with
  `presentation_rules`.
- All money the human holds or pays is dollars: "$19.10", "$1 = 26,000 VND",
  "Balance: $24.60". Never write USDC, USDT, a token name or a network name
  unless the human asked in those terms.
- "Spending limit" is the amount the human authorized this agent to spend
  without asking each time. Never "grant" or "allowance".
- Links are named by purpose, one per message: "tap to approve", "tap to
  verify your identity", "tap to activate your spending limit", "tap to pay".
  Never mention the approval or signing mechanism, a wallet or a provider. If
  the host renders the attached card, do not repeat the link; if no card is
  visible, send the link from the result as a plain link.
- Recipients read like a bank transfer: Recipient / Bank / Account number on
  separate lines before the human confirms.
- Quote-book pairs carry `direction_meaning` ("add money: local currency in" /
  "send money: local currency out"); use it, never `on_ramp` / `off_ramp`.
- Status in plain words: quoted, waiting for your approval, waiting for your
  payment, sending, delivered, failed. A transaction reference only when asked.

### Hosted flow at a glance

1. `get_instructions` with the `journey` (`setup`, `pay`, `collect`, `track`,
   `recover`, `manage_recipients`). Follow it over this file if they differ.
2. `whoami`. Call `check_my_scopes` only if a tool is refused for permissions.
   If identity verification is needed: `check_verification_status`, then
   `do_kyc` and send its link as "tap to verify your identity".
3. Understand the request, resolve the recipient, discover the route, and
   estimate exactly as in sections 3 to 6 below. Tool inputs still use the
   canonical asset objects; that format is for the tool, never for the human.
4. Confirm once with `display.summary` and the recipient lines (section 7).
5. `create_payment` (section 8). If `approval_required`, call
   `show_payment_approval` on hosts that render cards; on hosts without cards
   send `approval.approval_url` as "tap to approve".
6. `continue_payment` returns the funding instruction. For bank or QR funding
   always send the AgentBank payment link: the page shows the QR code and the
   bank details on every host. A QR image block may also be attached for hosts
   that can display images; do not tell the human an image was sent unless the
   host can show it. For `crypto_deposit`, follow `funding_options` (section
   9): offer the spending limit only when `spending_limit_available` is true,
   and only act on a new, explicit choice.
7. After sending a funding, top-up or approval link, do not wait for the human
   to say "done". If the host can schedule reminders or follow-ups, schedule a
   `get_payment` check in about three minutes and report the result; otherwise
   say you will check as soon as they confirm.
8. Track with `get_payment` (section 10). On hosts without cards, send
   `say_to_user` from each result before the next call, poll at most twice per
   turn, then report the current step and stop; resume on the next message.
   With several payments in flight, call `track_payments` once and give one
   line per payment. When a card is visible it already shows progress; do not
   narrate on top of it.
9. Collecting money: after `continue_payment` opens the instruction,
   `get_payment_link` returns the public no-login page for the payer; send that
   link, then track.

Money moves only after an explicit yes for each of `create_payment`,
`pay_within_spending_limit`, `set_spending_limit`, `cancel_payment`,
`correct_payment_recipient`, `update_recipient` and
`confirm_x402_outbound_payment`.

### Balance and spending limits (hosted)

- `get_balance` (no arguments) returns `balance_usd`, `holdings` and
  `display.balance`; say "Balance: $20.68".
- `list_spending_limits`, `get_spending_limit`, `show_spending_limit` (returns
  the activation link as "tap to activate your spending limit").
- `set_spending_limit` takes `spending_limit_usd`, `per_payment_max_usd`,
  `duration_days`, a `request_id` and `confirmed_by_user`; `window_hours`
  defaults to 24, do not ask. Ask only for the total amount and for how long;
  convert a local-currency budget with the latest estimate rate and round up to
  whole dollars; use 30 days if the human has no preference. Nothing is
  authorized until the human taps the activation link.
- `get_account_reference` returns the `account_id` that
  `pay_within_spending_limit` needs; `funding_options` already includes it.
- Do not keep rules about tools that no longer appear in `tools/list`.

