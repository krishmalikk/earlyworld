import React, { createContext, useContext, useMemo } from 'react';
import { collection } from '@react-native-firebase/firestore';
import { db } from '../lib/firebase';
import { useCollection } from './listeners';
import type { Entity, Track } from './types';
const Context = createContext<{
  tracks: Track[];
  artists: Entity[];
  producers: Entity[];
  loading: boolean;
  error: string | null;
}>({ tracks: [], artists: [], producers: [], loading: true, error: null });
export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const refs = useMemo(
    () => ({
      tracks: collection(db, 'tracks'),
      artists: collection(db, 'artists'),
      producers: collection(db, 'producers'),
    }),
    [],
  );
  const tracks = useCollection<Track>(refs.tracks),
    artists = useCollection<Entity>(refs.artists),
    producers = useCollection<Entity>(refs.producers);
  return (
    <Context.Provider
      value={{
        tracks: tracks.data,
        artists: artists.data,
        producers: producers.data,
        loading: tracks.loading,
        error: tracks.error || artists.error || producers.error,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useCatalog = () => useContext(Context);
