import React from 'react';
import { ScrollView, View } from 'react-native';
import { Href, Link, router } from 'expo-router';
import Head from 'expo-router/head';
import { ArrowUpRight } from 'lucide-react-native';
import { Aurora } from '../components/brand/Aurora';
import { Wordmark } from '../components/brand/Brand';
import { Button } from '../components/ui/Button';
import { Row } from '../components/ui/primitives';
import { useStatusTone } from '../components/ui/Screen';
import { Txt } from '../components/ui/Txt';
import { SEO_LABELS, SEO_ORDER, SEO_PATHS } from '../components/seo/seoCopy';
import { isAdminSite } from '../lib/site';
import { colors, fonts, space } from '../theme/tokens';

/**
 * Unknown address. The static export also writes it as +not-found.html (copied to
 * 404.html by scripts/web-build.mjs), so stray URLs are never indexed as real pages.
 */
export default function NotFound() {
  useStatusTone('dark');
  const links = isAdminSite ? [] : SEO_ORDER.map((p) => ({ href: SEO_PATHS[p], label: SEO_LABELS[p] }));
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ivory100 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space[6], overflow: 'hidden' }}>
      <Head>
        <title>Página no encontrada · NÜVA</title>
        <meta name="robots" content="noindex" />
      </Head>
      <Aurora layout="web" scale={0.9} />
      <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', gap: space[5] }}>
        <Link href={(isAdminSite ? '/admin' : '/') as Href} accessibilityLabel="Ir al inicio de NÜVA">
          <Wordmark height={34} color={colors.midnight} />
        </Link>
        <Txt style={{ fontFamily: fonts.extrabold, fontSize: 96, lineHeight: 100, letterSpacing: -2, marginTop: space[8] }} color={colors.lime}>
          404
        </Txt>
        <Txt accessibilityRole="header" {...({ 'aria-level': 1 } as object)} v="h1" color={colors.midnight}>
          Esta página no existe.
        </Txt>
        <Txt v="body" color={colors.inkSoft} style={{ fontSize: 17, lineHeight: 26 }}>
          Puede que el enlace esté mal escrito o que la página ya no exista. Te dejamos por dónde seguir.
        </Txt>
        <Button label={isAdminSite ? 'Ir a la consola' : 'Ir al inicio'} full={false} onPress={() => router.replace((isAdminSite ? '/admin' : '/') as Href)} style={{ alignSelf: 'flex-start', marginTop: space[2] }} />
        {links.length ? (
          <View style={{ marginTop: space[6], gap: 2 }}>
            {links.map((l) => (
              <Link key={l.href} href={l.href as Href}>
                <Row style={{ gap: 6, minHeight: 44 }}>
                  <Txt v="bodyStrong" color={colors.midnight}>
                    {l.label}
                  </Txt>
                  <ArrowUpRight size={16} color={colors.limeInk} />
                </Row>
              </Link>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
