/** One canonical owner home. /dashboard remains a protected compatibility redirect. */
export const OWNER_HOME_PATH = "/command-center" as const;
export const OWNER_HOME_ALIAS = "/dashboard" as const;

export function isOwnerHomePath(pathname: string): boolean {
  return pathname === OWNER_HOME_PATH || pathname === OWNER_HOME_ALIAS;
}
