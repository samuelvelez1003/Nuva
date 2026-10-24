# i18n · NÜVA

Idiomas: **español** (`es`, fuente) e **inglés** (`en`).

| Archivo     | Qué contiene                                                        |
| ----------- | ------------------------------------------------------------------- |
| `es.ts`     | Diccionario fuente. Toda clave nueva nace aquí.                     |
| `en.ts`     | Inglés (EE. UU.), tipado contra `es`.                               |
| `index.tsx` | `LanguageProvider`, `useT`, `useLanguage`, `translate`, `LANGS`.    |

## 1. Montar el provider (una sola vez)

En `src/app/_layout.tsx`, envolver la app:

```tsx
import { LanguageProvider } from '../i18n';

<LanguageProvider>
  {/* …resto de providers y <Stack /> */}
</LanguageProvider>
```

El idioma elegido se guarda en `authStorage` con la clave `nuva.lang` (por defecto `es`).

## 2. Usar `useT` en una pantalla

```tsx
import { useT } from '../../i18n';

const t = useT();

<Txt v="h3">{t('common.whereTo')}</Txt>
<Txt v="caption">{t('pax.home.youAreIn', { area: here.area })}</Txt>
<Button label={t('pax.ride.request', { category: c.name })} />
```

- Los `{marcadores}` se reemplazan con el objeto del segundo argumento.
- Si a un idioma le falta un texto (cadena vacía), se muestra el español.
- Fuera de componentes (toasts en funciones, utilidades): `translate(lang, 'clave', vars)`.

## 3. Cambiar el idioma

```tsx
import { LANGS, useLanguage } from '../../i18n';

const { lang, setLang } = useLanguage();

{LANGS.map((l) => (
  <Chip key={l.code} label={l.label} active={l.code === lang} onPress={() => setLang(l.code)} />
))}
```

## 4. Agregar una clave

1. Agrégala en **`es.ts`** dentro de su grupo, con el prefijo correcto:
   `common.` · `tabs.` · `web.` (landing) · `launcher.` (/demo) · `auth.` · `pax.` (pasajero) · `drv.` (conductor).
2. Corre `npm run typecheck`: TypeScript marcará `en.ts` hasta que la agregues allí también.
3. Agrégala en **`en.ts`**.

Reglas:

- Nunca concatenes frases: usa marcadores (`'Llega en {min} min'`), porque el orden cambia entre idiomas.
- No traduzcas marcas ni medios de pago: NÜVA, Nequi, Daviplata, Bancolombia, Wompi, Go, XL.
- Los textos que vienen de la configuración del país (`country.web.*`), de la tarifa
  (`pricing.categories[*].name/tagline`) o de datos de demo (`data/mock.ts`) no están en estos diccionarios.
