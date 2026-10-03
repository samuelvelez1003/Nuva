import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, Href } from 'expo-router';
import { Bell, Camera, Car, CircleHelp, Globe, Heart, Image as ImageIcon, LogOut, MapPin, ShieldCheck, Star, Wallet } from 'lucide-react-native';
import { Button, Tap } from '../../../components/ui/Button';
import { LanguagePicker } from '../../../components/ui/LanguagePicker';
import { Avatar, Card, Chip, Divider, ListRow, Row, SectionHeader } from '../../../components/ui/primitives';
import { pickAndUploadAvatar } from '../../../lib/avatar';
import { useCountry } from '../../../lib/country';
import { Header, Screen, useToast } from '../../../components/ui/Screen';
import { Txt } from '../../../components/ui/Txt';
import { PASSENGER } from '../../../data/mock';
import { useT } from '../../../i18n';
import { useSavedPlaces } from '../../../lib/savedPlaces';
import { useApp } from '../../../store/AppStore';
import { useAuth } from '../../../store/Auth';
import { colors, radius, space } from '../../../theme/tokens';

/** "Valentina Ríos" → "VR"; empty when there's no name (caller supplies the fallback). */
const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

const prettyPhone = (p?: string | null) => (p && p.length === 10 ? `+57 ${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}` : p ?? '');

/** Profile photo: tap to choose one from the gallery or take it with the camera. */
function AvatarPicker({ name }: { name: string }) {
  const auth = useAuth();
  const toast = useToast();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const pick = async (source: 'library' | 'camera') => {
    if (!auth.session) return;
    setOpen(false);
    setBusy(true);
    try {
      const url = await pickAndUploadAvatar(auth.session.user.id, source);
      if (url) {
        await auth.refreshProfile();
        toast(t('pax.profile.photoUpdated'));
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : t('pax.profile.photoError'), 'warning');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Tap onPress={() => setOpen((o) => !o)} accessibilityLabel={t('pax.profile.changePhoto')} disabled={busy}>
        <Avatar initials={initialsOf(name) || t('common.youInitials')} size={92} bg={colors.midnight} fg={colors.lime} image={auth.profile?.avatar_url} />
        <View style={{ position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.lime, borderWidth: 3, borderColor: colors.ivory100, alignItems: 'center', justifyContent: 'center' }}>
          {busy ? <ActivityIndicator size="small" color={colors.midnight} /> : <Camera size={14} color={colors.midnight} strokeWidth={2.4} />}
        </View>
      </Tap>
      {open ? (
        <Row style={{ gap: 8, marginTop: space[3] }}>
          <Chip label={t('pax.profile.fromGallery')} icon={ImageIcon} onPress={() => pick('library')} />
          <Chip label={t('pax.profile.takePhoto')} icon={Camera} onPress={() => pick('camera')} />
        </Row>
      ) : null}
    </View>
  );
}

type ProfileRow = { key: string; icon: typeof Bell; title: string; subtitle?: string; href?: string; onPress?: () => void; right?: React.ReactNode };

export default function PassengerProfile() {
  const { signOut: demoSignOut, passengerTrips } = useApp();
  const auth = useAuth();
  const { places } = useSavedPlaces();
  const { country } = useCountry();
  const toast = useToast();
  const t = useT();
  const live = auth.live && !!auth.profile;
  const done = passengerTrips.filter((tr) => tr.status === 'completado').length;

  const name = live ? auth.profile!.full_name || t('pax.profile.defaultName') : `${PASSENGER.firstName} ${PASSENGER.lastName}`;
  const phone = live ? prettyPhone(auth.profile!.phone) || auth.profile!.email || '' : PASSENGER.phone;
  const rating = live ? auth.profile!.rating ?? 5 : PASSENGER.rating;
  const trips = live ? done : PASSENGER.trips + done - 11;

  const savedSubtitle = live
    ? places.length
      ? t(places.length === 1 ? 'pax.profile.placesOne' : 'pax.profile.placesMany', { n: places.length })
      : t('pax.profile.addHomeWork')
    : t('pax.profile.savedDemo');

  const rows: ProfileRow[][] = [
    [
      { key: 'saved', icon: MapPin, title: t('pax.saved.title'), subtitle: savedSubtitle, href: '/passenger/saved' },
      { key: 'payments', icon: Wallet, title: t('pax.profile.payments'), subtitle: country.web.paymentNames.join(', '), href: '/passenger/wallet' },
      { key: 'safety', icon: ShieldCheck, title: t('common.safetyCenter'), subtitle: t('pax.profile.safetySub'), href: '/passenger/safety' },
    ],
    [
      { key: 'notifications', icon: Bell, title: t('common.notifications'), subtitle: t('pax.profile.notificationsSub'), onPress: () => toast(t('pax.profile.prefsSaved'), 'info') },
      // Language: ES · EN · PAP switch, applied immediately and remembered on the device.
      { key: 'language', icon: Globe, title: t('pax.profile.language'), right: <LanguagePicker tone="light" compact /> },
      { key: 'help', icon: CircleHelp, title: t('pax.profile.help'), subtitle: t('common.writeUsAnytime'), href: '/passenger/help' },
    ],
  ];

  return (
    <Screen header={<Header title={t('common.profile')} back={false} />} contentStyle={{ paddingBottom: 140 }}>
      <View style={{ alignItems: 'center', paddingTop: space[2] }}>
        {live ? (
          <AvatarPicker name={name} />
        ) : (
          <Avatar initials={initialsOf(name) || t('common.youInitials')} size={92} bg={colors.midnight} fg={colors.lime} />
        )}
        <Txt v="h1" style={{ marginTop: space[4] }} align="center">
          {name}
        </Txt>
        <Txt v="body" color={colors.inkMuted}>
          {phone}
        </Txt>
      </View>

      <Row style={{ marginTop: space[6], gap: 8 }}>
        {[
          { key: 'rating', icon: Star, value: rating.toFixed(2).replace('.', ','), label: t('pax.profile.yourRating') },
          { key: 'trips', icon: Heart, value: `${trips}`, label: t('common.trips') },
        ].map((s) => (
          <View key={s.key} style={{ flex: 1, padding: 14, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineLight }}>
            <s.icon size={16} color={colors.inkMuted} />
            <Txt v="h3" tabular style={{ marginTop: 10 }}>
              {s.value}
            </Txt>
            <Txt v="caption" color={colors.inkMuted}>
              {s.label}
            </Txt>
          </View>
        ))}
      </Row>

      {rows.map((group, gi) => (
        <View key={gi} style={{ marginTop: space[6] }}>
          {gi === 1 ? <SectionHeader title={t('pax.profile.preferences')} /> : null}
          <Card padded={false} style={{ paddingHorizontal: space[4] }}>
            {group.map((r, i) => (
              <View key={r.key}>
                {i ? <Divider inset={54} /> : null}
                <ListRow
                  icon={r.icon}
                  title={r.title}
                  subtitle={r.subtitle}
                  right={r.right}
                  chevron={!r.right}
                  onPress={r.href ? () => router.push(r.href as Href) : r.onPress}
                />
              </View>
            ))}
          </Card>
        </View>
      ))}

      {/* Passenger and driver are separate accounts: a real passenger never jumps into driver mode. */}
      {live ? null : (
        <Card tone="dark" style={{ marginTop: space[6] }}>
          <Row style={{ gap: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
              <Car size={20} color={colors.midnight} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt v="title" color={colors.ivory}>
                {t('pax.profile.driveTitle')}
              </Txt>
              <Txt v="small" color={colors.onDarkMuted}>
                {t('pax.profile.driveBody')}
              </Txt>
            </View>
          </Row>
          <Button label={t('pax.profile.openDriver')} size="md" style={{ marginTop: space[4] }} onPress={() => router.push('/driver')} />
        </Card>
      )}

      <Button
        label={t('common.signOut')}
        icon={LogOut}
        variant="ghost"
        style={{ marginTop: space[4] }}
        onPress={async () => {
          if (live) await auth.signOut();
          demoSignOut();
          // Back to the start, where one chooses how to use NÜVA.
          router.replace('/');
        }}
      />
      <Txt v="caption" color={colors.inkMuted} align="center">
        {t('pax.profile.version', { version: '1.0.0', city: country.web.footer })}
      </Txt>
    </Screen>
  );
}
