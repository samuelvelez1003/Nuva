import React, { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';
import { CUSTOMER_URL, isAdminSite } from '../lib/site';

/**
 * HTML shell of every web page (web only, never runs in the browser or the native app).
 * The web build is pre-rendered (app.json web.output "static"), so search engines and
 * link previews read real content; this adds what they need around it: link-preview
 * defaults and structured data saying what NÜVA is (ride-hailing in Pereira and
 * Dosquebradas). Titles, descriptions and canonical links are set per page with
 * expo-router/head.
 */
const OG_IMAGE = `${CUSTOMER_URL}/og.png`;
const AREA = [
  { '@type': 'City', name: 'Pereira', containedInPlace: { '@type': 'AdministrativeArea', name: 'Risaralda, Colombia' } },
  { '@type': 'City', name: 'Dosquebradas', containedInPlace: { '@type': 'AdministrativeArea', name: 'Risaralda, Colombia' } },
];

const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${CUSTOMER_URL}/#org`,
      name: 'NÜVA',
      url: `${CUSTOMER_URL}/`,
      logo: `${CUSTOMER_URL}/logo.png`,
      image: OG_IMAGE,
      slogan: 'Tu ciudad. Tu ritmo. Tu precio.',
      areaServed: AREA,
    },
    {
      '@type': 'WebSite',
      '@id': `${CUSTOMER_URL}/#website`,
      name: 'NÜVA',
      url: `${CUSTOMER_URL}/`,
      inLanguage: 'es-CO',
      publisher: { '@id': `${CUSTOMER_URL}/#org` },
    },
    {
      '@type': 'TaxiService',
      '@id': `${CUSTOMER_URL}/#service`,
      name: 'NÜVA',
      serviceType: 'Taxi y viajes urbanos por app',
      description:
        'App de viajes en Pereira y Dosquebradas: ves el precio y su desglose antes de pedir, conductores revisados, PIN de abordaje y pago en efectivo, Nequi, Daviplata, Bancolombia o tarjeta.',
      url: `${CUSTOMER_URL}/`,
      image: OG_IMAGE,
      provider: { '@id': `${CUSTOMER_URL}/#org` },
      areaServed: AREA,
      availableLanguage: ['es', 'en'],
      currenciesAccepted: 'COP',
      paymentAccepted: 'Efectivo, Nequi, Daviplata, Bancolombia, tarjeta',
    },
  ],
};

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es-CO">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#101411" />
        {/* The admin console is a private tool: never indexed. */}
        {isAdminSite ? <meta name="robots" content="noindex, nofollow" /> : null}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="NÜVA" />
        <meta property="og:locale" content="es_CO" />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="NÜVA · Taxi y viajes en Pereira y Dosquebradas" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={OG_IMAGE} />
        {isAdminSite ? null : <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'body{background-color:#101411;}' }} />
      </head>
      <body>
        <noscript>Necesitas activar JavaScript para usar NÜVA.</noscript>
        {children}
      </body>
    </html>
  );
}
