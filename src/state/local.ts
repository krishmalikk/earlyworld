import { create } from 'zustand';
// No Firestore documents or remote collections live in this store.
export const useLocal = create<{
  uid: string | null;
  authReady: boolean;
  playingTrackId: string | null;
  setAuth: (uid: string | null) => void;
  setPlaying: (id: string | null) => void;
}>((set) => ({
  uid: null,
  authReady: false,
  playingTrackId: null,
  setAuth: (uid) => set({ uid, authReady: true, playingTrackId: null }),
  setPlaying: (playingTrackId) => set({ playingTrackId }),
}));
