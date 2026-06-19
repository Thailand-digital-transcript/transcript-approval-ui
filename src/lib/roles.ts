import type { BatchStatus } from '../types/batch';

/**
 * Resolve the gate (queue) a user belongs to from their role list.
 *
 * `registrar` wins when the user holds both roles, matching the orchestrator's
 * `CallerContext.gateFromRoles()` precedence. Dual-role users are an edge case
 * documented in the backend javadoc; the UI mirrors that precedence so the
 * single-queue landing path stays deterministic.
 */
export function gateForRoles(roles: string[]): BatchStatus | null {
  if (roles.includes('registrar')) return 'PENDING_REGISTRAR';
  if (roles.includes('dean')) return 'PENDING_DEAN';
  return null;
}

/**
 * List every gate the user is eligible to act on, in the canonical
 * `[registrar, dean]` order. Used by the queue page to render the
 * both-roles gate toggle.
 */
export function availableGates(roles: string[]): BatchStatus[] {
  const out: BatchStatus[] = [];
  if (roles.includes('registrar')) out.push('PENDING_REGISTRAR');
  if (roles.includes('dean')) out.push('PENDING_DEAN');
  return out;
}
