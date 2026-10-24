/**
 * Copy of the search landing pages (one per thing people search for in Pereira and
 * Dosquebradas). Spanish only: it is what visitors search in.
 *
 * Every number comes from the live configuration, never from this file. Placeholders
 * are filled in SeoPage.tsx:
 *   {commission} {base} {perKm} {perMin} {minimum} {goName} {categories}   pricing
 *   {freeTrips} {tierThreshold} {tierPct} {challengeTrips} {challengePct}
 *   {passRule} {waitFreeMin} {waitPerMin} {noShowFee} {minTopup} {debtAllowance}
 *   {maxPickupKm}                                                          settings
 *   {surcharges} {airportRule}                    sentences that depend on the surcharges
 *   {ex.dest} {ex.km} {ex.min} {ex.price}         first row of the page's price table
 *   {drv.fare} {drv.commission} {drv.net}         sample driver trip (5 km · 15 min, Go)
 */
export type SeoPageId = 'pereira' | 'airport' | 'dosquebradas' | 'drivers';

export const SEO_PATHS: Record<SeoPageId, string> = {
  pereira: '/taxi-pereira',
  airport: '/taxi-aeropuerto-matecana',
  dosquebradas: '/taxi-dosquebradas',
  drivers: '/conductores-pereira',
};

/** Short link labels (footer, related pages, 404). */
export const SEO_LABELS: Record<SeoPageId, string> = {
  pereira: 'Taxi en Pereira',
  airport: 'Taxi al aeropuerto Matecaña',
  dosquebradas: 'Taxi en Dosquebradas',
  drivers: 'Conducir con NÜVA',
};

export const SEO_ORDER: SeoPageId[] = ['pereira', 'airport', 'dosquebradas', 'drivers'];

export interface SeoPageCopy {
  title: string;
  description: string;
  kicker: string;
  h1: string;
  intro: string;
  /** Price table (passenger pages) or sample earnings (drivers). */
  priceTitle: string;
  priceFrom: string;
  priceNote: string;
  highlightsTitle: string;
  highlights: { t: string; b: string; when?: 'pass' }[];
  stepsTitle: string;
  steps: { t: string; b: string }[];
  faq: { q: string; a: string }[];
}

export const SHARED = {
  getApp: 'Descargar para Android',
  useWeb: 'Usar NÜVA en la web',
  drive: 'Quiero conducir',
  colRoute: 'Destino',
  faqTitle: 'Preguntas frecuentes',
  fareTitle: 'Así se calcula tu precio',
  fareBody:
    'Tarifa base + kilómetros + minutos estimados de la ruta. Si el total queda por debajo de la tarifa mínima, se ajusta a ese mínimo. Cada categoría aplica su propio multiplicador sobre la distancia y el tiempo.',
  fareRows: { base: 'Tarifa base', perKm: 'Por kilómetro', perMin: 'Por minuto', minimum: 'Tarifa mínima' },
  fareNote: 'Valores de la categoría {goName} con la tarifa publicada hoy. {surcharges}',
  related: 'Más de NÜVA',
  home: 'Inicio de NÜVA',
  privacy: 'Política de privacidad',
  terms: 'Términos y condiciones',
  ctaTitle: '¿Para dónde vamos hoy?',
  ctaBody: 'Descarga la app, crea tu cuenta en un minuto y mira el precio exacto antes de pedir.',
  ctaDriverBody: 'Descarga la app, crea tu cuenta de conductor y registra tu vehículo. Te avisamos cuando puedas recibir viajes.',
  footer: 'Pereira y Dosquebradas, Risaralda, Colombia',
};

const PAY =
  'Le pagas directo a tu conductor en efectivo, por Nequi, Daviplata o transferencia Bancolombia (la app te muestra sus datos al iniciar el viaje), o con una tarjeta guardada en la app.';
const SAFETY =
  'NÜVA revisa los datos y documentos de cada conductor (licencia de conducción, SOAT y revisión técnico-mecánica) antes de aprobarlo. En cada viaje ves la placa del carro, confirmas que subes al correcto con tu PIN de abordaje, puedes compartir el viaje y llamar a la Línea 123 desde la app en un toque.';
const NO_SURGE =
  'No. El precio se calcula al pedir y no sube por trancón ni por demanda. {surcharges} Solo se suma la espera si haces esperar al conductor más de {waitFreeMin} minutos gratis ({waitPerMin} por minuto), o un cargo de {noShowFee} si cancelas cuando ya llegó por ti.';
const SCHEDULE =
  'Sí. Puedes programar tu viaje desde 30 minutos hasta 7 días antes. La solicitud se ofrece a los conductores 15 minutos antes de la hora de recogida.';

const PASSENGER_STEPS = [
  { t: 'Escribe tu destino', b: 'O toca Casa, Trabajo o uno de tus lugares guardados. Marca en el mapa dónde te recogemos.' },
  { t: 'Mira el precio real', b: 'Compara las categorías con el desglose completo de la tarifa antes de pedir.' },
  { t: 'Pide y relájate', b: 'Ves a tu conductor llegar en el mapa, con su placa y tu PIN de abordaje.' },
];

const PASSENGER_HIGHLIGHTS = [
  { t: 'Precio antes de pedir', b: 'Tarifa base, kilómetros y minutos, con todo el desglose. El precio no cambia por trancón.' },
  { t: 'Paga como quieras', b: 'Efectivo, Nequi, Daviplata o Bancolombia directo a tu conductor, o tarjeta guardada en la app.' },
  { t: 'PIN de abordaje', b: 'Cada viaje tiene su PIN: así confirmas que subes al carro correcto.' },
  { t: 'Comparte tu viaje', b: 'Envía conductor, placa y destino a quien quieras. Botón SOS con la Línea 123.' },
  { t: 'NÜVA Mujeres', b: 'Si en tu perfil eres mujer, puedes pedir que te recoja solo una conductora verificada por NÜVA.' },
  { t: 'Viajes programados', b: 'Agenda tu viaje desde 30 minutos hasta 7 días antes.' },
];

export const SEO_PAGES: Record<SeoPageId, SeoPageCopy> = {
  pereira: {
    title: 'Taxi en Pereira por app · Precio antes de pedir | NÜVA',
    description:
      'Pide taxi en Pereira con NÜVA: precio y desglose antes de pedir, conductores revisados, PIN de abordaje y pago en efectivo, Nequi, Daviplata o tarjeta.',
    kicker: 'Pereira · Risaralda',
    h1: 'Taxi en Pereira con el precio claro antes de pedir.',
    intro:
      'NÜVA es una app de viajes hecha para Pereira y Dosquebradas. Escribes tu destino, comparas las categorías con el desglose completo de la tarifa y pides. El precio que ves antes de pedir no sube por trancón ni por demanda.',
    priceTitle: 'Precios de ejemplo desde el centro',
    priceFrom: 'Desde la Plaza de Bolívar',
    priceNote:
      'Estimados para una ruta típica de día con la tarifa publicada hoy. {airportDrop} Tu precio exacto depende de la dirección y la ruta, y lo ves en la app antes de pedir.',
    highlightsTitle: 'Por qué moverte con NÜVA en Pereira',
    highlights: [{ t: 'Elige cómo vas', b: 'Categorías disponibles hoy: {categories}.' }, ...PASSENGER_HIGHLIGHTS],
    stepsTitle: 'Tres toques y vas en camino.',
    steps: PASSENGER_STEPS,
    faq: [
      {
        q: '¿Cuánto cuesta un taxi en Pereira con NÜVA?',
        a: 'Depende de la distancia y el tiempo estimado. En {goName}: tarifa base de {base}, {perKm} por kilómetro y {perMin} por minuto, con una tarifa mínima de {minimum}. Por ejemplo, de la Plaza de Bolívar a {ex.dest} son unos {ex.km} y {ex.min}: cerca de {ex.price}. La app te muestra el precio exacto antes de pedir.',
      },
      { q: '¿El precio sube por trancón o por demanda?', a: NO_SURGE },
      { q: '¿Cómo pago el viaje?', a: PAY },
      { q: '¿Es seguro pedir un viaje en NÜVA?', a: SAFETY },
      { q: '¿Puedo pedir un viaje para más tarde?', a: SCHEDULE },
      { q: '¿En qué ciudades funciona NÜVA?', a: 'Por ahora solo en Pereira y Dosquebradas (Risaralda, Colombia), incluidos los viajes entre las dos ciudades y al Aeropuerto Internacional Matecaña.' },
    ],
  },

  airport: {
    title: 'Taxi al Aeropuerto Matecaña (PEI) en Pereira | NÜVA',
    description:
      'Taxi desde y hacia el Aeropuerto Internacional Matecaña (PEI) en Pereira: precio antes de pedir, viajes programados para tu vuelo y categoría XL para maletas.',
    kicker: 'Aeropuerto Internacional Matecaña · PEI',
    h1: 'Taxi al aeropuerto Matecaña, con el precio antes de pedir.',
    intro:
      'Llegas a Pereira o sales a tomar tu vuelo: pide tu viaje en NÜVA y mira el precio con su desglose antes de confirmar. Si viajas con maletas o en grupo, elige una categoría más grande, y si tu vuelo es mañana, programa el viaje desde hoy.',
    priceTitle: 'Precios de ejemplo desde el aeropuerto',
    priceFrom: 'Desde el Aeropuerto Matecaña',
    priceNote: 'Estimados para una ruta típica de día con la tarifa publicada hoy. {airportTable} Tu precio exacto depende de la dirección y la ruta, y lo ves en la app antes de pedir.',
    highlightsTitle: 'Tu viaje al aeropuerto, sin vueltas',
    highlights: [
      { t: 'Programa para tu vuelo', b: 'Agenda la recogida desde 30 minutos hasta 7 días antes. La solicitud sale a los conductores 15 minutos antes de la hora.' },
      { t: 'Espacio para tus maletas', b: 'Categorías disponibles hoy: {categories}. Mira en la app cuántos puestos tiene cada una.' },
      { t: 'Recargo claro', b: '{airportRule}' },
      ...PASSENGER_HIGHLIGHTS.slice(1, 4),
    ],
    stepsTitle: 'Del avión a tu destino en tres toques.',
    steps: [
      { t: 'Abre NÜVA al aterrizar', b: 'Escribe tu destino en Pereira o Dosquebradas y marca dónde te recogemos.' },
      PASSENGER_STEPS[1],
      PASSENGER_STEPS[2],
    ],
    faq: [
      {
        q: '¿Cuánto cuesta un taxi del aeropuerto Matecaña al centro de Pereira?',
        a: 'Desde el aeropuerto hasta {ex.dest} son unos {ex.km} y {ex.min}: cerca de {ex.price} en {goName}. {airportRule} La app calcula el precio exacto de tu dirección antes de pedir.',
      },
      { q: '¿Hay recargo por recoger o dejar en el aeropuerto?', a: '{airportRule}' },
      { q: '¿Puedo programar el viaje para llegar a tiempo a mi vuelo?', a: SCHEDULE },
      { q: '¿Cómo pago el viaje?', a: PAY },
      { q: '¿El precio sube por trancón o por demanda?', a: NO_SURGE },
    ],
  },

  dosquebradas: {
    title: 'Taxi en Dosquebradas y a Pereira por app | NÜVA',
    description:
      'Viajes en Dosquebradas y entre Dosquebradas y Pereira: ves el precio antes de pedir, conductores revisados, PIN de abordaje y pago en efectivo o Nequi.',
    kicker: 'Dosquebradas · Risaralda',
    h1: 'Taxi en Dosquebradas, y de Dosquebradas a Pereira.',
    intro:
      'NÜVA funciona en Dosquebradas y en Pereira como una sola ciudad: pide dentro de Dosquebradas o cruza a Pereira con el mismo cálculo de tarifa. Ves el precio y su desglose antes de pedir.',
    priceTitle: 'Precios de ejemplo desde Dosquebradas',
    priceFrom: 'Desde el parque principal de Dosquebradas',
    priceNote:
      'Estimados para una ruta típica de día con la tarifa publicada hoy. {airportDrop} Tu precio exacto depende de la dirección y la ruta, y lo ves en la app antes de pedir.',
    highlightsTitle: 'Lo que tienes en cada viaje',
    highlights: [{ t: 'Elige cómo vas', b: 'Categorías disponibles hoy: {categories}.' }, ...PASSENGER_HIGHLIGHTS],
    stepsTitle: 'Tres toques y vas en camino.',
    steps: PASSENGER_STEPS,
    faq: [
      {
        q: '¿NÜVA funciona en Dosquebradas?',
        a: 'Sí. NÜVA opera en Pereira y Dosquebradas: puedes pedir viajes dentro de Dosquebradas, hacia Pereira y hacia el Aeropuerto Matecaña.',
      },
      {
        q: '¿Cuánto cuesta un viaje de Dosquebradas a Pereira?',
        a: 'Depende de la distancia y el tiempo estimado. Por ejemplo, del parque principal de Dosquebradas a {ex.dest} son unos {ex.km} y {ex.min}: cerca de {ex.price} en {goName}. La tarifa es la misma en las dos ciudades: base de {base}, {perKm} por kilómetro y {perMin} por minuto, con mínima de {minimum}.',
      },
      { q: '¿El precio sube por trancón o por demanda?', a: NO_SURGE },
      { q: '¿Cómo pago el viaje?', a: PAY },
      { q: '¿Es seguro pedir un viaje en NÜVA?', a: SAFETY },
    ],
  },

  drivers: {
    title: 'Conducir en Pereira con NÜVA · Comisión clara | NÜVA',
    description:
      'Conduce con NÜVA en Pereira y Dosquebradas: primeros viajes sin comisión, ganancia neta visible antes de aceptar, propinas 100 % tuyas y te pagan directo.',
    kicker: 'Conductores · Pereira y Dosquebradas',
    h1: 'Conduce con NÜVA y conoce tu ganancia antes de aceptar.',
    intro:
      'Recibe viajes en Pereira y Dosquebradas con la ganancia neta visible antes de aceptar. Tus pasajeros te pagan directo y la comisión de NÜVA ({commission}) se descuenta de tu saldo prepago. Tus primeros {freeTrips} viajes no pagan comisión.',
    priceTitle: 'Así queda un viaje para ti',
    priceFrom: 'Ejemplo: viaje {goName} de 5 km · 15 min',
    priceNote: 'Calculado con la tarifa y la comisión publicadas hoy, antes de gasolina. Las propinas y los recargos no pagan comisión.',
    highlightsTitle: 'Las reglas, claras',
    highlights: [
      { t: 'Primeros viajes sin comisión', b: 'Tus primeros {freeTrips} viajes completados no pagan comisión.' },
      { t: 'Paga menos si haces más', b: 'Desde el viaje {tierThreshold} del mes, la comisión baja al {tierPct} %. Con {challengeTrips} viajes en la semana, baja al {challengePct} % el resto de la semana.' },
      { t: 'Pase sin comisión', b: 'Con tu saldo compras un pase y no pagas comisión mientras dure: {passRule}.', when: 'pass' },
      { t: 'Propinas y recargos 100 % tuyos', b: 'Las propinas, los recargos nocturno y de aeropuerto y el cobro por espera no pagan comisión.' },
      { t: 'Te pagan directo', b: 'Efectivo, Nequi, Daviplata o Bancolombia, directo a ti. Lo que pagan con tarjeta se suma a tu saldo retirable.' },
      { t: 'Tú decides', b: 'Ves destino, distancia de recogida y lo que te queda antes de aceptar. Solo te llegan solicitudes a menos de {maxPickupKm} km.' },
      { t: 'NÜVA Mujeres', b: 'Si eres conductora verificada por NÜVA, recibes los viajes NÜVA Mujeres y puedes elegir llevar solo pasajeras.' },
    ],
    stepsTitle: 'Cómo empezar',
    steps: [
      { t: 'Crea tu cuenta', b: 'Descarga la app y regístrate como conductor con tu correo, celular y contraseña.' },
      { t: 'Registra tu vehículo y tu Nequi', b: 'Marca, modelo, placa y el Nequi donde te pagan.' },
      { t: 'NÜVA revisa tu cuenta', b: 'Licencia de conducción, SOAT y revisión técnico-mecánica. Te avisamos cuando puedas recibir viajes.' },
    ],
    faq: [
      {
        q: '¿Cuánto cobra NÜVA de comisión?',
        a: 'Una comisión del {commission} sobre la tarifa de cada viaje. Los recargos, el cobro por espera y las propinas no pagan comisión. Tus primeros {freeTrips} viajes son sin comisión, y desde el viaje {tierThreshold} del mes pagas el {tierPct} %. Siempre ves lo que te queda antes de aceptar.',
      },
      {
        q: '¿Cómo recibo mi plata?',
        a: 'El pasajero te paga directo: en efectivo, por Nequi, Daviplata o transferencia Bancolombia. Cuando paga con tarjeta, el valor queda en tu saldo NÜVA y lo puedes retirar.',
      },
      {
        q: '¿Necesito saldo para aceptar viajes?',
        a: 'Sí. La comisión de cada viaje se descuenta de tu saldo prepago, y para aceptar necesitas saldo suficiente para esa comisión (puedes quedar hasta {debtAllowance} por debajo de cero). Recargas en la app con Wompi desde {minTopup}.',
      },
      {
        q: '¿Qué necesito para conducir con NÜVA?',
        a: 'Un vehículo con licencia de conducción, SOAT y revisión técnico-mecánica vigentes, y una cuenta Nequi. Te registras en la app y NÜVA revisa tus datos antes de aprobarte.',
      },
      {
        q: '¿Dónde puedo conducir?',
        a: 'En Pereira y Dosquebradas (Risaralda), incluidos los viajes desde y hacia el Aeropuerto Internacional Matecaña.',
      },
    ],
  },
};
