# Runtime Smoke Device Report

- CI gate input file:
  - `docs/runtime-smoke/runtime-smoke-report.device.json`
- Update policy:
  - replace this file with the latest `RuntimeSmokeRunner` JSON output from a device build before opening/refreshing a PR.
  - keep `generated_at` recent (CI checks max age).

Recommended command after pulling a report from device storage:
```bash
cp <device_report_path>/runtime-smoke-report.json docs/runtime-smoke/runtime-smoke-report.device.json
```
