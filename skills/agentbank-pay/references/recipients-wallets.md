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
