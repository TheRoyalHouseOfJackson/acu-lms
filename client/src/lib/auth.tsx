import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";

export type AuthUser = { id: number; email: string; name: string; role: string };

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/auth/me");
        return await res.json();
      } catch {
        return null;
      }
    },
    staleTime: Infinity,
  });

  const login = async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const u = await res.json();
    queryClient.setQueryData(["/api/auth/me"], u);
    await queryClient.invalidateQueries();
    return u as AuthUser;
  };

  const signup = async (name: string, email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/signup", { name, email, password });
    const u = await res.json();
    queryClient.setQueryData(["/api/auth/me"], u);
    await queryClient.invalidateQueries();
    return u as AuthUser;
  };

  const logout = async () => {
    await apiRequest("POST", "/api/auth/logout", {});
    queryClient.setQueryData(["/api/auth/me"], null);
    await queryClient.invalidateQueries();
  };

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
