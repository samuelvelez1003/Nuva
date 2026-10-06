/**
 * Privacy policy and terms of service, shown at /privacidad and /terminos.
 * Written from what the app really collects and does (see supabase/migrations).
 *
 * NÜVA is a brand operated by a natural person (persona natural) with a NIT,
 * not a company. Before publishing in the stores, fill in LEGAL_OWNER (full
 * name, NIT, address) and have a lawyer review both texts.
 */

export const LEGAL_OWNER = {
  brand: 'NÜVA',
  /** Full legal name of the natural person who operates NÜVA. */
  holder: 'Bryan Samuel Velez Velasquez',
  /** NIT of that person (Colombia). */
  taxId: '1004789440-1',
  /** Physical address for notices. */
  address: 'Pereira, Risaralda, Colombia',
  email: 'adminnuva@proton.me',
};

export const LEGAL_UPDATED = '6 de octubre de 2026';

export interface LegalSection {
  title: string;
  body?: string[];
  list?: string[];
}

/** "NÜVA, marca operada por <name>, persona natural con NIT <n> · <address>". */
const owner = () => {
  const who = LEGAL_OWNER.holder
    ? `${LEGAL_OWNER.brand}, marca operada por ${LEGAL_OWNER.holder}, persona natural${LEGAL_OWNER.taxId ? ` identificada con NIT ${LEGAL_OWNER.taxId}` : ''}`
    : LEGAL_OWNER.brand;
  return [who, LEGAL_OWNER.address].filter(Boolean).join(' · ');
};

export const PRIVACY: { intro: string[]; sections: LegalSection[] } = {
  intro: [
    'Esta política explica qué datos personales trata NÜVA cuando usas la app o la web, para qué los usamos, con quién los compartimos y cómo puedes ejercer tus derechos. Aplica a pasajeros y conductores en Colombia y en Curaçao.',
    'Al crear una cuenta autorizas el tratamiento de tus datos en los términos de esta política. En Colombia, esta política cumple la Ley 1581 de 2012 y el Decreto 1377 de 2013 (Habeas Data).',
  ],
  sections: [
    {
      title: 'Responsable del tratamiento',
      body: [`${owner()}. Correo para temas de datos personales: ${LEGAL_OWNER.email}.`],
    },
    {
      title: 'Qué datos recogemos',
      list: [
        'Datos de cuenta: nombre, correo, teléfono, país y, si la subes, tu foto de perfil. Tu contraseña se guarda cifrada; nadie en NÜVA puede verla.',
        'Ubicación: solo mientras usas la app y nos das permiso. Al pasajero la usamos para el punto de recogida y para mostrarle su viaje. El conductor comparte su ubicación mientras está «en línea» o en un viaje. No seguimos tu ubicación con la app cerrada.',
        'Viajes: origen, destino, ruta, distancia, duración, tarifa, método de pago elegido, calificaciones, etiquetas y comentarios, y el PIN de abordaje.',
        'Chat del viaje: los mensajes que se envían pasajero y conductor durante el viaje. Quedan asociados al viaje y solo los ven ellos dos y, si hay un reclamo, el equipo de soporte de NÜVA.',
        'Lugares guardados (por ejemplo Casa o Trabajo): solo los ves tú; no se comparten con conductores.',
        'Conductores: datos del vehículo (marca, modelo, color y placa) y documentos. En Colombia: licencia, SOAT y revisión técnico-mecánica. En Curaçao: licencia de conducción y vigencia del seguro del vehículo. También la cuenta donde recibes pagos (Nequi o cuenta bancaria), tu saldo prepago, recargas y comisiones.',
        'Soporte: los mensajes que nos envías y la información que adjuntes.',
        'Datos técnicos: idioma, país elegido, tipo de dispositivo y registros del servidor necesarios para que el servicio funcione y sea seguro.',
        'No guardamos datos de tarjetas. Las recargas con tarjeta las procesa directamente la pasarela de pagos (Wompi en Colombia).',
      ],
    },
    {
      title: 'Para qué los usamos',
      list: [
        'Conectar pasajeros con conductores cercanos y mostrar el viaje en el mapa en tiempo real.',
        'Calcular y mostrar la tarifa antes de pedir el viaje, y la comisión antes de que el conductor acepte.',
        'Verificar la identidad y los documentos de los conductores antes de aprobarlos.',
        'Gestionar el saldo prepago de los conductores, las recargas y las comisiones.',
        'Seguridad: PIN de abordaje, compartir el viaje en vivo, atender emergencias, prevenir fraude y suplantación.',
        'Comunicar al pasajero y al conductor de un mismo viaje (chat y llamada) para coordinar la recogida.',
        'Atender solicitudes de soporte, reclamos y obligaciones legales, contables y tributarias.',
        'Mejorar el servicio con estadísticas agregadas que no te identifican.',
      ],
      body: ['No vendemos tus datos ni los usamos para publicidad de terceros.'],
    },
    {
      title: 'Con quién los compartimos',
      list: [
        'Entre las personas del viaje: el pasajero ve el nombre, la foto, la calificación, el vehículo, la placa y la ubicación del conductor; el conductor ve el nombre, la foto y la calificación del pasajero, el punto de recogida y el destino. Si pagas por transferencia o Nequi, verás la cuenta de cobro del conductor. Mientras el viaje está en curso (desde que el conductor acepta hasta que termina), cada uno puede ver el teléfono del otro para llamarse; al terminar o cancelarse el viaje deja de mostrarse.',
        'Supabase: base de datos, autenticación y almacenamiento de fotos (servidores en Estados Unidos).',
        'Expo: alojamiento de la web y distribución de la app.',
        'Wompi: procesamiento de recargas con tarjeta en Colombia.',
        'Servicios de mapas: Mapbox (mapa y rutas con tráfico) y HERE (búsqueda de direcciones); como respaldo, servicios basados en OpenStreetMap (OpenFreeMap, OSRM, Photon y Nominatim). Reciben coordenadas o el texto que buscas, no tu nombre ni tu cuenta.',
        'Autoridades, cuando una ley o una orden judicial lo exija, o para proteger la vida o la seguridad de una persona.',
      ],
    },
    {
      title: 'Transferencia internacional',
      body: [
        'Algunos proveedores guardan datos fuera de tu país, principalmente en Estados Unidos. Solo trabajamos con proveedores que aplican medidas de seguridad adecuadas. Al aceptar esta política autorizas esa transferencia.',
      ],
    },
    {
      title: 'Cuánto tiempo los conservamos',
      body: [
        'Mientras tu cuenta esté activa. Si la eliminas, borramos o anonimizamos tus datos, salvo los registros de viajes, pagos y comisiones que la ley nos obliga a conservar (en Colombia, hasta 10 años para soportes contables). Las ubicaciones en vivo del conductor solo se usan durante la conexión.',
      ],
    },
    {
      title: 'Tus derechos',
      list: [
        'Conocer, actualizar y rectificar tus datos.',
        'Pedir prueba de la autorización que nos diste.',
        'Saber cómo hemos usado tus datos.',
        'Revocar la autorización y pedir que borremos tus datos, cuando no exista una obligación legal de conservarlos.',
        'En Colombia, presentar quejas ante la Superintendencia de Industria y Comercio (SIC), después de haber acudido a NÜVA.',
        'En Curaçao, ejercer los derechos de acceso, rectificación y supresión que reconoce la ley local de protección de datos personales.',
      ],
      body: [
        `Escríbenos a ${LEGAL_OWNER.email} desde el correo de tu cuenta. Respondemos las consultas en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles, como indica la Ley 1581 de 2012. También puedes cambiar tu nombre y tu foto desde tu perfil en la app.`,
      ],
    },
    {
      title: 'Seguridad',
      body: [
        'Usamos conexiones cifradas (HTTPS), contraseñas cifradas y reglas de acceso en la base de datos para que cada usuario solo vea lo que le corresponde. Ninguna medida es infalible: si detectamos un incidente que afecte tus datos, te avisaremos y lo informaremos a la autoridad cuando la ley lo exija.',
      ],
    },
    {
      title: 'Menores de edad',
      body: ['NÜVA es para mayores de 18 años. No creamos cuentas de menores a sabiendas; si detectamos una, la eliminamos.'],
    },
    {
      title: 'Cambios a esta política',
      body: ['Si cambiamos esta política te lo avisaremos en la app o por correo antes de que el cambio aplique. La fecha de la última actualización aparece al inicio.'],
    },
  ],
};

export const TERMS: { intro: string[]; sections: LegalSection[] } = {
  intro: [
    'Estos términos regulan el uso de NÜVA, la app y la web para pedir y ofrecer viajes en Colombia y en Curaçao. Al crear una cuenta los aceptas. Léelos con calma; si no estás de acuerdo, no uses el servicio.',
  ],
  sections: [
    {
      title: 'Qué es NÜVA',
      body: [
        'NÜVA es una plataforma tecnológica que conecta a pasajeros con conductores independientes. Los conductores no son empleados de NÜVA: deciden cuándo conectarse y qué viajes aceptar, y prestan el servicio con su propio vehículo.',
        `El operador de la plataforma es ${owner()}.`,
      ],
    },
    {
      title: 'Tu cuenta',
      list: [
        'Debes tener al menos 18 años y dar datos reales y actualizados.',
        'Cada persona puede tener una sola cuenta, asociada a un país (Colombia o Curaçao). Una cuenta es de pasajero o de conductor.',
        'Eres responsable de cuidar tu contraseña y de lo que se haga desde tu cuenta. Si crees que alguien entró a ella, escríbenos de inmediato.',
      ],
    },
    {
      title: 'Para pasajeros',
      list: [
        'Antes de pedir ves el precio total del viaje, calculado con la tarifa base, los kilómetros y los minutos estimados de la ruta. Ese es el precio que pagas, salvo que cambies el destino durante el viaje.',
        'Pagas directamente al conductor con el método que elegiste (efectivo, Nequi u otro disponible en tu país). NÜVA no cobra tarifa de servicio al pasajero.',
        'Al subir, confirma el vehículo y la placa y dale al conductor tu PIN de abordaje. No subas a un vehículo que no coincida.',
        'Hoy cancelar un viaje no tiene costo. Si en el futuro se cobra por cancelar, lo verás en la app antes de pedir.',
        'Las propinas son voluntarias y son 100 % del conductor.',
        'Trata al conductor y su vehículo con respeto. Los daños que causes pueden serte cobrados.',
      ],
    },
    {
      title: 'Para conductores',
      list: [
        'Requisitos en Colombia: licencia de conducción vigente, SOAT vigente, revisión técnico-mecánica al día y vehículo en buen estado. En Curaçao: licencia de conducción vigente y seguro del vehículo vigente.',
        'Revisamos tus datos antes de aprobarte y podemos pedir documentos actualizados en cualquier momento. Debes mantenerlos vigentes mientras uses NÜVA.',
        'Antes de aceptar ves el destino, la distancia, la tarifa y lo que te queda después de la comisión.',
        'NÜVA cobra una comisión porcentual por cada viaje completado, visible en la app antes de aceptar. Se descuenta de tu saldo prepago NÜVA; el pasajero te paga a ti directamente.',
        'El saldo prepago se carga con recargas (con tarjeta donde esté disponible, o recarga manual) y solo se usa para pagar comisiones. El bono de bienvenida no es retirable. Si cierras tu cuenta con saldo recargado sin usar, puedes pedir su devolución a soporte.',
        'Eres responsable de cumplir las normas de tránsito, de tus impuestos y de las obligaciones de tu actividad como conductor independiente.',
        'Está prohibido discriminar a pasajeros, pedir pagos distintos al precio mostrado o desviarte de la ruta sin motivo.',
      ],
    },
    {
      title: 'Tarifas',
      body: [
        'Las tarifas se publican por país y en moneda local: pesos colombianos (COP) en Colombia y florines caribeños (XCG) en Curaçao. NÜVA puede cambiarlas; los cambios solo aplican a los viajes que se pidan después.',
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
        'La app incluye PIN de abordaje, viaje compartido en vivo y botón de emergencia. En una emergencia llama a la línea 123 en Colombia o al 911 en Curaçao. NÜVA no reemplaza a las autoridades ni a los servicios de emergencia.',
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
      title: 'Responsabilidad',
      body: [
        'NÜVA pone la tecnología para conectar a pasajeros y conductores, y responde por el funcionamiento de la plataforma. El servicio de transporte lo presta el conductor, que responde por su vehículo, sus documentos y sus seguros obligatorios. Nada de lo anterior limita los derechos que la ley te reconoce como consumidor; en Colombia, los del Estatuto del Consumidor (Ley 1480 de 2011).',
      ],
    },
    {
      title: 'Propiedad intelectual',
      body: ['La marca NÜVA, la app, la web y su diseño pertenecen a NÜVA. Puedes usarlos solo para pedir u ofrecer viajes como prevén estos términos.'],
    },
    {
      title: 'Cambios y terminación',
      body: [
        'Podemos actualizar estos términos; te avisaremos en la app o por correo antes de que los cambios apliquen. Puedes dejar de usar NÜVA y pedir el cierre de tu cuenta cuando quieras.',
      ],
    },
    {
      title: 'Ley aplicable',
      body: [
        'Si usas NÜVA en Colombia, aplican las leyes de Colombia. Si la usas en Curaçao, aplican las leyes de Curaçao. Antes de acudir a un juez, escríbenos: intentaremos resolverlo directamente.',
      ],
    },
    {
      title: 'Contacto',
      body: [`${owner()}. Correo: ${LEGAL_OWNER.email}.`],
    },
  ],
};
