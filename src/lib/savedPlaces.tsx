import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Place } from '../data/places';
import { useAuth } from '../store/Auth';
import { supabase } from './supabase';

/** The signed-in passenger's saved places (Casa, Trabajo, favourites) from Supabase. */

interface SavedRow {
  id: string;
  kind: 'home' | 'work' | 'favorite';
  label: string;
  name: string;
  address: string | null;
  area: string | null;
  lat: number;
  lng: number;
}

interface SavedState {
  places: Place[];
  home?: Place;
  work?: Place;
  favorites: Place[];
  save: (kind: 'home' | 'work' | 'favorite', place: Place, label?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  loading: boolean;
}

const Ctx = createContext<SavedState | null>(null);

const toPlace = (r: SavedRow): Place => ({
  id: r.id,
  kind: r.kind,
  label: r.label,
  name: r.name,
  address: r.address ?? '',
  area: r.area ?? '',
  lat: r.lat,
  lng: r.lng,
});

export function SavedPlacesProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !session) {
      setPlaces([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from('saved_places').select('*').order('created_at');
    setPlaces(((data as SavedRow[]) ?? []).map(toPlace));
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (kind: 'home' | 'work' | 'favorite', p: Place, label?: string) => {
      if (!supabase || !session) throw new Error('Inicia sesión para guardar lugares');
      const row = { kind, label: label ?? (kind === 'home' ? 'Casa' : kind === 'work' ? 'Trabajo' : p.name), name: p.name, address: p.address, area: p.area, lat: p.lat, lng: p.lng };
      // Home/work are unique per user: replace the previous one.
      if (kind !== 'favorite') await supabase.from('saved_places').delete().eq('kind', kind);
      const { error } = await supabase.from('saved_places').insert(row);
      if (error) throw new Error(error.message);
      await load();
    },
    [session, load],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!supabase) return;
      await supabase.from('saved_places').delete().eq('id', id);
      await load();
    },
    [load],
  );

  return (
    <Ctx.Provider
      value={{
        places,
        home: places.find((p) => p.kind === 'home'),
        work: places.find((p) => p.kind === 'work'),
        favorites: places.filter((p) => p.kind === 'favorite'),
        save,
        remove,
        loading,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSavedPlaces() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSavedPlaces must be used inside SavedPlacesProvider');
  return v;
}
