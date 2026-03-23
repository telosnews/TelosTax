## What does this PR do?

Brief description of the change.

## Type of change

- [ ] Bug fix (calculation error, UI issue)
- [ ] Tax accuracy fix (cite IRS authority below)
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring (no behavior change)

## IRS authority (for tax changes)

If this changes a tax calculation, cite the authority:
- IRC section:
- Form/line:
- Revenue Procedure:

## Testing

- [ ] Added or updated tests
- [ ] All existing tests pass (`cd shared && npx vitest run`)
- [ ] Tested with relevant filing statuses

## Checklist

- [ ] Engine functions remain pure (no I/O, no side effects)
- [ ] No hardcoded constants in engine logic (use constants files)
- [ ] `round2()` used for all monetary calculations
- [ ] No real PII in test data
