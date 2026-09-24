/**
 * Rovaro Customer Booking Terms — Spanish translation.
 * The English version is the authoritative legal version.
 */

const doc = {
  documentType: "customer-booking-terms",
  language: "es",
  jurisdiction: "EU",
  version: 1,
  effectiveFrom: null,
  content: {
    title: "Condiciones de Reserva de Rovaro",
    sections: [
      {
        id: "1",
        heading: "Quiénes somos",
        body: "{{operator.platformSentence}}\n\nEn estas Condiciones, Rovaro, nosotros y nuestro se refieren a {{operator.platformBrand}} y al operador identificado anteriormente. Usted y el Cliente se refieren a la persona que envía una solicitud de reserva a través de {{operator.primaryDomain}} o {{operator.spanishDomain}}.\n\nPuede escribirnos en cualquier momento a {{operator.legalEmail}}. Estas Condiciones se aplican a todas las solicitudes de reserva que envíe y a todas las reservas que realice a través de la plataforma, por lo que le rogamos que las lea antes de confirmar una solicitud.\n\nLa versión en inglés de este documento es la versión legal auténtica y prevalecerá en caso de discrepancia con esta traducción al español.",
      },
      {
        id: "2",
        heading: "Rovaro es un intermediario de reservas, no una empresa de alquiler de vehículos",
        body: "Rovaro es una plataforma de reservas en línea. Ponemos en contacto a clientes que desean alquilar un vehículo o contratar un traslado con empresas locales de alquiler que prestan esos servicios.\n\nRovaro no es propietaria de ningún vehículo ni lo arrienda, mantiene, asegura u opera. No empleamos conductores, no disponemos de flota propia y no prestamos nosotros mismos el servicio de alquiler. Lo que prestamos es el servicio de intermediación: mostrar las ofertas, transmitir su solicitud al Proveedor, cobrar el pago previo de reserva, confirmarle la reserva y asistirle en su comunicación con el Proveedor.\n\nPor ello, el vehículo, su estado, su cobertura de seguro, su documentación y su disponibilidad en el momento acordado son responsabilidad del Proveedor, dentro de los límites descritos en estas Condiciones y sin perjuicio de los derechos imperativos que le corresponden como consumidor.",
      },
      {
        id: "3",
        heading: "El Proveedor",
        body: "El Proveedor es la empresa local de alquiler de vehículos o el operador de traslados identificado en la página de la oferta y en su confirmación de reserva. El Proveedor es una empresa independiente: no es una sucursal, un agente ni una filial de Rovaro.\n\nEl Proveedor establece sus propias condiciones de alquiler, incluidos los importes de la fianza, la política de combustible, los límites de kilometraje, el seguro y las franquicias, las normas sobre conductores adicionales, las normas sobre circulación transfronteriza y las condiciones de devolución del vehículo. Dichas condiciones se ponen a su disposición antes de completar la reserva y el Proveedor se las vuelve a presentar en el momento de la entrega.\n\nCuando las condiciones propias del Proveedor y estas Condiciones regulan materias distintas, ambas se aplican de forma complementaria: estas Condiciones rigen su relación con Rovaro y las condiciones del Proveedor rigen el alquiler en sí.",
      },
      {
        id: "4",
        heading: "El Contrato de Alquiler y quiénes son las partes",
        body: "El Contrato de Alquiler del vehículo se celebra directamente entre usted y el Proveedor. Normalmente se firma en el punto de recogida, en el momento de la entrega del vehículo, una vez que el Proveedor ha comprobado su documentación.\n\nRovaro no es parte del Contrato de Alquiler. No lo firmamos, no adquirimos derechos en virtud del mismo y no asumimos las obligaciones que corresponden al Proveedor.\n\nDurante el período de alquiler, cuestiones como el estado del vehículo, el combustible, el kilometraje, los daños, las multas, los peajes, las prórrogas, los conductores adicionales y la devolución del vehículo se rigen por el Contrato de Alquiler y por las condiciones del Proveedor. Le recomendamos leer atentamente el Contrato de Alquiler antes de firmarlo y comunicar cualquier discrepancia al Proveedor en ese momento, así como a nosotros en {{operator.legalEmail}} si necesita nuestra ayuda.",
      },
      {
        id: "5",
        heading: "Envío de una solicitud de reserva",
        body: "Cuando completa el formulario de reserva y lo envía, está remitiendo una solicitud de reserva. Una solicitud de reserva no es una reserva confirmada y no obliga al Proveedor a facilitar un vehículo.\n\nTras el envío de la solicitud, la trasladamos al Proveedor para que compruebe si el vehículo está realmente disponible para las fechas, los horarios y la ubicación que ha seleccionado. Los precios y la disponibilidad mostrados en la plataforma reflejan la información facilitada por el Proveedor en ese momento y pueden variar antes de la confirmación.\n\nLe comunicaremos el resultado de la comprobación de disponibilidad por correo electrónico y en el área de reservas de la plataforma.",
      },
      {
        id: "6",
        heading: "Cuándo queda confirmada una reserva",
        body: "Una reserva queda confirmada únicamente cuando concurren ambas circunstancias siguientes:\n\n- el Proveedor ha confirmado que el vehículo está disponible para sus fechas, horarios y ubicación; y\n- usted ha abonado correctamente la tasa de reserva Rovaro no reembolsable aplicable descrita en estas Condiciones.\n\nCuando se cumplen ambas condiciones, le enviamos una confirmación que incluye un identificador de reserva. Ese identificador es la referencia de toda comunicación posterior relativa a la reserva. Hasta que lo reciba no existe reserva alguna, aunque ya haya recibido un mensaje informándole de que el vehículo está disponible.\n\nSi el Proveedor no confirma la disponibilidad, no se crea ninguna reserva y no se cobra la tasa de reserva. El rechazo del proveedor no activa ningún reembolso automático. Cualquier importe que se hubiera capturado se tramita únicamente cuando lo exija la normativa aplicable o Rovaro lo autorice expresamente en circunstancias excepcionales.",
      },
      {
        id: "7",
        heading: "La tasa de reserva Rovaro",
        body: "Para confirmar una reserva debe abonar una tasa de reserva Rovaro no reembolsable aplicable. {{settings.bookingFeeDisplayNote}} Los importes que se le muestran son:\n\n- Precio total del alquiler\n- Tasa de reserva Rovaro no reembolsable aplicable pagada online\n- Saldo restante pagado directamente al proveedor de alquiler\n\nLa Tasa se abona a Rovaro a través de Stripe, en la cuenta Stripe propia de Rovaro, y lo retiene íntegramente el Operador de la Plataforma. No es dinero custodiado para el Proveedor y ninguna parte se liquida ni se paga al Proveedor. Se imputa al calcular el saldo restante, de modo que no es un cargo adicional sobre el total anunciado. El Proveedor cobra únicamente el Saldo restante directamente de usted y no puede cobrar de nuevo el 100%.\n\nLa tasa de reserva Rovaro no es reembolsable, salvo cuando lo exija la normativa aplicable o Rovaro lo autorice expresamente en circunstancias excepcionales.\n\nLa tasa se cobra a través de nuestro proveedor de pagos mediante los métodos ofrecidos en el proceso de pago. Un cambio posterior del porcentaje configurado no altera el porcentaje ni los importes aceptados de una reserva existente.",
      },
      {
        id: "8",
        heading: "La tasa de reserva no es una fianza",
        body: "La tasa de reserva Rovaro no es una fianza, ni un depósito por daños, ni una garantía de franquicia. Es una tasa de plataforma no reembolsable retenida por Rovaro, imputada al calcular el saldo restante.\n\nCualquier fianza del vehículo es una cuestión independiente. La fija el Proveedor, la cobra el Proveedor en el momento de la entrega y es el Proveedor quien la retiene, la bloquea, la libera o la aplica conforme al Contrato de Alquiler y a sus propias condiciones. Rovaro nunca cobra la fianza, nunca la custodia y no puede liberarla.\n\nEl importe previsto de la fianza y los medios de pago que el Proveedor acepta para constituirla se indican en la página de la oferta antes de reservar. Las cuestiones relativas a la devolución de una fianza tras el alquiler deben plantearse al Proveedor, si bien puede escribirnos a {{operator.legalEmail}} y le ayudaremos a gestionar el asunto.",
      },
      {
        id: "9",
        heading: "El importe restante abonado al Proveedor",
        body: "Los importes de cada reserva son:\n\n- Precio total del alquiler\n- Tasa de reserva Rovaro no reembolsable aplicable pagada online\n- Saldo restante pagado directamente al proveedor de alquiler\n\nEl Saldo restante se abona directamente al Proveedor en el momento de la entrega. Rovaro no cobra este importe, no lo procesa y no lo paga al Proveedor. La Tasa se imputa al calcular el saldo restante. El Proveedor no puede cobrar de nuevo el 100%.\n\nEl saldo se abona mediante los métodos de pago que el Proveedor acepte. Dichos métodos figuran en la página de la oferta y pueden incluir efectivo, tarjeta de débito o tarjeta de crédito, según el Proveedor y la ubicación. Algunos Proveedores exigen una tarjeta a nombre del conductor principal, en particular cuando se utiliza la misma tarjeta para bloquear la fianza.\n\nSi no puede abonar el saldo mediante un método aceptado por el Proveedor, este podrá denegar la entrega del vehículo. Le recomendamos comprobar los métodos de pago aceptados antes de viajar.",
      },
      {
        id: "10",
        heading: "El enlace de pago y su caducidad",
        body: "Una vez que el Proveedor ha confirmado la disponibilidad, le enviamos un enlace de pago seguro para que abone el pago previo. El enlace es válido durante {{settings.paymentLinkExpirationMinutes}} minutos.\n\nEste plazo existe porque el vehículo queda bloqueado a su favor mientras el enlace permanece activo. Si el enlace caduca antes del pago, el bloqueo se libera, la reserva no se confirma y el vehículo puede ser contratado por otro cliente.\n\nSi su enlace caduca, puede solicitarnos uno nuevo en {{operator.legalEmail}} o desde el área de reservas de la plataforma. Todo enlace nuevo queda sujeto a una nueva comprobación de disponibilidad y el precio puede haber variado entretanto. La mera caducidad de un enlace no da lugar a ningún cargo.",
      },
      {
        id: "11",
        heading: "Precios, impuestos y contenido del precio",
        body: "Los precios se muestran en la moneda indicada en la página de la oferta e incluyen los impuestos aplicables al servicio de alquiler según la información facilitada por el Proveedor, salvo que la página de la oferta indique otra cosa.\n\nEl precio total del alquiler que se le muestra cubre el alquiler del vehículo durante el período seleccionado, así como los extras y las opciones de entrega que haya seleccionado. Los conceptos no incluidos, tales como seguros opcionales contratados en mostrador, combustible, equipamiento adicional añadido en la recogida, tasas por circulación transfronteriza, recargos por devolución tardía, peajes o multas de tráfico, los factura el Proveedor por separado conforme al Contrato de Alquiler.\n\nLos cargos por entrega y recogida, cuando se ofrecen, se calculan a partir de la dirección o ubicación que introduzca y se muestran antes de enviar su solicitud.",
      },
      {
        id: "12",
        heading: "Modificaciones de una reserva confirmada",
        body: "Si desea modificar las fechas, los horarios, el lugar de recogida o de devolución, el vehículo o el conductor de una reserva confirmada, escríbanos a {{operator.legalEmail}} indicando su identificador de reserva.\n\nToda modificación depende de la aceptación del Proveedor y de la disponibilidad. Una modificación puede aumentar o reducir el precio total. Si el precio aumenta, el importe adicional se liquidará conforme al régimen de pago de la reserva; si disminuye, la diferencia se reflejará en el saldo que abone en la entrega o se reembolsará cuando se haya producido un exceso de pago a Rovaro.\n\nHasta que le confirmemos la modificación por escrito, seguirá vigente la reserva original.",
      },
      {
        id: "13",
        heading: "Cancelación por su parte",
        body: "Puede cancelar una reserva en cualquier momento antes del inicio del alquiler escribiéndonos a {{operator.legalEmail}} con su identificador de reserva, o utilizando la opción de cancelación del área de reservas de la plataforma.\n\nLa tasa de reserva Rovaro no es reembolsable si cancela, si no se presenta, si no supera las comprobaciones de idoneidad o seguridad publicadas por el Proveedor, si su permiso de conducción es inválido, falso, caducado o inconsistente, si facilitó información incorrecta, o si se niega a la verificación de identidad o del permiso exigida, salvo cuando lo exija la normativa aplicable o Rovaro lo autorice expresamente en circunstancias excepcionales.\n\nNo existe un reembolso automático de la tasa de reserva cuando cancela. Cualquier reembolso voluntario lo autoriza Rovaro únicamente en circunstancias excepcionales y se tramita al medio de pago original.\n\nNada de lo dispuesto en esta sección afecta a cualquier derecho legal de desistimiento que pueda corresponderle. Le informamos de que, conforme a la normativa de consumo de la Unión Europea, el derecho de desistimiento en contratos a distancia no resulta aplicable, por regla general, a los contratos de servicios de alquiler de vehículos con fecha o período de ejecución determinados; cuando exista un derecho legal aplicable a su reserva, se indicará en la página de la oferta y prevalecerá sobre esta sección.",
      },
      {
        id: "14",
        heading: "Cancelación o falta de prestación por el Proveedor",
        body: "Si el Proveedor cancela una reserva confirmada, no facilita el vehículo en el lugar y momento acordados, o facilita un vehículo que no se corresponde con lo reservado sin que se acuerde con usted una alternativa aceptable, no hay reembolso automático de la tasa de reserva Rovaro. Cualquier reembolso se efectúa únicamente cuando lo exija la normativa aplicable o Rovaro lo autorice expresamente en circunstancias excepcionales.\n\nSiempre que sea posible, le ofreceremos un vehículo de sustitución de la misma categoría o de una categoría superior, en los términos descritos en la sección relativa a las ofertas de vehículo alternativo. Rechazar una sustitución no activa un reembolso automático de la tasa de reserva.\n\nEsta sección no limita los demás derechos que puedan corresponderle frente al Proveedor en virtud del Contrato de Alquiler o de la normativa de consumo aplicable, incluido el derecho a ser indemnizado por los daños causados por el Proveedor.",
      },
      {
        id: "15",
        heading: "Reembolsos",
        body: "La tasa de reserva Rovaro no es reembolsable, salvo cuando lo exija la normativa aplicable o Rovaro lo autorice expresamente en circunstancias excepcionales. No existe un reembolso automático por cancelación del cliente, incomparecencia, incumplimiento de comprobaciones de idoneidad o seguridad, permiso de conducción inválido, falso, caducado o inconsistente, información incorrecta, negativa a la verificación de identidad o del permiso, o rechazo del proveedor.\n\nCuando Rovaro autorice expresamente un reembolso, se efectúa al medio de pago que usted utilizó, salvo que dicho medio ya no exista y se acuerde otro con usted. Iniciamos los reembolsos autorizados en un plazo de {{settings.refundProcessingDays}} días desde su aprobación. El tiempo que tarde el importe en figurar en su extracto depende de su entidad bancaria o emisora de la tarjeta y queda fuera de nuestro control.\n\nLos importes abonados directamente al Proveedor, incluidos el saldo del precio del alquiler y cualquier fianza, los reembolsa el Proveedor conforme al Contrato de Alquiler y a sus propias condiciones. Le asistiremos en el contacto con el Proveedor cuando proceda tal reembolso.",
      },
      {
        id: "16",
        heading: "Ofertas de vehículo alternativo",
        body: "En ocasiones un vehículo deja de estar disponible después de haberse confirmado una reserva, por ejemplo a causa de un accidente, una avería mecánica o la devolución tardía por parte de un cliente anterior.\n\nEn tal caso, el Proveedor podrá ofrecer un vehículo alternativo. Toda alternativa debe ser de la misma categoría o de una categoría superior, no puede ofrecerse a un precio superior al de la reserva ya realizada y no puede presentar características esenciales empeoradas, tales como el número de plazas, el tipo de transmisión, el tipo de combustible o energía, la capacidad de equipaje o el aire acondicionado.\n\nUsted visualiza el vehículo alternativo en el área de reservas de la plataforma, con su ficha técnica y sus fotografías, junto con el precio, antes de tomar cualquier decisión. Debe aceptar expresamente la alternativa antes de que se solicite o se impute pago alguno a la misma. Ningún vehículo se sustituye de forma silenciosa y en ningún caso interpretamos su silencio como aceptación.\n\nLa oferta alternativa caduca transcurridas {{settings.alternativeOfferExpirationHours}} horas desde su emisión. Si rechaza la alternativa, o si la oferta caduca sin su aceptación, la tasa de reserva Rovaro se retiene. No hay reembolso automático, salvo cuando lo exija la normativa aplicable o Rovaro lo autorice expresamente en circunstancias excepcionales.",
      },
      {
        id: "17",
        heading: "Exactitud de la información que debe facilitar",
        body: "Debe facilitar información completa y exacta al enviar una solicitud de reserva y al responder a nuestras comunicaciones sobre ella. Ello incluye el nombre del conductor principal tal y como figura en el permiso de conducción, su dirección de correo electrónico y su número de teléfono, los datos de cualquier conductor adicional y, en recogidas y entregas en aeropuerto, el número de vuelo y la hora de llegada.\n\nUnos datos de contacto exactos son esenciales porque la confirmación de disponibilidad, el enlace de pago y cualquier oferta de vehículo alternativo están sujetos a plazo y se envían a la dirección y al número que usted facilite. Unos datos de vuelo exactos son esenciales porque el Proveedor los utiliza para controlar retrasos y planificar la entrega.\n\nSi la información facilitada es incorrecta o incompleta, el Proveedor podría no poder entregar el vehículo. En tal caso, la tasa de reserva Rovaro se retiene. No hay reembolso automático, salvo cuando lo exija la normativa aplicable o Rovaro lo autorice expresamente en circunstancias excepcionales.",
      },
      {
        id: "18",
        heading: "Permiso de conducción, edad y comprobación de requisitos",
        body: "Los requisitos de permiso de conducción, las edades mínima y máxima del conductor, la antigüedad mínima del permiso, los recargos por conductor joven y la admisibilidad del permiso internacional de conducción los establece el Proveedor y, en su caso, la legislación del país del alquiler. Se indican en la página de la oferta antes de reservar.\n\nRovaro no verifica su habilitación para conducir ni garantiza que vaya a ser aceptado como conductor. La decisión corresponde al Proveedor en el momento en que examina la documentación original en la entrega. El Proveedor podrá denegar la entrega del vehículo si la documentación falta, está caducada, no es admitida en el país del alquiler o no coincide con la reserva, o si se niega a la verificación de identidad o del permiso exigida.\n\nSi el Proveedor deniega la entrega porque la documentación no cumple los requisitos publicados, porque el permiso es inválido, falso, caducado o inconsistente, porque no supera las comprobaciones de idoneidad o seguridad publicadas, o porque se niega a la verificación, la tasa de reserva Rovaro se retiene. No hay reembolso automático, salvo cuando lo exija la normativa aplicable o Rovaro lo autorice expresamente en circunstancias excepcionales.",
      },
      {
        id: "19",
        heading: "Comunicaciones y plazos de respuesta",
        body: "Nos comunicamos con usted por correo electrónico y a través del área de reservas de la plataforma, utilizando los datos de contacto que nos haya facilitado.\n\nProcuramos responder a una solicitud ordinaria en un plazo de {{settings.standardRequestResponseHours}} horas. Cuando la solicitud sea urgente, en particular si la recogida es inminente, procuramos responder en un plazo de {{settings.urgentRequestResponseMinutes}} minutos.\n\nCuando sea necesario sustituir un vehículo, procuramos notificárselo en un plazo de {{settings.replacementNotificationHours}} horas desde que el Proveedor nos lo comunique. Se trata de objetivos de servicio y no de garantías contractuales, y no afectan a sus derechos legales.",
      },
      {
        id: "20",
        heading: "Reclamaciones",
        body: "Si algo no funciona correctamente, escríbanos a {{operator.legalEmail}} indicando su identificador de reserva y describiendo lo sucedido. Las fotografías, el Contrato de Alquiler y cualquier documento del mostrador nos ayudan a resolver el asunto con rapidez.\n\nAcusamos recibo y respondemos a las reclamaciones de clientes en un plazo de {{settings.customerComplaintResponseHours}} horas. Cuando la reclamación se refiera al desarrollo del alquiler en sí, la trasladaremos al Proveedor y le mantendremos informado del resultado, sin perjuicio de que el Proveedor es la parte responsable conforme al Contrato de Alquiler.\n\nPresentarnos una reclamación no le impide dirigirse directamente al Proveedor ni utilizar las vías de resolución de conflictos descritas en estas Condiciones.",
      },
      {
        id: "21",
        heading: "Limitación de responsabilidad",
        body: "Respondemos de la prestación del servicio de intermediación de reservas con la diligencia y la pericia razonables, así como de los daños que sean consecuencia previsible del incumplimiento de dicho deber.\n\nEn la medida permitida por la normativa de consumo aplicable, no respondemos de la prestación del servicio de alquiler en sí, de los actos u omisiones del Proveedor, del estado o la aptitud para la circulación del vehículo, de la cobertura de seguro que facilite el Proveedor, de los cargos que el Proveedor aplique conforme al Contrato de Alquiler, ni de los daños derivados de información inexacta facilitada por usted. Igualmente, en la medida permitida por la ley, no respondemos de los acontecimientos ajenos a nuestro control razonable.\n\nNada de lo dispuesto en estas Condiciones excluye o limita responsabilidad alguna que no pueda excluirse o limitarse legalmente. Ello comprende la responsabilidad por fallecimiento o daños personales causados por negligencia, la responsabilidad por dolo o declaraciones fraudulentas y cualquier responsabilidad derivada de normas imperativas de consumo que le resulten aplicables. Estas Condiciones no afectan a sus derechos legales como consumidor.",
      },
      {
        id: "22",
        heading: "Ley aplicable, derechos del consumidor y resolución de conflictos",
        body: "El contrato celebrado entre usted y Rovaro relativo al servicio de intermediación de reservas se rige por la ley de Irlanda.\n\nEsta elección de ley no le priva, en su condición de consumidor, de la protección que le proporcionen las disposiciones que no puedan excluirse mediante acuerdo en virtud de la ley del país en el que tenga su residencia habitual. Si reside en España o en otro país de la Unión Europea o del Espacio Económico Europeo, conserva la protección imperativa de consumo de dicho país y puede ejercitar acciones ante los tribunales de su país de residencia.\n\nEl Contrato de Alquiler con el Proveedor se rige por sus propias condiciones y, por regla general, por la ley del país en el que se alquile el vehículo.\n\nSi es usted consumidor en la Unión Europea, también puede someter una controversia a la plataforma de resolución de litigios en línea de la Comisión Europea, disponible en https://ec.europa.eu/consumers/odr. Antes de utilizarla, le rogamos que se ponga en contacto con nosotros en {{operator.legalEmail}} para intentar resolver el asunto directamente.",
      },
      {
        id: "23",
        heading: "Modificaciones de estas Condiciones",
        body: "Podemos actualizar estas Condiciones, por ejemplo para reflejar cambios en el servicio, en nuestros mecanismos de pago o en la legislación.\n\nLa versión aplicable a una reserva es la que estuviera publicada en el momento en que envió la correspondiente solicitud de reserva. Una modificación de estas Condiciones no altera una reserva ya confirmada.\n\nLa versión vigente está siempre disponible en la plataforma y los cambios sustanciales se notifican del modo indicado en la página publicada.",
      },
      {
        id: "24",
        heading: "Datos del operador legal",
        body: "La plataforma es operada por {{operator.description}}.\n\nNombre comercial: {{operator.tradingName}}. Marca de la plataforma: {{operator.platformBrand}}. País de establecimiento: {{operator.country}}. Forma jurídica: {{operator.legalStructure}}.\n\nDirección de contacto para asuntos legales y contractuales: {{operator.legalEmail}}. Sitios web de la plataforma: {{operator.primaryDomain}} y {{operator.spanishDomain}}.",
      },
      {
        id: "24.1",
        heading: "Domicilio profesional del operador",
        body: "Domicilio profesional del operador: {{operator.businessAddress}}.\n\nLa correspondencia escrita relativa a estas Condiciones puede remitirse a dicho domicilio, si bien el correo electrónico dirigido a {{operator.legalEmail}} es la vía más rápida y el canal que atendemos para los asuntos de reservas.",
        requires: ["businessAddress"],
      },
      {
        id: "24.2",
        heading: "Nombre comercial registrado",
        body: "Nombre comercial registrado: {{operator.tradingName}}, número de nombre comercial {{operator.businessNameNumber}}, registrado en {{operator.country}}.",
        requires: ["businessNameNumber"],
      },
      {
        id: "24.3",
        heading: "Vehículo y precio confirmados",
        body: "El Proveedor debe entregar el vehículo confirmado. Si ese vehículo no está disponible, puede ofrecer la misma clase o una superior al mismo precio. Cualquier sustitución requiere su acuerdo explícito. El Proveedor no puede aumentar el precio confirmado sin su acuerdo explícito. Si usted rechaza el cambio de vehículo o de precio, la reserva se cancela y la tarifa de reserva se reembolsa íntegramente. Cuando el incumplimiento estaba bajo el control del Proveedor, este reembolsa a Rovaro la tarifa devuelta. Los incumplimientos graves o reiterados pueden dar lugar a restricciones, suspensión o resolución. Esto no impone una penalización automática igual al precio total del alquiler.",
      },
      {
        id: "25",
        heading: "Versión y fecha de entrada en vigor",
        body: "Esta es la versión 1 de las Condiciones de Reserva de Rovaro.\n\nLa fecha de entrada en vigor de esta versión figura en la página publicada de la plataforma. Las versiones anteriores siguen siendo aplicables a las reservas realizadas mientras estuvieron vigentes, y conservamos constancia de la versión aplicable a cada reserva.",
      }
    ],
  },
};

export default doc;
