## Summary
- What changed in this PR?
- Why this change is needed?

## Validation
- List key local commands and outcomes.
- Example:
  - `npm run ci:pr` (pass)

## Runtime Smoke / LiveOps Gate
- [ ] Updated `docs/runtime-smoke/runtime-smoke-report.device.json` with latest device output from `RuntimeSmokeRunner`.
- [ ] Confirmed `generated_at` in device report is recent (CI enforces max age).
- [ ] Ran `npm run check:unity-liveops -- --input docs/runtime-smoke/runtime-smoke-report.device.json --max-age-days 14 --strict`.
- [ ] If this PR is urgent hotfix, added `hotfix` label and validated with `npm run ci:pr:hotfix` (30-day freshness policy).

## Risk & Rollback
- Main risk:
- Rollback plan:

## Notes
- If runtime smoke report was not updated in this PR, explain why:
