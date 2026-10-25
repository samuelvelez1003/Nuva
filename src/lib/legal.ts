/**
 * Privacy policy and terms of service, shown at /privacidad and /terminos.
 * Written from what the app really collects and does (see supabase/migrations),
 * for Colombia only (Pereira and Dosquebradas), under Colombian law.
 *
 * NÜVA is a brand operated by a natural person (persona natural) with a NIT,
 * not a company. Empty fields of LEGAL_OWNER are shown as "[POR COMPLETAR: …]"
 * so they are never invented: fill them in and have a lawyer review both texts
 * before publishing in the stores.
 */

export const LEGAL_OWNER = {
  brand: 'NÜVA',
  /** Full legal name of the natural person who operates NÜVA. */
  holder: 'Bryan Samuel Velez Velasquez',
  /** NIT of that person (Colombia). */
  taxId: '1004789440-1',
  /** City of domicile. */
  city: 'Pereira, Risaralda, Colombia',
  /** Street address for notices (Decreto 1377 de 2013 asks for it). Empty = still missing. */
  street: 'Carrera 11 Bis # 17-20, Centro Comercial Victoria',
  /** Contact phone for privacy requests. Empty = still missing. */
  phone: '+57 324 687 2774',
  email: 'adminnuva@proton.me',
};

export const LEGAL_UPDATED = '25 de octubre de 2026';

export interface LegalSection {
  title: string;
  body?: string[];
  list?: string[];
}

const missing = (what: string) => `[POR COMPLETAR: ${what}]`;
const street = () => LEGAL_OWNER.street || missing('dirección física');
const phone = () => LEGAL_OWNER.phone || missing('teléfono de contacto');

/** "NÜVA, marca operada por <name>, persona natural identificada con NIT <n>". */
const owner = () =>
  `${LEGAL_OWNER.brand}, marca operada por ${LEGAL_OWNER.holder || missing('nombre completo del titular')}, persona natural identificada con NIT ${LEGAL_OWNER.taxId || missing('NIT')}`;
/** Domicile and contact line. */
const contact = () => `Domicilio: ${street()}, ${LEGAL_OWNER.city}. Correo: ${LEGAL_OWNER.email || missing('correo de contacto')}. Teléfono: ${phone()}.`;

export const PRIVACY: { intro: string[]; sections: LegalSection[] } = {
  intro: [
    'Esta política explica qué datos personales trata NÜVA cuando usas la app o la web, para qué los usamos, con quién los compartimos y cómo puedes ejercer tus derechos. Aplica a pasajeros y conductores que usan NÜVA en Colombia.',
    'Se rige por la ley colombiana de protección de datos personales (habeas data): la Ley Estatutaria 1581 de 2012 y su reglamento, el Decreto 1377 de 2013, hoy compilado en el Decreto Único Reglamentario 1074 de 2015. La autoridad de protección de datos en Colombia es la Superintendencia de Industria y Comercio (SIC).',
    'Al crear tu cuenta y aceptar esta política autorizas, de forma previa, expresa e informada, el tratamiento de tus datos para las finalidades que se describen aquí.',
  ],
  sections: [
    {
      title: 'Responsable del tratamiento',
      body: [`${owner()}. ${contact()}`],
    },
    {
      title: 'Qué datos recogemos',
      list: [
        'Datos de cuenta: nombre, correo, celular y, si la subes, tu foto de perfil. Tu contraseña se guarda cifrada; nadie en NÜVA puede verla.',
        'Ubicación: solo mientras usas la app y nos das permiso. Al pasajero la usamos para el punto de recogida y para mostrarle su viaje. El conductor comparte su ubicación mientras está «en línea» o en un viaje. No seguimos tu ubicación con la app cerrada.',
        'Viajes: origen, destino, ruta, distancia, duración, tarifa, método de pago elegido, códigos promocionales usados, calificaciones, etiquetas y comentarios, y el PIN de abordaje.',
        'Chat del viaje: los mensajes que se envían pasajero y conductor durante el viaje. Quedan asociados al viaje y solo los ven ellos dos y, si hay un reclamo, el equipo de soporte de NÜVA.',
        'Lugares guardados (por ejemplo Casa o Trabajo): solo los ves tú; no se comparten con conductores.',
        'Conductores: datos del vehículo (marca, modelo, color y placa), el Nequi donde los pasajeros te pagan y los documentos que te pidamos para aprobarte (licencia de conducción, SOAT y revisión técnico-mecánica). También tu saldo prepago, tus recargas, las comisiones descontadas y demás movimientos de saldo.',
        'Soporte: los mensajes que nos envías y la información que adjuntes.',
        'Datos técnicos: idioma, tipo de dispositivo y registros del servidor necesarios para que el servicio funcione y sea seguro.',
        'No guardamos datos de tarjetas ni claves bancarias. Las recargas las procesa directamente la pasarela de pagos Wompi.',
        'No te pedimos datos sensibles (por ejemplo, de salud o biométricos). Si alguna vez fueran necesarios, te lo diríamos y responderlos sería opcional.',
      ],
    },
    {
      title: 'Para qué los usamos',
      list: [
        'Conectar pasajeros con conductores cercanos y mostrar el viaje en el mapa en tiempo real.',
        'Calcular y mostrar la tarifa antes de pedir el viaje, y la comisión antes de que el conductor acepte.',
        'Revisar los datos y documentos de los conductores antes de aprobarlos.',
        'Gestionar el saldo prepago de los conductores, las recargas y las comisiones.',
        'Seguridad: PIN de abordaje, compartir los datos del viaje, prevenir fraude y suplantación, y atender incidentes.',
        'Comunicar al pasajero y al conductor de un mismo viaje (chat y llamada) para coordinar la recogida.',
        'Atender peticiones, quejas y reclamos, y cumplir obligaciones legales, contables y tributarias.',
        'Mejorar el servicio con estadísticas agregadas que no te identifican.',
      ],
      body: ['No vendemos tus datos ni los usamos para publicidad de terceros.'],
    },
    {
      title: 'Con quién los compartimos',
      list: [
        'Entre las personas del viaje: el pasajero ve el nombre, la foto, la calificación, el vehículo, la placa y la ubicación del conductor, y el Nequi del conductor si paga por ese medio; el conductor ve el nombre, la foto y la calificación del pasajero, el punto de recogida y el destino. Mientras el viaje está en curso (desde que el conductor acepta hasta que termina), cada uno puede ver el teléfono del otro para llamarse; al terminar o cancelarse el viaje deja de mostrarse.',
        'Encargados que nos prestan servicios: Supabase (base de datos, autenticación y almacenamiento de fotos, con servidores en Estados Unidos), Expo (alojamiento de la web y distribución de la app) y Wompi (procesamiento de las recargas de saldo).',
        'Servicios de mapas: Mapbox (mapa y rutas con tráfico) y HERE (búsqueda de direcciones); como respaldo, servicios basados en OpenStreetMap (OpenFreeMap, OSRM, Photon y Nominatim). Reciben coordenadas o el texto que buscas, no tu nombre ni tu cuenta.',
        'Autoridades, cuando una ley o una orden judicial lo exija, o para proteger la vida o la seguridad de una persona.',
      ],
    },
    {
      title: 'Transferencia internacional',
      body: [
        'Algunos de esos proveedores guardan datos fuera de Colombia, principalmente en Estados Unidos. Solo trabajamos con proveedores que aplican medidas de seguridad adecuadas. Al aceptar esta política autorizas esa transferencia, como lo permite el artículo 26 de la Ley 1581 de 2012.',
      ],
    },
    {
      title: 'Cuánto tiempo los conservamos',
      body: [
        'Mientras tu cuenta esté activa. Si la eliminas, borramos o anonimizamos tus datos, salvo los registros de viajes, recargas y comisiones que la ley nos obliga a conservar (por ejemplo, hasta 10 años para libros y soportes contables). Las ubicaciones en vivo del conductor solo se usan durante la conexión.',
      ],
    },
    {
      title: 'Tus derechos como titular',
      list: [
        'Conocer, actualizar y rectificar tus datos personales.',
        'Solicitar prueba de la autorización que nos diste.',
        'Ser informado de cómo hemos usado tus datos.',
        'Revocar la autorización y pedir que suprimamos tus datos, cuando no exista un deber legal o contractual de conservarlos.',
        'Acceder gratis a tus datos.',
        'Presentar quejas ante la Superintendencia de Industria y Comercio (SIC), después de haber hecho tu consulta o reclamo ante NÜVA.',
      ],
      body: [
        `Para ejercerlos escríbenos a ${LEGAL_OWNER.email || missing('correo de contacto')} desde el correo de tu cuenta, o desde Ayuda en la app. Respondemos las consultas en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles, como indica la Ley 1581 de 2012; si necesitamos más tiempo te diremos por qué y la nueva fecha, dentro de los plazos que permite la ley. También puedes cambiar tu nombre y tu foto desde tu perfil en la app.`,
      ],
    },
    {
      title: 'Seguridad',
      body: [
        'Usamos conexiones cifradas (HTTPS), contraseñas cifradas y reglas de acceso en la base de datos para que cada usuario solo vea lo que le corresponde. Ninguna medida es infalible: si detectamos un incidente que afecte tus datos, te avisaremos y lo informaremos a la SIC cuando la ley lo exija.',
      ],
    },
    {
      title: 'Menores de edad',
      body: ['NÜVA es para mayores de 18 años. No creamos cuentas de menores a sabiendas; si detectamos una, la eliminamos.'],
    },
    {
      title: 'Cambios a esta política',
      body: ['Si cambiamos esta política de forma importante te lo avisaremos en la app o por correo antes de que el cambio aplique. La fecha de la última actualización aparece al inicio.'],
    },
  ],
};

export const TERMS: { intro: string[]; sections: LegalSection[] } = {
  intro: [
    'Estos términos regulan el uso de NÜVA, la app y la web para pedir y ofrecer viajes en Pereira y Dosquebradas (Colombia). Al crear una cuenta los aceptas. Léelos con calma; si no estás de acuerdo, no uses el servicio.',
    'Los aceptas por medios electrónicos, lo que tiene plena validez según la Ley 527 de 1999 (comercio electrónico y mensajes de datos). Puedes consultarlos en cualquier momento en la web de NÜVA.',
  ],
  sections: [
    {
      title: 'Qué es NÜVA',
      body: [
        'NÜVA es una plataforma tecnológica que conecta a pasajeros con conductores independientes. Los conductores no son empleados de NÜVA: deciden cuándo conectarse y qué viajes aceptar, y prestan el servicio con su propio vehículo y bajo su responsabilidad.',
        `El operador de la plataforma es ${owner()}. ${contact()}`,
      ],
    },
    {
      title: 'Tu cuenta',
      list: [
        'Debes tener al menos 18 años y dar datos reales y actualizados.',
        'Cada persona puede tener una sola cuenta de pasajero o de conductor.',
        'Eres responsable de cuidar tu contraseña y de lo que se haga desde tu cuenta. Si la olvidas, puedes crear una nueva con el enlace que te enviamos al correo. Si crees que alguien entró a tu cuenta, escríbenos de inmediato.',
      ],
    },
    {
      title: 'Para pasajeros',
      list: [
        'Antes de pedir ves el precio total del viaje, calculado con la tarifa base, los kilómetros y los minutos estimados de la ruta, más los recargos fijos que apliquen (nocturno o de aeropuerto). Ese es el precio que pagas, salvo que cambies el destino durante el viaje o hagas esperar al conductor en el punto de recogida más allá de los minutos gratis que indica la app: cada minuto adicional se suma al viaje, es 100 % del conductor y se muestra en el desglose.',
        'Pagas directamente al conductor, en pesos colombianos, con el método que elegiste: efectivo, Nequi, Daviplata o transferencia Bancolombia. NÜVA no te cobra tarifa de servicio ni recibe ese pago.',
        'Si usas un código promocional, el descuento se resta de lo que le pagas al conductor y NÜVA se lo reconoce a él en su saldo.',
        'Al subir, confirma el vehículo y la placa y dale al conductor tu PIN de abordaje. No subas a un vehículo que no coincida.',
        'Cancelar no tiene costo mientras el conductor va en camino. Si cancelas cuando el conductor ya llegó al punto de recogida, o no sales tras el tiempo de espera que indica la app, se cobra un cargo por cancelación tardía que compensa su tiempo: la app te avisa del valor antes de confirmar, se le abona al conductor y se suma a tu siguiente viaje.',
        'Las propinas son voluntarias y son 100 % del conductor.',
        'Trata al conductor y su vehículo con respeto. Los daños que causes pueden serte cobrados.',
      ],
    },
    {
      title: 'Para conductores',
      list: [
        'Requisitos: licencia de conducción vigente para la categoría de tu vehículo, SOAT vigente, revisión técnico-mecánica al día cuando la ley la exija y vehículo en buen estado.',
        'Revisamos tus datos antes de aprobarte y podemos pedir documentos actualizados en cualquier momento. Debes mantenerlos vigentes mientras uses NÜVA.',
        'Antes de aceptar ves el destino, la distancia, la tarifa y lo que te queda después de la comisión.',
        'El pasajero te paga a ti directamente. NÜVA cobra una comisión porcentual sobre la tarifa de cada viaje completado (los recargos, el tiempo de espera y las propinas no pagan comisión). La comisión de cada viaje la ves antes de aceptar y no cambia después; puede ser menor o no aplicarse según las condiciones vigentes que muestra la app (por ejemplo, tus primeros viajes, volumen de viajes del mes o pase semanal).',
        'La comisión se descuenta de tu saldo prepago NÜVA. El saldo se carga con recargas por Wompi desde la app y solo se usa para comisiones y servicios de NÜVA (como el pase semanal). Para aceptar un viaje necesitas saldo suficiente para su comisión, salvo el margen negativo que indique la app.',
        'Los bonos y abonos promocionales no son retirables. Si cierras tu cuenta con saldo recargado sin usar, puedes pedir su devolución a soporte.',
        'Eres responsable de cumplir las normas de tránsito y transporte, de tus impuestos y de las obligaciones de tu actividad como conductor independiente.',
        'Está prohibido discriminar a pasajeros, pedir pagos distintos al precio mostrado o desviarte de la ruta sin motivo.',
      ],
    },
    {
      title: 'Tarifas',
      body: [
        'Las tarifas se publican en la app y en la web, en pesos colombianos (COP). NÜVA puede cambiarlas; los cambios solo aplican a los viajes que se pidan después. No hay tarifa dinámica: el precio no sube por demanda.',
      ],
    },
    {
      title: 'Calificaciones y suspensión',
      body: [
        'Pasajeros y conductores se califican después de cada viaje. Podemos suspender o cerrar cuentas por calificaciones muy bajas sostenidas, fraude, documentos falsos o vencidos, conductas peligrosas o el incumplimiento de estos términos. Cuando sea posible te avisaremos y te daremos la oportunidad de explicar lo ocurrido.',
      ],
    },
    {
      title: 'Seguridad y emergencias',
      body: [
        'La app incluye PIN de abordaje, la opción de compartir los datos del viaje (conductor, placa y destino) y un botón de emergencia que llama a la Línea 123. En una emergencia llama a la Línea 123. NÜVA no reemplaza a las autoridades ni a los servicios de emergencia.',
      ],
    },
    {
      title: 'Usos prohibidos',
      list: [
        'Usar la plataforma para actividades ilegales o transportar objetos prohibidos.',
        'Suplantar a otra persona o crear cuentas falsas.',
        'Intentar acceder a datos de otros usuarios o alterar el funcionamiento de la app.',
        'Acosar, amenazar o agredir a cualquier persona.',
      ],
    },
    {
      title: 'Responsabilidad y derechos del consumidor',
      body: [
        'NÜVA pone la tecnología para conectar a pasajeros y conductores, y responde por el funcionamiento de la plataforma y por la información que muestra. El servicio de transporte lo presta el conductor, que responde por su vehículo, sus documentos y sus seguros obligatorios.',
        'Nada de estos términos limita los derechos que te reconoce el Estatuto del Consumidor (Ley 1480 de 2011), incluido el derecho a recibir información clara y veraz sobre precios y a presentar peticiones, quejas y reclamos. Puedes presentarlos desde Ayuda en la app o por correo, y si no quedas satisfecho, acudir a la Superintendencia de Industria y Comercio (SIC).',
      ],
    },
    {
      title: 'Propiedad intelectual',
      body: ['La marca NÜVA, la app, la web y su diseño pertenecen a su titular. Puedes usarlos solo para pedir u ofrecer viajes como prevén estos términos.'],
    },
    {
      title: 'Cambios y terminación',
      body: [
        'Podemos actualizar estos términos; te avisaremos en la app o por correo antes de que los cambios apliquen. Puedes dejar de usar NÜVA y pedir el cierre de tu cuenta cuando quieras.',
      ],
    },
    {
      title: 'Ley aplicable',
      body: ['Estos términos se rigen por las leyes de la República de Colombia. Antes de acudir a un juez o a la autoridad, escríbenos: intentaremos resolverlo directamente.'],
    },
    {
      title: 'Contacto',
      body: [`${owner()}. ${contact()}`],
    },
  ],
};
