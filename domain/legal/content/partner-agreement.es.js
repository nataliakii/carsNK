/**
 * Rovaro Partner Agreement — Spanish translation.
 * The English version is the authoritative legal version.
 * Requires professional legal review before production publication.
 */

const doc = {
  documentType: "partner-agreement",
  language: "es",
  jurisdiction: "EU",
  version: 1,
  effectiveFrom: null,
  content: {
    title: "Contrato de Colaboración de Rovaro",
    sections: [
      {
        id: "1",
        heading: "Partes",
        body: "El presente Contrato de Colaboración (el Contrato) se celebra entre {{operator.description}}, operador de la plataforma {{operator.platformBrand}} (el Operador), y la empresa de alquiler que registra una cuenta de colaborador en la plataforma y es admitida para la operativa comercial (el Proveedor).\n\n{{operator.platformSentence}} El Operador es un empresario individual establecido en {{operator.country}} y no es una sociedad mercantil; las referencias del presente Contrato al Operador se entienden hechas a dicha persona física que opera bajo el nombre comercial {{operator.tradingName}}.\n\nEl Contrato se acepta por vía electrónica por un representante autorizado del Proveedor. La aceptación comprende el presente Contrato junto con las Normas Operativas para Colaboradores y el Anexo de Protección de Datos, que forman parte integrante del mismo.\n\nLa versión en inglés es la versión jurídica auténtica y prevalecerá en caso de discrepancia con esta traducción.",
      },
      {
        id: "1.1",
        heading: "Domicilio profesional del Operador",
        body: "El domicilio profesional del Operador a los efectos del presente Contrato es {{operator.businessAddress}}.",
        requires: ["businessAddress"],
      },
      {
        id: "1.2",
        heading: "Nombre comercial registrado",
        body: "El nombre comercial {{operator.tradingName}} está inscrito en {{operator.country}} con el número de nombre comercial registrado {{operator.businessNameNumber}}.",
        requires: ["businessNameNumber"],
      },
      {
        id: "2",
        heading: "Definiciones",
        body: "A los efectos del presente Contrato, los siguientes términos tienen el significado que se indica a continuación.\n\n- Operador o Plataforma: {{operator.description}}, que actúa como operador de {{operator.platformBrand}} y de los sitios web {{operator.primaryDomain}} y {{operator.spanishDomain}}.\n- Proveedor: la empresa de alquiler u otro proveedor profesional de vehículos que publica vehículos en la Plataforma y presta el servicio de alquiler.\n- Cliente: la persona física o jurídica que realiza una Reserva a través de la Plataforma, así como cualquier conductor adicional identificado en la documentación del alquiler.\n- Reserva: la solicitud de un vehículo determinado para un periodo y una ubicación determinados que ha sido confirmada en la Plataforma tras el pago del Prepago de Reserva.\n- Prepago de Reserva: el importe abonado por el Cliente al Operador en el momento de la reserva, equivalente al porcentaje aplicable del precio total del alquiler, que garantiza la reserva y se imputa a dicho precio.\n- Saldo: el Saldo restante del precio total del alquiler, pagadero por el Cliente directamente al Proveedor en el momento de la entrega del vehículo.\n- Contrato de Alquiler: el contrato de arrendamiento del vehículo celebrado directamente entre el Proveedor y el Cliente, incluidas las condiciones generales de alquiler del propio Proveedor y la documentación de entrega.\n- Configuración de la Plataforma: los parámetros comerciales y operativos configurables mantenidos por el Operador y mostrados al Proveedor en su cuenta de colaborador.",
      },
      {
        id: "3",
        heading: "Función de las partes",
        body: "{{operator.platformBrand}} es un intermediario de reservas en línea. El Operador facilita una plataforma técnica y comercial mediante la cual el Cliente puede buscar, comparar y reservar vehículos ofrecidos por el Proveedor, y a través de la cual se tramita el Prepago de Reserva.\n\nEl Proveedor es el prestador directo del servicio de alquiler. El Operador no es propietario, arrendatario, explotador, responsable del mantenimiento ni asegurador de ningún vehículo publicado en la Plataforma, y no emplea al personal que prepara o entrega los vehículos.\n\nEl contrato de arrendamiento del vehículo se celebra directamente entre el Proveedor y el Cliente. El Operador no es parte de dicho contrato, no actúa como arrendador y no asume las obligaciones propias del arrendador.\n\nEl Proveedor es plenamente responsable del vehículo y de la ejecución del alquiler, incluidos su estado técnico, su aptitud para la circulación, su limpieza, su documentación, la cobertura de seguro, la entrega y la devolución, así como de todas las manifestaciones realizadas al Cliente sobre el vehículo.",
      },
      {
        id: "4",
        heading: "Alcance y límites de la responsabilidad del Operador",
        body: "El Operador responde únicamente de su propio servicio de reserva. Dicha responsabilidad comprende el funcionamiento y la disponibilidad de la Plataforma, la transmisión exacta de los datos de la Reserva al Proveedor, la correcta tramitación del Prepago de Reserva, la emisión de la confirmación al Cliente y la gestión de las devoluciones de los importes que el propio Operador haya percibido.\n\nEl Operador no responde del estado, la disponibilidad, la legalidad o la idoneidad de un vehículo, de la conducta del personal del Proveedor, del contenido del Contrato de Alquiler, de las fianzas percibidas por el Proveedor, ni de daños, multas, peajes o controversias surgidos durante el periodo de alquiler.\n\nNada de lo dispuesto en esta cláusula limita la responsabilidad que no pueda limitarse conforme a la normativa imperativa aplicable.",
      },
      {
        id: "5",
        heading: "Información de verificación del Proveedor",
        body: "Con carácter previo a la activación, y de forma permanente con posterioridad, el Proveedor debe facilitar al Operador información exacta y actualizada sobre los siguientes extremos.\n\n- Denominación legal de la entidad o del empresario individual.\n- Nombre comercial utilizado en el tráfico mercantil, cuando sea distinto.\n- Forma jurídica y país de registro.\n- Número de inscripción en el registro del país de establecimiento.\n- NIF o CIF español, cuando el Proveedor opere en España.\n- Número de IVA, cuando el Proveedor esté dado de alta a efectos de IVA.\n- Domicilio social y domicilio profesional.\n- Nombre del administrador o firmante autorizado que acepta el presente Contrato y acreditación de su poder de representación.\n- Dirección de correo electrónico y número de teléfono profesionales para el contacto comercial y operativo.\n- Licencias y autorizaciones exigidas para la actividad de alquiler de vehículos, cuando resulten aplicables en el país o la región de operación.\n- Información sobre el seguro de la flota ofrecida en la Plataforma, con indicación de la aseguradora y del alcance de la cobertura.\n- Acreditación de que el Proveedor es propietario de los vehículos publicados o está contractualmente autorizado para arrendarlos.\n\nEl Operador no remite importes de alquiler al Proveedor y no opera un ciclo de liquidación ni de pagos para las Reservas. El Proveedor no está obligado a facilitar datos bancarios de liquidación para el precio del alquiler. El Prepago de Reserva es retenido por el Operador como su comisión de marketplace. El Saldo restante lo cobra el Proveedor directamente del Cliente.\n\nEl Proveedor garantiza que toda la información facilitada es veraz y que los documentos justificativos son auténticos.",
      },
      {
        id: "6",
        heading: "Estados de verificación y activación",
        body: "Cada cuenta de colaborador tiene en todo momento un único estado de verificación. Los estados son DRAFT, PENDING_VERIFICATION, VERIFIED, SUSPENDED y REJECTED.\n\n- DRAFT: el perfil del colaborador se ha creado pero no se ha remitido para su verificación.\n- PENDING_VERIFICATION: el perfil se ha remitido y el Operador está revisando la información y la documentación.\n- VERIFIED: la revisión ha concluido satisfactoriamente y la cuenta queda activada para la operativa comercial.\n- SUSPENDED: la operativa comercial se ha interrumpido temporalmente conforme al presente Contrato.\n- REJECTED: la solicitud ha sido denegada y la cuenta no se activa.\n\nÚnicamente la cuenta con estado VERIFIED queda activada para la operativa comercial. El colaborador que no esté verificado no puede publicar anuncios reservables ni recibir Reservas. La obtención del estado VERIFIED no constituye asesoramiento, certificación ni garantía alguna del Operador respecto del negocio del Proveedor, que sigue siendo el único responsable de su propio cumplimiento normativo.\n\nEl Proveedor debe comunicar al Operador sin dilación indebida cualquier modificación de la información indicada en esta cláusula y, en todo caso, antes de que dicha modificación surta efectos comerciales.",
      },
      {
        id: "7",
        heading: "Anuncios, titularidad del vehículo y autorización",
        body: "El Proveedor es responsable del contenido de cada anuncio. Todo anuncio debe describir un vehículo que el Proveedor pueda efectivamente suministrar, en la categoría y con las especificaciones indicadas y en las ubicaciones señaladas.\n\nEl Proveedor garantiza que es propietario de cada vehículo publicado o que ostenta un derecho contractual válido para arrendarlo, y que su publicación en la Plataforma no infringe ningún acuerdo de financiación, arrendamiento financiero, gestión de flota o seguro.\n\nLas fotografías deben mostrar el vehículo real o, cuando la oferta se realice por categorías, presentarse con claridad como representativas de la categoría. Las descripciones, los listados de equipamiento y las categorías de vehículo no pueden inducir a error al Cliente.",
      },
      {
        id: "8",
        heading: "Fijación del precio, transparencia e integridad del precio",
        body: "El Proveedor fija el precio íntegro del alquiler para cada vehículo y periodo. El precio publicado en la Plataforma debe ser el precio completo pagadero por el Cliente por el alquiler configurado e incluir todos los impuestos, tributos y cargos obligatorios aplicables a dicho alquiler.\n\nQuedan prohibidos los pagos obligatorios ocultos. Todo importe que el Cliente deba abonar para poder retirar el vehículo constituye un cargo obligatorio y debe reflejarse en el precio publicado o, cuando la Plataforma disponga de un campo específico, declararse en dicho campo antes de que el Cliente complete la Reserva. Los cargos genuinamente opcionales deben presentarse como tales.\n\nUna vez confirmada la Reserva y recibido el Prepago de Reserva, el Proveedor no puede incrementar el precio, introducir cargos obligatorios adicionales ni empeorar las condiciones del alquiler, incluidas la franquicia, el importe de la fianza, el límite de kilometraje, la política de combustible, las coberturas incluidas o las condiciones de entrega pactadas.",
      },
      {
        id: "9",
        heading: "Prepago de Reserva y Saldo",
        body: "El Cliente abona al Operador una Tasa de Reserva Rovaro no reembolsable equivalente al porcentaje aplicable del precio total del alquiler en el momento de la reserva. El Operador confirma la Reserva al Cliente y al Proveedor una vez que dicho pago se ha realizado con éxito.\n\nEl Saldo restante del precio total del alquiler constituye el Saldo. El Saldo lo abona el Cliente directamente al Proveedor en el momento de la entrega del vehículo, conforme a las condiciones de pago del propio Proveedor publicadas en la Plataforma.\n\nLa Tasa de Reserva Rovaro se imputa al calcular el Saldo restante. El Proveedor debe imputar esa Tasa al precio total y no puede cobrar de nuevo el 100%. Ninguna parte de la Tasa se custodia para el Proveedor ni se le paga.",
      },
      {
        id: "10",
        heading: "La Tasa de Reserva Rovaro la retiene íntegramente el Operador",
        body: "Como contraprestación por los servicios de intermediación, reserva y pago prestados por el Operador, el Operador retiene la Tasa de Reserva Rovaro aplicable del precio total del alquiler. {{settings.bookingFeeDisplayNote}}\n\nDicho importe es cobrado por Stripe al Cliente y abonado en la cuenta Stripe propia del Operador. El Operador retiene íntegramente la Tasa de Reserva. No es dinero custodiado para el Proveedor. No existe un porcentaje de comisión distinto, ni una comisión mínima, ni una transferencia de parte de la Tasa al Proveedor.\n\nEl Saldo restante lo abona el Cliente directamente al Proveedor en la entrega. El Proveedor cobra el Saldo directamente del Cliente en la entrega y debe imputar la Tasa de Reserva al precio total del alquiler. El Proveedor no puede cobrar de nuevo el 100% del precio.\n\nEl Operador no procesa el Saldo, no utiliza Stripe Connect para las Reservas, no crea un pago al proveedor y no opera un ciclo de liquidación del precio del alquiler.",
      },
      {
        id: "11",
        heading: "Cómo se calcula la Tasa de Reserva y el resumen económico",
        body: "La Tasa de Reserva Rovaro se calcula sobre el precio total del alquiler, que incluye el alquiler del vehículo para el periodo reservado junto con los cargos de entrega y recogida, los extras opcionales y las mejoras de seguro seleccionados en la reserva.\n\nLas comisiones de procesamiento de Stripe sobre la Tasa de Reserva las soporta el Operador con cargo al importe que retiene. No se deducen del Saldo ni se repercuten al Proveedor.\n\nPara cada Reserva, la Plataforma registra un resumen económico con el precio total del alquiler, el importe pagado online al Operador y el importe restante a pagar directamente al Proveedor. {{settings.bookingFeeDisplayNote}} Un cambio posterior del porcentaje configurado no altera el porcentaje ni los importes aceptados de una Reserva existente. Ese resumen es el registro de referencia. No crea un pago al proveedor.",
      },
      {
        id: "12",
        heading: "La fianza es distinta de la Tasa de Reserva Rovaro",
        body: "La Tasa de Reserva Rovaro no es una fianza, ni un depósito en garantía por daños, ni una garantía de ningún tipo. Es una tasa de plataforma no reembolsable retenida íntegramente por el Operador e imputada al calcular el Saldo restante.\n\nToda fianza exigida por el vehículo constituye un importe distinto, fijado por el Proveedor, percibido por el Proveedor directamente del Cliente en el momento de la entrega, custodiado por el Proveedor y liberado por el Proveedor. El Operador no percibe ni custodia fianzas y carece de facultad alguna sobre su retención o devolución.\n\nEl Proveedor debe informar del importe, del medio de cobro y de las condiciones de devolución de cualquier fianza antes de que el Cliente complete la Reserva.",
      },
      {
        id: "13",
        heading: "Garantías y obligaciones del Proveedor",
        body: "El Proveedor garantiza y se obliga, durante toda la vigencia del presente Contrato, a lo siguiente:\n\n- que ejerce su actividad de forma lícita y dispone de todas las habilitaciones, licencias y autorizaciones exigidas para su actividad de alquiler de vehículos;\n- que todo vehículo ofrecido cuenta con un seguro comercial válido y adecuado al uso en alquiler durante todo el periodo en que se ofrece;\n- que todo vehículo es apto para la circulación, dispone de la inspección técnica en vigor cuando resulte exigible y se mantiene conforme al plan del fabricante y a la normativa aplicable;\n- que el vehículo suministrado se corresponde con el anuncio en categoría, especificaciones y características esenciales;\n- que los precios, los calendarios de disponibilidad, los importes de franquicia, los importes de fianza, los límites de kilometraje, la política de combustible, las reglas de circulación transfronteriza y los cargos adicionales publicados en la Plataforma son exactos y se mantienen actualizados;\n- que entrega a cada Cliente su propio Contrato de Alquiler y la documentación de entrega en una lengua que el Cliente pueda comprender razonablemente;\n- que cumple la normativa española y de la Unión Europea aplicable, incluida la relativa a protección de los consumidores, tráfico y seguridad vial, seguros y fiscalidad; y\n- que trata los datos personales de los Clientes de forma lícita y conforme al Anexo de Protección de Datos.",
      },
      {
        id: "14",
        heading: "El Contrato de Alquiler del Proveedor con el Cliente",
        body: "El Proveedor debe presentar su Contrato de Alquiler al Cliente antes de la entrega o en el momento de esta, y no puede incluir en él ninguna cláusula que contradiga las condiciones publicadas en la Plataforma para esa Reserva ni que menoscabe los derechos adquiridos por el Cliente al realizar la Reserva.\n\nCuando el Contrato de Alquiler del Proveedor contenga cláusulas menos favorables para el Cliente que las condiciones publicadas en la Plataforma, prevalecerán dichas condiciones publicadas en la relación entre el Operador y el Proveedor, y el Proveedor soportará las consecuencias de la discrepancia.\n\nEl Proveedor facilitará al Operador, cuando este lo solicite, una copia de su Contrato de Alquiler tipo y de las condiciones generales aplicadas a los Clientes captados a través de la Plataforma.",
      },
      {
        id: "15",
        heading: "Indisponibilidad del vehículo, sustitución y consentimiento del Cliente",
        body: "Si el vehículo reservado deja de estar disponible, el Proveedor debe intentar en primer lugar suministrar ese mismo vehículo. Si ello resulta imposible, debe ofrecer un vehículo de sustitución de categoría igual o superior.\n\nLa oferta de sustitución debe cumplir todas las condiciones siguientes: el precio pagadero por el Cliente no puede incrementarse; no pueden empeorarse las características esenciales del vehículo, incluidos el tipo de transmisión, el número de plazas, la capacidad de equipaje, el tipo de combustible o de energía, el aire acondicionado, el kilometraje incluido y las condiciones de seguro; y deben mostrarse al Cliente los datos y las fotografías del vehículo alternativo antes de que lo acepte.\n\nToda sustitución sustancial exige el consentimiento expreso del Cliente, registrado a través de la Plataforma. En ningún caso podrá sustituirse un vehículo de forma automática, tácita o en el mostrador sin que el Cliente haya consentido la alternativa concreta ofrecida. Si el Cliente no presta su consentimiento, la Reserva se considerará cancelada por el Proveedor.",
      },
      {
        id: "16",
        heading: "Cancelación por el Proveedor de una Reserva ya pagada",
        body: "Si el Proveedor cancela una Reserva cuya Tasa de Reserva Rovaro ya se ha percibido, se producirán las consecuencias siguientes.\n\n- No hay reembolso automático de la Tasa de Reserva Rovaro. Cualquier reembolso se efectúa únicamente cuando lo exija la normativa aplicable o Rovaro lo autorice expresamente en circunstancias excepcionales.\n- El Proveedor reembolsará al Operador los costes documentados de procesamiento de pagos, devolución y retrocesión de cargos soportados en relación con la Reserva cancelada cuando se autorice un reembolso.\n- El Proveedor abonará el cargo por servicio previsto en la Configuración de la Plataforma para la cancelación por el proveedor, actualmente {{settings.supplierCancellationServiceCharge}}.\n\nUn ADMIN de la empresa de alquiler no puede iniciar el reembolso de la Tasa. El rechazo del proveedor no activa un reembolso automático.\n\nEstas consecuencias no se aplicarán cuando la cancelación derive de un acontecimiento ajeno al control razonable del Proveedor que este acredite a satisfacción razonable del Operador, ni cuando el Cliente haya aceptado la cancelación.",
      },
      {
        id: "17",
        heading: "Cancelación tardía, incomparecencia del Proveedor y diferencia de coste de sustitución",
        body: "Cuando el Proveedor cancele de forma tardía, o no entregue el vehículo en el momento y lugar convenidos sin haber ofrecido una sustitución aceptable, el Operador podrá gestionar un alquiler de sustitución equivalente para el Cliente.\n\nEn tal caso, el Proveedor reembolsará la diferencia de coste razonable y acreditada entre la Reserva original y el alquiler de sustitución equivalente, hasta el límite máximo configurado en la Configuración de la Plataforma, actualmente {{settings.replacementCostDifferenceCap}}. El reembolso se efectuará previa presentación de la documentación acreditativa del alquiler de sustitución efectivamente contratado.\n\nEl Proveedor deberá comunicar al Operador la necesidad de sustituir un vehículo con al menos {{settings.replacementNotificationHours}} horas de antelación respecto de la entrega prevista o, si las circunstancias surgieran con posterioridad, de forma inmediata.",
      },
      {
        id: "18",
        heading: "Naturaleza de los importes configurados",
        body: "El cargo por servicio en caso de cancelación por el proveedor y el límite máximo de la diferencia de coste de sustitución se fijan en la Configuración de la Plataforma y son visibles para el Proveedor en su cuenta de colaborador en todo momento. No quedan fijados por el presente texto y solo pueden modificarse conforme a la cláusula relativa a la modificación de las condiciones.\n\nLas partes convienen en que dichos importes constituyen una estimación anticipada y razonable del perjuicio sufrido por el Operador y por el Cliente cuando una Reserva confirmada se frustra por causa del Proveedor, incluidos los costes de atención al cliente, los costes de pago y devolución, el daño reputacional y el coste de reubicar al Cliente. No tienen carácter de pena convencional ni finalidad punitiva.",
      },
      {
        id: "19",
        heading: "Plazos de respuesta",
        body: "El Proveedor debe atender las solicitudes transmitidas a través de la Plataforma dentro de los plazos configurados en la Configuración de la Plataforma.\n\n- Solicitudes ordinarias, incluidas confirmaciones de reserva, solicitudes de modificación y peticiones de información: en un plazo de {{settings.standardRequestResponseHours}} horas.\n- Solicitudes urgentes, incluidas las relativas a entregas del mismo día o inminentes: en un plazo de {{settings.urgentRequestResponseMinutes}} minutos.\n- Reclamaciones de Clientes remitidas por el Operador: en un plazo de {{settings.partnerComplaintResponseHours}} horas.\n\nEl incumplimiento reiterado de estos plazos constituye causa de reducción de visibilidad, de suspensión de anuncios o de suspensión de la cuenta de colaborador.",
      },
      {
        id: "20",
        heading: "Comunicación de incidencias",
        body: "El Proveedor debe informar al Operador en un plazo de {{settings.incidentReportingHours}} horas desde que tenga conocimiento de cualquiera de las siguientes circunstancias: un accidente que afecte a un vehículo alquilado a través de la Plataforma; la imposibilidad de entregar un vehículo reservado; una controversia con una aseguradora que afecte a la cobertura de un vehículo ofrecido en la Plataforma; una reclamación grave de un Cliente; la retirada o suspensión de una licencia, autorización o póliza de seguro; o cualquier hecho que pueda impedir al Proveedor ejecutar Reservas confirmadas.\n\nLa comunicación se remitirá a través de la Plataforma cuando exista un canal habilitado y, en su defecto, a {{operator.legalEmail}}, e incluirá las referencias de las Reservas afectadas y las medidas que el Proveedor se propone adoptar.",
      },
      {
        id: "21",
        heading: "Ocultación de un vehículo, retirada de anuncios y suspensión de la cuenta",
        body: "El Operador podrá ocultar o retirar un vehículo concreto cuando el anuncio sea inexacto o engañoso, cuando falte o haya caducado la documentación o la acreditación del seguro exigidas, cuando el calendario resulte manifiestamente poco fiable, cuando el vehículo haya generado reclamaciones fundadas reiteradas o cuando el anuncio pueda infringir la normativa aplicable.\n\nEl Operador podrá suspender una cuenta de colaborador cuando la información de verificación sea sustancialmente inexacta o haya dejado de estar actualizada, cuando haya caducado una habilitación o una cobertura de seguro exigidas, cuando el Proveedor cancele reiteradamente Reservas confirmadas o no entregue los vehículos, cuando incumpla de forma reiterada los plazos de respuesta, cuando exista sospecha razonable de fraude o de actividad ilícita, o cuando la suspensión resulte necesaria para proteger a los Clientes.\n\nSalvo cuando sea necesaria una medida inmediata para proteger a los Clientes o para cumplir la ley, el Operador comunicará al Proveedor una motivación y le dará la oportunidad de subsanar la situación antes de que la medida surta efecto. En todo caso, la motivación se facilitará tan pronto como resulte razonablemente posible.",
      },
      {
        id: "22",
        heading: "Resolución y ejecución de las Reservas confirmadas",
        body: "Cualquiera de las partes podrá resolver el presente Contrato sin necesidad de causa mediante preaviso por escrito de treinta días. El Operador podrá resolverlo con efecto inmediato cuando el Proveedor incurra en un incumplimiento esencial no subsanado en un plazo razonable, cuando el Proveedor sea objeto de un procedimiento concursal, cuando haya caducado definitivamente una habilitación o una cobertura de seguro exigidas, o cuando la continuidad de la colaboración expusiera a los Clientes o al Operador a un riesgo grave.\n\nLa resolución no afecta a las Reservas ya confirmadas. Salvo que el Operador disponga otra cosa en la comunicación, el Proveedor deberá ejecutar todas las Reservas confirmadas cuya fecha de entrega sea anterior o posterior a la fecha de resolución, y las condiciones comerciales del presente Contrato, incluida la Tasa de Reserva retenida por el Operador y las consecuencias de la cancelación por el proveedor, seguirán aplicándose a dichas Reservas hasta su ejecución o devolución.\n\nLas cláusulas que por su naturaleza estén destinadas a subsistir tras la resolución, incluidas las relativas a responsabilidad, protección de datos, confidencialidad y ley aplicable, permanecerán en vigor.",
      },
      {
        id: "23",
        heading: "Reclamaciones del colaborador y procedimiento de revisión",
        body: "El Proveedor podrá presentar una reclamación frente a una decisión del Operador, incluidas la ocultación de un anuncio, la suspensión de la cuenta o la aplicación de un cargo por servicio, a través del canal de reclamaciones de la cuenta de colaborador o mediante escrito dirigido a {{operator.legalEmail}}.\n\nEl Operador acusará recibo de la reclamación, la examinará y comunicará una resolución motivada en la cuenta de colaborador dentro del plazo configurado en la Configuración de la Plataforma para las reclamaciones de colaboradores, actualmente {{settings.partnerComplaintResponseHours}} horas desde el acuse de recibo. Cuando el asunto requiera indagaciones con terceros, el Operador informará al Proveedor del calendario previsto.\n\nEl procedimiento interno de reclamación no priva al Proveedor de su derecho a acudir a los tribunales competentes ni a utilizar cualquier mecanismo de resolución de controversias disponible conforme a la normativa aplicable.",
      },
      {
        id: "24",
        heading: "Parámetros de posicionamiento",
        body: "Los resultados de búsqueda y el orden de los anuncios en la Plataforma se determinan mediante una combinación de parámetros, de los que los principales son: la correspondencia entre los criterios de búsqueda del Cliente y el vehículo ofrecido; el precio y el valor global para el Cliente; la exactitud e integridad del anuncio, incluidas las fotografías y las especificaciones; la disponibilidad y la fiabilidad del calendario; el historial del Proveedor en cuanto a confirmaciones, cancelaciones y tiempos de respuesta; las valoraciones fundadas de los Clientes; y la ubicación de recogida en relación con la ubicación solicitada.\n\nEl pago por parte del Proveedor no determina por sí solo una posición superior, y el Operador no acepta pagos a cambio de garantizar una posición determinada. Cuando un emplazamiento sea promocionado o patrocinado, se identificará como tal.\n\nEl Operador podrá ajustar los parámetros de posicionamiento para mejorar el servicio e informará a los Proveedores de los cambios sustanciales conforme a la cláusula relativa a la modificación de las condiciones.",
      },
      {
        id: "25",
        heading: "Modificación de las condiciones",
        body: "El Operador podrá modificar el presente Contrato, las Normas Operativas para Colaboradores, el Anexo de Protección de Datos y los valores comerciales contenidos en la Configuración de la Plataforma.\n\nEl Operador comunicará al Proveedor las modificaciones en la cuenta de colaborador y por correo electrónico a la dirección que conste en el expediente con una antelación mínima de quince días respecto de su entrada en vigor, o con la antelación superior que exija la normativa aplicable. Podrá utilizarse un plazo inferior cuando la modificación venga impuesta por la ley o resulte necesaria para hacer frente a un riesgo de seguridad o para prevenir el fraude.\n\nSi el Proveedor no acepta una modificación, podrá resolver el presente Contrato antes de que esta entre en vigor. La continuación en la aceptación de Reservas con posterioridad a la fecha de efectos constituye aceptación de las condiciones modificadas. Las modificaciones no se aplican con carácter retroactivo a las Reservas ya confirmadas.",
      },
      {
        id: "26",
        heading: "Transmisión del negocio",
        body: "El negocio del Operador podrá transmitirse en el futuro a una sociedad debidamente constituida por el titular de dicho negocio. En tal caso, el presente Contrato y los documentos de colaboración relacionados podrán cederse o novarse a favor de dicha sociedad.\n\nEl Operador comunicará por escrito al Proveedor la transmisión con carácter previo, identificando al cesionario. La transmisión no menoscabará los derechos del Proveedor derivados del presente Contrato y no afectará a las Reservas confirmadas, que continuarán en los mismos términos.\n\nEl Proveedor no podrá ceder el presente Contrato sin el consentimiento previo y por escrito del Operador, que no se denegará de forma injustificada.",
      },
      {
        id: "27",
        heading: "Responsabilidad",
        body: "Cada parte responde del cumplimiento de sus propias obligaciones. El Proveedor responde de todo perjuicio derivado del servicio de alquiler, incluidos el estado y la disponibilidad de los vehículos, la conducta de su personal, el contenido de su Contrato de Alquiler y su cumplimiento de la normativa aplicable, y mantendrá indemne al Operador frente a reclamaciones de terceros derivadas de dichas materias.\n\nEl Operador responde únicamente del perjuicio causado por un fallo del servicio de reserva que presta. En la máxima medida permitida por la normativa aplicable, el Operador no responde de los daños indirectos o consecuenciales, del lucro cesante, de la pérdida de negocio ni de la pérdida de fondo de comercio del Proveedor.\n\nNada de lo dispuesto en el presente Contrato excluye o limita la responsabilidad por fallecimiento o daños personales causados por negligencia, por dolo o por declaraciones fraudulentas, ni cualquier otra responsabilidad que no pueda excluirse o limitarse lícitamente.",
      },
      {
        id: "28",
        heading: "Ley aplicable y normas imperativas españolas",
        body: "El presente Contrato y la relación entre el Operador y el Proveedor se rigen por la legislación de {{operator.country}}, y los tribunales de {{operator.country}} serán competentes para conocer de las controversias que de él se deriven.\n\nDicha elección se entiende sin perjuicio de las normas imperativas del Derecho español aplicables al Proveedor por razón del ejercicio de la actividad de alquiler de vehículos en España, y sin perjuicio de las normas imperativas del Derecho de la Unión Europea, incluidas las aplicables a los servicios de intermediación en línea y a la protección de los consumidores, que continúan siendo de aplicación con independencia de la ley elegida.\n\nCuando una norma imperativa entre en conflicto con una cláusula del presente Contrato, prevalecerá la norma imperativa y el resto del Contrato mantendrá su vigencia.",
      },
      {
        id: "29",
        heading: "Notificaciones, integridad del contrato y control de versiones",
        body: "Las notificaciones formales al Operador se remitirán a {{operator.legalEmail}}. Las notificaciones al Proveedor se remitirán a la dirección de correo electrónico profesional que conste en la cuenta de colaborador y se pondrán asimismo a su disposición en dicha cuenta. Corresponde al Proveedor mantener actualizada esa dirección.\n\nEl presente Contrato, junto con las Normas Operativas para Colaboradores, el Anexo de Protección de Datos y los valores publicados en la Configuración de la Plataforma, constituye el acuerdo íntegro entre las partes sobre su objeto y sustituye cualquier entendimiento anterior relativo al mismo.\n\nCada versión de estos documentos está numerada y fechada. La versión aceptada por el Proveedor se registra junto con su aceptación y permanece disponible en la cuenta de colaborador. La versión en inglés es la versión jurídica auténtica y prevalecerá en caso de discrepancia con cualquier traducción.",
      },
      {
        id: "30",
        heading: "Estado de revisión jurídica",
        body: "El presente texto se ha elaborado como borrador de trabajo para la plataforma {{operator.platformBrand}}. Requiere la revisión profesional de un abogado habilitado en {{operator.country}} y de un abogado habilitado en España antes de su publicación para uso en producción o de su presentación a cualquier Proveedor para su aceptación.\n\nHasta que dicha revisión se haya completado y el documento se haya publicado con una fecha de entrada en vigor, el presente texto carece de eficacia contractual.",
      },
    ],
  },
};

export default doc;
