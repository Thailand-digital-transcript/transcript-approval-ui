import { availableGates, gateForRoles } from './roles';

test('registrar role resolves to PENDING_REGISTRAR', () => {
  expect(gateForRoles(['registrar'])).toBe('PENDING_REGISTRAR');
});

test('dean role resolves to PENDING_DEAN', () => {
  expect(gateForRoles(['dean'])).toBe('PENDING_DEAN');
});

test('both roles expose both gates in registrar-then-dean order', () => {
  expect(availableGates(['registrar', 'dean'])).toEqual([
    'PENDING_REGISTRAR',
    'PENDING_DEAN',
  ]);
  // And the primary gate still prefers registrar when both are present.
  expect(gateForRoles(['registrar', 'dean'])).toBe('PENDING_REGISTRAR');
});

test('no matching role resolves to null', () => {
  expect(gateForRoles([])).toBeNull();
  expect(gateForRoles(['auditor'])).toBeNull();
  expect(availableGates(['auditor'])).toEqual([]);
});
