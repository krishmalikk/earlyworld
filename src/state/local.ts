import { create } from 'zustand';
// No Firestore documents or remote collections live in this store.
export const useLocal = create<{
  uid: string | null;
  authReady: boolean;
  pendingPostId: string | null;
  setPendingPostId: (id:string|null)=>void;
  setAuth: (uid: string | null) => void;
}>((set) => ({
  uid: null,
  authReady: false,
  pendingPostId: null,
  setPendingPostId: pendingPostId=>set({pendingPostId}),
  setAuth: (uid) => set({ uid, authReady: true }),
}));
