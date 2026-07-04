import { create } from "zustand";
import { apiFetch, tokens } from "../lib/api";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  async init() {
    if (!tokens.access) {
      set({ loading: false });
      return;
    }
    try {
      const user = await apiFetch<User>("/users/me");
      set({ user, loading: false });
    } catch {
      tokens.clear();
      set({ user: null, loading: false });
    }
  },
  async login(email, password) {
    const res = await apiFetch<{ accessToken: string; refreshToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    tokens.set(res.accessToken, res.refreshToken);
    const user = await apiFetch<User>("/users/me");
    set({ user });
  },
  async register(name, email, password) {
    const res = await apiFetch<{ accessToken: string; refreshToken: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    tokens.set(res.accessToken, res.refreshToken);
    const user = await apiFetch<User>("/users/me");
    set({ user });
  },
  logout() {
    tokens.clear();
    set({ user: null });
  },
}));
