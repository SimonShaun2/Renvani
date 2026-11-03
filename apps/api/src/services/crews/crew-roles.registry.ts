/** FS-195 — crew member roles are text + an app-level registry (no pgEnum). */
const crewMemberRoles = new Set<string>(["lead", "member"]);

export function registerCrewMemberRole(role: string): void {
  if (!/^[a-z][a-z0-9_]{0,31}$/u.test(role)) throw new Error(`Invalid crew member role: ${role}`);
  crewMemberRoles.add(role);
}

export function isCrewMemberRole(role: string): boolean {
  return crewMemberRoles.has(role);
}

export function listCrewMemberRoles(): string[] {
  return [...crewMemberRoles];
}
