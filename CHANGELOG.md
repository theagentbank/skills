# Changelog

All notable user-visible changes are recorded here.

This project follows [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-09-27

### Changed

- **Breaking:** the skill is now generated from the AgentBank backend file
  published at https://useagentbank.com/SKILL.md (served from
  https://protocol.agentbank.world/SKILL.md) instead of being hand-written here.
  `skills/agentbank-pay/SKILL.md` keeps the backend core sections in place;
  other sections move unchanged into `references/` (new `hosted.md` and
  `x402.md`) behind generated pointer lines, per `skill-layout.json`.
- `dist/agentbank-pay/SKILL.md` is now the backend file byte for byte and is no
  longer limited to 500 lines.
- `protocol-core-sync.json` records `source_url`, `source_sha256`, and
  `imported_at` instead of a protocol-core commit.
- `check:public-skill` compares https://useagentbank.com/SKILL.md with the
  imported bytes; the manifest check is gone.

### Added

- `npm run import:backend` / `check:backend` and an hourly import workflow that
  opens a pull request when the backend changes.

### Removed

- The reverse sync flows to protocol-core and the landing page
  (`sync:protocol-core`, `sync:landing-page`, and the landing publish workflow).

## [1.8.0] - 2026-09-27

### Added

- Added the audited `agent-bank-mcp@0.1.37` contract with the public
  `discover_x402_services` catalog tool.

### Changed

- Updated the backend synchronization marker to Protocol Core `0725a86`.

## [1.7.0] - 2026-09-22

### Added

- Added remote HTTP/OAuth guidance for consumer presentation, hosted funding
  links, account references, and spending-limit funding.

### Changed

- Synced the backend development baseline through its public x402 directory
  and hosted payment-presentation changes while preserving the audited local
  `agent-bank-mcp@0.1.33` 45-tool contract.

## [1.6.0] - 2026-09-17

### Changed

- Synced the local MCP contract to `agent-bank-mcp@0.1.32` and its audited
  45-tool production catalog.
- Removed the retired `get_ramp_quote` workflow; live routes now use quote-book
  discovery and `estimate_payment`.
- Added collection journey routing, estimate-reuse rules, and terminal
  `funding_timeout` recovery guidance.

## [1.5.0] - 2026-08-30

### Changed

- Synced the payment contract to `agent-bank-mcp@0.1.27` from Protocol Core
  development and documented USDT on BNB Smart Chain (`bsc`) alongside the
  existing World Chain assets.
- Require live capability and currency discovery before selecting an
  asset-and-chain pair, including the shared-wallet on-ramp destination.
- Added the four-tool, server-owned x402 outbound-payment lifecycle.
- Removed the unavailable `get_supported_bank_names` call from production
  guidance; bank names remain Core-validated on recipient creation.

## [1.4.0] - 2026-08-24

### Added

- Added the five-tool payment-plan workflow for grouping multiple independent
  payments under one reviewed World ID approval.
- Added terminal pre-funding expiry recovery and richer timeline guidance.

### Changed

- Updated the release contract to `agent-bank-mcp@0.1.25` and its exact
  43-tool production catalog.
- Replaced public fiat `bank_code` input guidance with quote-driven
  `payment_instrument` and human-confirmed `bank_name` handling.
- Updated onboarding recovery, Linux vault security, on-ramp-first World ID
  behavior, approval cancellation, and owner-scoped sibling recovery.
- Kept the live MCP gate strict across the `0.1.24` to `0.1.25` rollout and
  documented safe bank-name handling before the discovery tool is available.

## [1.3.0] - 2026-08-06

### Changed

- Added quote-driven fiat recipient instruments and field requirements from the
  merged AgentBank MCP 0.1.19 contract.
- Updated the latest-package installation and release gate for the 0.1.19
  contract.

## [1.2.0] - 2026-08-06

### Changed

- Updated setup and smoke verification to the audited `agent-bank-mcp@0.1.17`
  credential-vault release.
- Added same-client post-restart onboarding verification and recovery guidance
  that prevents duplicate installations when local credential storage fails.
- Published the deterministic per-profile vault and managed-storage guidance in
  the canonical and single-file compatibility skill.

## [1.1.1] - 2026-08-06

### Changed

- Made the public single-file skill self-contained: it now uses inspect-first
  Codex and Claude Code setup commands rather than referring to an unavailable
  local bootstrap script.
- Removed duplicated setup content from the compatibility artifact and kept it
  within the Agent Skills progressive-disclosure size recommendation.
- Recorded public-skill releases as immutable version labels instead of a
  mutable branch name when the landing sync runs manually.

## [1.1.0] - 2026-08-04

### Added

- Per-installation World ID approval-policy guidance and tool-catalog checks.
- Quote-unavailable recovery using executable quote-book bands and fees.
- Protocol-core drift tracking and clean-install smoke tests.
- Support, security, and contributor documentation for public distribution.

### Changed

- Estimates are recipient-free; the selected recipient is supplied once to
  `create_payment.destination` after route review.
- Public payment hops contain route data only; MCP injects recipient plumbing.
- Recipient guidance covers bank-name canonicalization and the system-created
  human-owner-scoped default Privy wallet recipient.
- World ID behavior follows the current installation policy and returned
  payment status instead of assuming a universal threshold.
- The supported Node.js floor is 22.20 to match the current Skills CLI.
- Explicit compatible endpoint configurations now use
  `https://app.agentbank.world` instead of the retired staging app domain.

## [1.0.0] - 2026-07-30

### Added

- Initial `agentbank-pay` skill for Codex, Claude Code, and Hermes.
- Conflict-safe MCP bootstrap, modular workflow references, deterministic
  legacy export, and automated validation.
