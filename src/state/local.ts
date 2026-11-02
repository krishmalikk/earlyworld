import { create } from 'zustand';
// No Firestore documents or remote collections live in this store.
export const useLocal = create<{
  uid: string | null;
  authReady: boolean;
  pendingPostId: string | null;
  /** Set once by onboarding so Feed can greet a brand-new account. */
  welcome: boolean;
  setPendingPostId: (id: string | null) => void;
  setWelcome: (welcome: boolean) => void;
  setAuth: (uid: string | null) => void;
}>((set) => ({
  uid: null,
  authReady: false,
  pendingPostId: null,
  welcome: false,
  setPendingPostId: (pendingPostId) => set({ pendingPostId }),
  setWelcome: (welcome) => set({ welcome }),
  setAuth: (uid) => set({ uid, authReady: true, welcome: false }),
}));
