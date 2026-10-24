import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Head from 'expo-router/head';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, Hourglass, XCircle } from 'lucide-react-native';
import { Wordmark } from '../components/brand/Brand';
import { Button } from '../components/ui/Button';
import { useStatusTone } from '../components/ui/Screen';
import { Txt } from '../components/ui/Txt';
import { TKey, useT } from '../i18n';
import { confirmWompi } from '../lib/wompi';
import { useApp } from '../store/AppStore';
import { useAuth } from '../store/Auth';
import { colors, space } from '../theme/tokens';

type State = 'checking' | 'paid' | 'pending' | 'failed' | 'signedOut' | 'missing';

const TEXT: Record<Exclude<State, 'checking'>, { title: TKey; body: TKey }> = {
  paid: { title: 'pago.paidTitle', body: 'pago.paidBody' },
  pending: { title: 'pago.pendingTitle', body: 'pago.pendingBody' },
  failed: { title: 'pago.failedTitle', body: 'pago.failedBody' },
  signedOut: { title: 'pago.signedOutTitle', body: 'pago.signedOutBody' },
  missing: { title: 'pago.missingTitle', body: 'pago.missingBody' },
};

/**
 * Wompi sends the passenger here after paying a card trip on the web
 * (/pago?trip=<trip id>&id=<Wompi transaction>). The server checks the transaction with
 * Wompi before marking the trip paid; this page only shows the answer.
 */
export default function CardPaymentReturn() {
  const t = useT();
  const { ready, session } = useAuth();
  const { ride, patchRide } = useApp();
  const { trip, id } = useLocalSearchParams<{ trip?: string; id?: string }>();
  const tripId = typeof trip === 'string' ? trip : '';
  const txId = typeof id === 'string' ? id : '';
  const [answer, setState] = useState<State>('checking');
  const [error, setError] = useState<string | null>(null);
  useStatusTone('light');

  const signedIn = !!session;
  // Static rendering has no query string: it shows "checking", never "missing".
  const missing = (!tripId || !txId) && typeof window !== 'undefined';
  // Only the server's answer is kept in state; the rest follows from the link and the session.
  const state: State = missing ? 'missing' : !ready ? 'checking' : !signedIn ? 'signedOut' : answer;
  useEffect(() => {
    if (missing || !ready || !signedIn) return;
    let alive = true;
    confirmWompi(tripId, txId)
      .then((r) => {
        if (!alive) return;
        setState(r.paid ? 'paid' : r.status === 'PENDING' ? 'pending' : 'failed');
        if (!r.paid && r.error) setError(r.error);
      })
      .catch((e) => {
        if (!alive) return;
        setState('failed');
        setError(e instanceof Error && e.message !== 'Wompi' ? e.message : null);
      });
    return () => {
      alive = false;
    };
  }, [tripId, txId, missing, ready, signedIn]);

  // The ride still open in this tab (no page reload): it shows the paid state at once.
  const sameRide = !!tripId && ride?.tripId === tripId;
  useEffect(() => {
    if (state === 'paid' && sameRide) patchRide({ paid: true });
  }, [state, sameRide, patchRide]);

  const Icon = state === 'paid' ? CheckCircle2 : state === 'pending' ? Hourglass : XCircle;
  const text = state === 'checking' ? null : TEXT[state];

  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[5] }}>
      <Head>
        <title>{t('pago.metaTitle')}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Wordmark height={28} color={colors.ivory} />
      {text ? (
        <>
          <View style={{ width: 88, height: 88, borderRadius: 30, backgroundColor: state === 'paid' ? colors.lime : colors.midnight600, alignItems: 'center', justifyContent: 'center', marginTop: space[6] }}>
            <Icon size={40} color={state === 'paid' ? colors.midnight : state === 'pending' ? colors.warning : colors.onDarkMuted} />
          </View>
          <Txt v="h1" align="center" color={colors.ivory}>
            {t(text.title)}
          </Txt>
          <Txt v="body" align="center" color={colors.onDarkMuted} style={{ maxWidth: 380 }}>
            {t(text.body)}
          </Txt>
          {error ? (
            <Txt v="small" align="center" color={colors.onDarkFaint} style={{ maxWidth: 380 }}>
              {error}
            </Txt>
          ) : null}
          <View style={{ gap: space[3], marginTop: space[3], alignItems: 'center' }}>
            {sameRide ? <Button label={t('pago.backToTrip')} full={false} onPress={() => router.replace('/passenger/ride')} /> : null}
            <Button
              label={signedIn ? t('pago.toTrips') : t('pago.openApp')}
              variant={sameRide ? 'outlineDark' : 'primary'}
              full={false}
              onPress={() => router.replace(signedIn ? '/passenger/trips' : '/')}
            />
          </View>
        </>
      ) : (
        <View style={{ alignItems: 'center', gap: space[4], marginTop: space[6] }}>
          <ActivityIndicator color={colors.lime} />
          <Txt v="body" align="center" color={colors.onDarkMuted}>
            {t('pago.checking')}
          </Txt>
        </View>
      )}
    </View>
  );
}
