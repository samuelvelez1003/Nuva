# NÜVA — Prototipo de movilidad urbana

> **Tu ciudad. Tu ritmo. Tu precio.**

Prototipo interactivo de alta fidelidad con tres experiencias conectadas (Pasajero, Conductor y Admin) que comparten el mismo sistema de diseño, el mismo estado y el mismo **motor de tarifas**. Si cambias una tarifa en Admin y la publicas, las apps de pasajero y conductor cotizan con ella al instante.

Hecho con **Expo SDK 57 · React Native 0.86 · TypeScript · Expo Router · Reanimated 4 · react-native-svg · Lucide · Manrope**. Corre en Android, iOS y web.

---

## Cómo correrlo

Requisitos: Node.js 20+ (probado con 24 LTS).

```bash
cd nuva
npm install
npx expo start
```

- **En tu celular (Android o iPhone):** instala **Expo Go**, escanea el QR que aparece en la terminal. Todas las librerías del proyecto están incluidas en Expo Go, no necesitas compilar.
- **En el navegador:** presiona `w` (o `npx expo start --web`). En pantallas anchas, Pasajero y Conductor se muestran dentro de un marco de teléfono con un índice de pantallas a la derecha.
- Typecheck: `npm run typecheck`

### APK para Android (nube, sin Android Studio)

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

El perfil `preview` de `eas.json` genera un `.apk` instalable. Para iOS (`-p ios`) se necesita una cuenta de Apple Developer.

> La carpeta del proyecto vive en OneDrive y su ruta tiene “Ü” y espacios. Para compilaciones nativas **locales** (`expo run:android`), mueve el proyecto a una ruta corta tipo `C:\dev\nuva`. Las compilaciones en la nube con EAS no tienen ese problema.

---

## Sitios web publicados (EAS Hosting)

| Sitio | URL | Qué muestra |
|---|---|---|
| Clientes | https://nuva.expo.app | Landing pública: calculadora de tarifas en vivo, sección para conductores, seguridad, FAQ y descarga del APK. `/demo` abre el prototipo de las 3 apps. |
| Administración | https://nuva--admin.expo.app | Solo la consola Admin con inicio de sesión. Las demás rutas redirigen a `/admin`. |

Publicar de nuevo (PowerShell):

```bash
npx expo export --platform web; npx eas-cli@latest deploy --prod
```

```bash
$env:EXPO_PUBLIC_SITE="admin"; npx expo export --platform web; npx eas-cli@latest deploy --alias admin
```

## Recorridos del prototipo

**Pasajero** — Splash → Onboarding → Celular → OTP (cualquier código; `000000` muestra el error) → Inicio con mapa → “¿A dónde vamos?” → Categorías con precio → Desglose → Pedir → Buscando conductor → Conductor asignado (PIN, placa) → Viaje en vivo → Completado → Calificación y propina.

**Conductor** — Inicio → Conectarse → a los ~6 s entra una solicitud (o “Simular entrante”) → cuenta regresiva de 15 s con ganancia neta, comisión, distancia de recogida y destino → Aceptar → Navegación paso a paso → Llegué → PIN → Viaje → Finalizar → **las ganancias del día se actualizan**.

**Admin** — Resumen → Tarifas y comisión → cambia valores → el simulador de tarifa y el de ingresos se actualizan en vivo → Publicar → nueva versión aplicada en las apps.

En la raíz (`/`) hay un lanzador con las tres experiencias y el **Sistema de diseño** (`/design`).

---

## Motor de tarifas (`src/lib/fare.ts`)

```
rawFare            = baseFare + distanceKm × pricePerKm + durationMinutes × pricePerMinute
finalFare          = max(minimumFare, rawFare)
platformCommission = finalFare × commissionPercentage
driverEarnings     = finalFare − platformCommission
```

| Parámetro inicial | Valor |
|---|---|
| Tarifa base | $2.000 |
| Precio por km | $1.000 |
| Precio por minuto | $100 |
| Tarifa mínima | $6.000 |
| Comisión | 12 % |

- Todo en **pesos enteros** (COP). Cada componente se redondea una sola vez, así el desglose siempre suma exacto.
- Las categorías (Moto, Go, Eléctrico, Confort, XL) aplican un **multiplicador** sobre distancia y tiempo, y tienen una mínima propia (nunca menor a la global). Go = ×1,00 reproduce la fórmula exacta.
- **Ninguna tarifa está escrita a mano en la UI**: historial, solicitudes, métricas del admin y simulaciones se calculan con `calculateFare` a partir de distancia y duración.
- Formato COP propio (`$12.600`, `$12,4 M`) en `src/lib/format.ts`, idéntico en Hermes y web.
- Los viajes ya cotizados conservan su precio aunque se publiquen tarifas nuevas.

Ejemplo verificado en la app: Chapinero → Zona T, 3,5 km / 12 min → **$6.700**; comisión **$804**; conductor **$5.896**.

---

## Estructura

```
src/
  app/                      Rutas (Expo Router)
    index.tsx               Lanzador del ecosistema
    design.tsx              Sistema de diseño
    passenger/              Pasajero (stack + tabs Inicio/Viajes/Pagos/Perfil)
    driver/                 Conductor (stack + tabs Inicio/Ganancias/Viajes/Perfil)
    admin/                  Admin (sidebar + secciones)
  components/
    brand/                  Wordmark, ícono, glifo de ruta
    map/                    Mapa estilizado de Bogotá (SVG) y marcadores
    ui/                     Botones, tarjetas, campos, hojas, tabs, toasts…
    fare/                   Desglose de tarifa compartido
    charts/                 Barras, áreas, anillo, sparkline
    admin/                  Tabla responsiva, KPI, slider, paneles
    device/                 Marco de teléfono para la web
  lib/                      fare, format, geo (proyección/rutas), metrics, requests, hooks
  data/                     Datos simulados (lugares reales de Bogotá, personas, tickets…)
  store/                    Estado global del prototipo
  theme/tokens.ts           Tokens: color, tipo, espacio, radios, sombras, movimiento
assets/                     Íconos generados (scripts/generate-icons.ps1)
```

## Notas de diseño

- **Paleta:** Midnight `#101411`, Electric Lime `#D4FF5F`, Soft Ivory `#F5F6F0`, Stone `#8B8F89`, White. Lime solo para acción principal, estados activos y dinero del conductor.
- **Pasajero** en claro con mapa inmersivo; **Conductor** en oscuro (uso nocturno y prolongado); **Admin** en Ivory con barra lateral Midnight.
- **Marca:** la diéresis de la Ü son origen y destino; se repite en el mapa (anillo = recogida, cuadro lime = destino).
- El mapa es un dibujo propio y estilizado de Bogotá (cerros orientales, avenidas principales, parques, aeropuerto) con una proyección real: 1 unidad = 10 m, así las distancias de las rutas son reales.

## Backend (Supabase)

Esquema completo en `supabase/migrations/20261002000000_init.sql`:

- **Roles** `passenger | driver | admin` en `profiles`. `bs.velez10@gmail.com` queda como administrador fundador al registrarse; nadie puede cambiarse su propio rol.
- **Tarifas versionadas** (`pricing_versions`) y **motor de tarifas en el servidor** (`calculate_fare`), copia exacta de `src/lib/fare.ts`. Publicar = `publish_pricing()` (solo admin).
- **Viajes** con la tarifa calculada en el servidor: `request_ride`, `accept_ride`, `advance_ride`, `cancel_ride`, `rate_trip`. El cliente nunca envía precios.
- **Retiros** con validación de saldo (`request_withdrawal`), **zonas**, **promociones**, **tickets** y `admin_dashboard()`.
- **Seguridad a nivel de fila (RLS)** en todas las tablas y **Realtime** en tarifas y viajes.

Conexión de la app:

1. Crea un proyecto en supabase.com y ejecuta el SQL de la migración (SQL Editor o `supabase db push`).
2. En *Authentication → Users*, crea el usuario `bs.velez10@gmail.com` con tu contraseña. Queda como admin automáticamente.
3. Copia `.env.example` a `.env` con la URL y la *publishable key* y reinicia `npx expo start`.

Sin `.env`, todo sigue funcionando en **modo demo** con datos locales. Con `.env`, el Admin pide inicio de sesión y las tarifas publicadas llegan en vivo a todos los celulares.

## Lo que es simulado

Sin backend, sin GPS real, sin pagos. OTP, verificación de identidad, documentos, retiros, chat y llamadas son maquetas funcionales. El estado vive en memoria y se reinicia al recargar.
