export default {
  extends: ['stylelint-config-recommended'],
  rules: {
    // CSS intentionally uses later responsive/accessibility overrides in the cascade.
    // Reordering or combining them would alter rendering; keep all other error checks.
    'no-descending-specificity': null,
    'no-duplicate-selectors': null,
  },
};
