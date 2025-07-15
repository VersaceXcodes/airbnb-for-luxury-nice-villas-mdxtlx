// src/store/main.tsx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios, { AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';

// ─────────────────────────────────────────────
// General types matching backend verbatim
// ─────────────────────────────────────────────
export type UserRole = 'guest' | 'host' | 'admin';
export interface AuthUser {
  id: string;          // ulid
  email: string;
  role: UserRole;
  verified: boolean;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

export type ScreenSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export interface NotificationItem {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  body: string;
  auto_close?: number;
}
export interface ApiError {
  error: string;
  code: string;
}

// ─────────────────────────────────────────────
// State model
// ─────────────────────────────────────────────
interface GlobalStore {
  // ─ auth & session
  auth_user: AuthUser | null;
  access_token: string | null;
  set_auth_user: (payload: { user: AuthUser; token: string }) => void;
  clear_auth_user: () => void;
  // ─ UI
  screen_size: ScreenSize;
  set_screen_size: (val: ScreenSize) => void;
  notifications: NotificationItem[];
  push_notification: (item: Omit<NotificationItem, 'id'>) => void;
  pop_notification: (id: string) => void;
  // ─ external scripts / sockets
  stripe_script_loaded: boolean;
  mark_stripe_loaded: () => void;
  ws_socket: Socket | null;
  open_ws_connection: () => void;
  close_ws_connection: () => void;
  // Axios (volatile)
  api_client: AxiosInstance;
}

// ─────────────────────────────────────────────
// LocalBaseURL helper
// ─────────────────────────────────────────────
const api_base_url =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3000';

// ─────────────────────────────────────────────
// Store factory
// ─────────────────────────────────────────────
export const use_app_store = create<GlobalStore>()(
  persist(
    (set, get) => ({
      // defaults
      auth_user: null,
      access_token: null,
      screen_size: 'lg',
      notifications: [],
      stripe_script_loaded: false,
      ws_socket: null,

      // Axios instance – non-persisted
      api_client: axios.create({
        baseURL: api_base_url,
        timeout: 30_000,
        headers: { 'Content-Type': 'application/json' },
      }),

      // ── AUTH --------------------------------------------------
      set_auth_user: ({ user, token }) => {
        set({ auth_user: user, access_token: token });
        const client = get().api_client;
        client.interceptors.request.clear();
        client.interceptors.request.use((cfg) => {
          cfg.headers.Authorization = token ? `Bearer ${token}` : cfg.headers.Authorization;
          return cfg;
        });
      },
      clear_auth_user: () => {
        set({ auth_user: null, access_token: null });
        get().api_client.interceptors.request.clear();
        get().close_ws_connection(); // drop socket on logout
      },

      // ── UI ----------------------------------------------------
      set_screen_size: (val) => set({ screen_size: val }),
      push_notification: (item) => {
        const id = self.crypto.randomUUID();
        set((state) => ({
          notifications: [...state.notifications, { ...item, id }],
        }));
      },
      pop_notification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      // ── STRIPE ------------------------------------------------
      mark_stripe_loaded: () => set({ stripe_script_loaded: true }),

      // ── SOCKET.IO real-time -----------------------------------
      open_ws_connection: () => {
        if (get().ws_socket?.connected || !get().access_token) return;
        const socket = io(api_base_url, {
          auth: { token: get().access_token },
          transports: ['websocket'],
        });
        set({ ws_socket: socket });
      },
      close_ws_connection: () => {
        get().ws_socket?.disconnect();
        set({ ws_socket: null });
      },
    }),
    {
      name: 'estates_global_store_v1',
      partialize: (state) =>
        // Exclude volatile members
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) =>
              !['api_client', 'ws_socket'].includes(key),
          ),
        ),
    },
  ),
);