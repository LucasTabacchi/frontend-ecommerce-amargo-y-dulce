export type AddToCartAuthDecision =
  | "auth-loading"
  | "login-required"
  | "store-admin-blocked"
  | "allowed";

export function getAddToCartAuthDecision({
  authResolved,
  user,
}: {
  authResolved: boolean;
  user: any | null | undefined;
}): AddToCartAuthDecision {
  if (!authResolved) return "auth-loading";
  if (!user) return "login-required";
  if (user?.isStoreAdmin === true) return "store-admin-blocked";
  return "allowed";
}
