import { useAuth } from "./useAuth";

export function useCanEdit() {
  const { user } = useAuth();
  return user?.adminRole === "full" || user?.adminRole === "basic";
}
