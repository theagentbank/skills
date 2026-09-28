# Workflow changes for a maintainer to apply

These files belong in `.github/workflows/`. They are staged here because the
contributor's GitHub token could not push workflow changes (it lacked the
`workflow` scope). A maintainer with write access should, in the same commit
that merges this PR or right after it:

1. Move `docs/ci/import-backend-skill.yml` to `.github/workflows/import-backend-skill.yml`.
   It runs the backend import hourly, on `workflow_dispatch`, and on a
   `repository_dispatch` of type `backend-skill-updated`, then opens or updates
   an `automation/import-backend-skill` PR when the backend skill changed.
2. Replace `.github/workflows/validate.yml` with `docs/ci/validate.yml`. The new
   version adds a job that runs `node scripts/import-backend-skill.mjs --check`
   against the live backend (skip with the `AGENTBANK_SKIP_BACKEND_CHECK`
   repository variable).
3. Delete `.github/workflows/publish-landing-skill.yml`. It calls
   `npm run sync:landing-page`, which this PR removes; the landing site now
   serves the backend skill live, so the workflow has no job left.
4. Delete this `docs/ci/` folder.
5. In repository settings, enable "Allow GitHub Actions to create and approve
   pull requests" so the import workflow can open its PR.
