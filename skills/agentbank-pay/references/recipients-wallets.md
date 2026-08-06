# Recipients and wallets

## Saved recipients

Call `list_recipients`, reuse only a clear rail-and-fields match, and call
`get_recipient` for complete fields. Ask the human to choose if multiple
records match. `verified=false` alone does not make a recipient invalid.

## New recipient data

When the human elects to create a reviewed fiat payment, read that estimate's
`recipient_requirements`. Ask the human to choose exactly one listed
`payment_instrument`, then call `create_recipient` with that instrument and its
required fields before `create_payment`. Never infer an instrument from a QR,
bank fields, or weak context. Estimates remain recipient-free; use returned
`recipient_id` or canonical `recipient_fields` only in `create_payment.destination`.

The quote is authoritative: `qr` requires `country` and `qr_content`;
`bank_transfer` requires `country`, `bank_code`, `account_number`, and
`holder_name`; `mobile_money` requires `country`, `mobile_money_network_code`,
and `mobile_money_destination`. The mobile-money destination is opaque: do not
force E.164 or request a holder name unless the selected requirement requires it.
When `holder_name_must_match_kyc=true`, explain that the submitted name must
equal the user's verified KYC legal name; never request or disclose that name.

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
