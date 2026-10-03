import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Briefcase, Heart, House, LocateFixed, MapPin, Plus, Trash2 } from 'lucide-react-native';
import { Button, IconButton } from '../../components/ui/Button';
import { Card, Divider, Field, ListRow, SectionHeader, Segmented } from '../../components/ui/primitives';
import { Header, Screen, useToast } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { Place } from '../../data/places';
import { resolveHit, SearchHit, searchPlaces } from '../../lib/geocode';
import { useLocation } from '../../lib/location';
import { useCountry } from '../../lib/country';
import { useT } from '../../i18n';
import { useSavedPlaces } from '../../lib/savedPlaces';
import { useApp } from '../../store/AppStore';
import { colors, space } from '../../theme/tokens';

type Kind = 'home' | 'work' | 'favorite';
const ICON = { home: House, work: Briefcase, favorite: Heart } as const;

export default function SavedPlaces() {
  const { startQuote } = useApp();
  const toast = useToast();
  const t = useT();
  const { here, status } = useLocation();
  const { code: countryCode } = useCountry();
  const { places, save, remove, loading } = useSavedPlaces();
  const params = useLocalSearchParams<{ add?: string }>();
  const initial = params.add === 'home' || params.add === 'work' || params.add === 'favorite' ? (params.add as Kind) : null;

  const [adding, setAdding] = useState(!!initial);
  const [kind, setKind] = useState<Kind>(initial ?? 'favorite');
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) {
      setResults([]);
      setSearching(false); // otherwise the spinner stays on after deleting characters
      return;
    }
    setSearching(true);
    let alive = true;
    const t = setTimeout(async () => {
      const r = await searchPlaces(text, here);
      if (alive) {
        setResults(r.slice(0, 5));
        setSearching(false);
      }
    }, 650);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  const go = (p: Place) => {
    startQuote(p);
    router.push('/passenger/ride');
  };

  const commit = async (hit: SearchHit) => {
    if (kind === 'favorite' && !name.trim()) {
      toast(t('pax.saved.nameRequired'), 'warning');
      return;
    }
    setBusy(true);
    try {
      const p = await resolveHit(hit);
      if (!p) throw new Error(t('pax.saved.addressNotFound'));
      await save(kind, p, kind === 'favorite' ? name.trim() : undefined);
      toast(t('pax.saved.savedToast', { name: kind === 'home' ? t('common.home') : kind === 'work' ? t('common.work') : name.trim() }));
      setAdding(false);
      setName('');
      setQuery('');
    } catch (e) {
      toast(e instanceof Error ? e.message : t('pax.saved.saveError'), 'warning');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<Header title={t('pax.saved.title')} subtitle={t('pax.saved.subtitle')} large />}>
      {places.length ? (
        <Card padded={false} style={{ paddingHorizontal: space[4] }}>
          {places.map((p, i) => {
            const Icon = ICON[p.kind as keyof typeof ICON] ?? MapPin;
            return (
              <View key={p.id}>
                {i ? <Divider inset={54} /> : null}
                <ListRow
                  icon={Icon}
                  iconBg={p.kind === 'home' ? colors.midnight : undefined}
                  iconColor={p.kind === 'home' ? colors.lime : undefined}
                  title={p.label ?? p.name}
                  subtitle={[p.address, p.area].filter(Boolean).join(' · ')}
                  onPress={() => go(p)}
                  chevron={false}
                  right={
                    <IconButton
                      icon={Trash2}
                      label={t('pax.saved.delete', { name: p.label ?? p.name })}
                      tone="clear"
                      size={36}
                      onPress={async () => {
                        await remove(p.id);
                        toast(t('pax.saved.deleted'), 'info');
                      }}
                    />
                  }
                />
              </View>
            );
          })}
        </Card>
      ) : (
        <Txt v="body" color={colors.inkMuted}>
          {loading ? t('common.loading') : t('pax.saved.empty')}
        </Txt>
      )}

      <SectionHeader title={t('pax.saved.newPlace')} style={{ marginTop: space[6] }} />
      {adding ? (
        <Card style={{ gap: space[4] }}>
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: 'home', label: t('common.home') },
              { value: 'work', label: t('common.work') },
              { value: 'favorite', label: t('pax.saved.other') },
            ]}
          />
          {kind === 'favorite' ? <Field label={t('common.name')} placeholder={t('pax.saved.namePh')} value={name} onChangeText={setName} /> : null}
          <Field
            label={t('pax.saved.searchAddress')}
            placeholder={t('pax.saved.searchAddressPh', { example: countryCode === 'CW' ? 'Breedestraat 12, Punda' : 'Carrera 8 #20-15, Pereira' })}
            value={query}
            onChangeText={setQuery}
          />
          {searching ? <ActivityIndicator color={colors.inkMuted} /> : null}
          {results.map((r) => (
            <ListRow key={r.id} icon={MapPin} title={r.name} subtitle={[r.address, r.area].filter(Boolean).join(' · ')} onPress={() => !busy && commit(r)} />
          ))}
          {status === 'granted' ? (
            <Button
              label={t('pax.saved.useCurrent')}
              icon={LocateFixed}
              variant="outline"
              loading={busy}
              onPress={() => commit({ ...here, id: 'here', name: here.address || t('pax.saved.myLocation') })}
            />
          ) : null}
          <Button label={t('common.cancel')} variant="ghost" onPress={() => setAdding(false)} />
        </Card>
      ) : (
        <Button label={t('pax.saved.add')} icon={Plus} variant="outline" onPress={() => setAdding(true)} />
      )}
      <Txt v="caption" color={colors.inkMuted} style={{ marginTop: space[4] }}>
        {t('pax.saved.privacy')}
      </Txt>
    </Screen>
  );
}
