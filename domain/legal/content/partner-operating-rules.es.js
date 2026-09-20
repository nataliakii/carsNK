/**
 * Rovaro Partner Operating Rules — Spanish translation.
 * The English version is the authoritative legal version.
 * Requires professional legal review before production publication.
 */

const doc = {
  documentType: "partner-operating-rules",
  language: "es",
  jurisdiction: "EU",
  version: 1,
  effectiveFrom: null,
  content: {
    title: "Normas Operativas para Colaboradores de Rovaro",
    sections: [
      {
        id: "1",
        heading: "Objeto y relación con el Contrato de Colaboración",
        body: "Las presentes Normas Operativas establecen los estándares de trabajo diario que el Proveedor debe cumplir al ofrecer vehículos y atender a los Clientes a través de {{operator.platformBrand}}. {{operator.platformSentence}}\n\nLas Normas forman parte del Contrato de Colaboración y este se remite a ellas. Los términos definidos que aquí se emplean tienen el significado que les atribuye el Contrato de Colaboración. En caso de conflicto entre las Normas y el Contrato de Colaboración, prevalecerá este último.\n\nLa versión en inglés es la versión jurídica auténtica y prevalecerá en caso de discrepancia con esta traducción.\n\nTodos los plazos y umbrales previstos en estas Normas figuran en la Configuración de la Plataforma y se muestran al Proveedor en su cuenta de colaborador. Podrán ajustarse conforme al procedimiento de modificación previsto en el Contrato de Colaboración.",
      },
      {
        id: "2",
        heading: "Exactitud del calendario",
        body: "El Proveedor debe mantener en todo momento exacto y actualizado el calendario de disponibilidad de cada vehículo publicado, incluida la ocupación derivada de alquileres comercializados fuera de la Plataforma, del mantenimiento, de los traslados entre ubicaciones y de la retirada estacional del servicio.\n\nCuando el Proveedor utilice un gestor de canales o una conexión automatizada, seguirá siendo responsable de la exactitud de los datos transmitidos. Un fallo técnico de la conexión no excusa la inexactitud del calendario.\n\nEl vehículo que no pueda suministrarse debe bloquearse en el calendario u ocultarse antes de que un Cliente pueda reservarlo, y no después de haberse recibido una Reserva.",
      },
      {
        id: "3",
        heading: "Responsabilidad por sobreventa",
        body: "Se entiende por sobreventa la aceptación de una Reserva de un vehículo que el Proveedor no puede suministrar. La responsabilidad por sobreventa corresponde íntegramente al Proveedor.\n\nLa sobreventa se tramita como un supuesto de sustitución conforme a las presentes Normas y, cuando no se ofrezca y acepte una sustitución adecuada, como una cancelación por el Proveedor conforme al Contrato de Colaboración, con las consecuencias allí previstas.\n\nLa sobreventa reiterada constituye causa de reducción de la visibilidad de los anuncios afectados y de suspensión de la cuenta de colaborador.",
      },
      {
        id: "4",
        heading: "Plazos de respuesta ordinarios",
        body: "El Proveedor debe atender las solicitudes ordinarias recibidas a través de la Plataforma en un plazo de {{settings.standardRequestResponseHours}} horas. Son solicitudes ordinarias la confirmación de una Reserva, una petición de modificación, una consulta sobre el vehículo o la entrega y una solicitud de documentación.\n\nSe entiende por respuesta una contestación de fondo. El acuse de recibo automático no satisface el plazo.\n\nLos tiempos de respuesta son medidos por la Plataforma y resultan visibles para el Proveedor en su cuenta de colaborador.",
      },
      {
        id: "5",
        heading: "Solicitudes urgentes y reservas del mismo día",
        body: "Las solicitudes marcadas como urgentes, incluidas las relativas a una entrega que tenga lugar el mismo día o en las horas inmediatas, deben atenderse en un plazo de {{settings.urgentRequestResponseMinutes}} minutos.\n\nEl Proveedor debe mantener un canal apto para recibir solicitudes urgentes durante su horario de apertura publicado y mantener actualizados en la cuenta de colaborador los datos de contacto de dicho canal.\n\nCuando se emita un enlace de pago a un Cliente para una reserva urgente, dicho enlace tendrá una validez de {{settings.paymentLinkExpirationMinutes}} minutos. El Proveedor deberá mantener el vehículo bloqueado durante ese intervalo y no podrá comercializarlo con otro cliente mientras el enlace esté vigente.",
      },
      {
        id: "6",
        heading: "Preparación del vehículo antes de la entrega",
        body: "Antes de cada entrega, el vehículo debe estar limpio por dentro y por fuera, revisado técnicamente, repostado o cargado conforme a la política de combustible publicada para la Reserva y dotado del equipamiento de seguridad obligatorio y de la documentación exigida en el país de utilización.\n\nEl vehículo debe llevar la inspección técnica en vigor cuando sea exigible, la documentación del seguro en vigor y el permiso de circulación o los documentos sustitutivos lícitos exigidos para el uso previsto, incluida la circulación transfronteriza cuando la Reserva la permita.\n\nNeumáticos, frenos, luces, limpiaparabrisas y niveles de líquidos deben encontrarse en condiciones adecuadas para la totalidad del periodo de alquiler.",
      },
      {
        id: "7",
        heading: "Entrega y devolución",
        body: "El Proveedor debe entregar el vehículo en el momento y lugar convenidos. Cuando se haya reservado la entrega en una dirección o una entrega fuera del horario habitual, debe prestarse en los términos y al precio reservados.\n\nEn la entrega, el Proveedor debe dejar constancia del estado del vehículo, del nivel de combustible o de carga y de la lectura del cuentakilómetros, y debe facilitar al Cliente una copia de dicho registro junto con el Contrato de Alquiler.\n\nEn la devolución deben registrarse los mismos extremos en presencia del Cliente siempre que resulte posible. Cuando haya de aplicarse un cargo con posterioridad a la devolución, el Proveedor deberá comunicarlo al Cliente con la documentación acreditativa.",
      },
      {
        id: "8",
        heading: "Fotografías y descripciones del vehículo",
        body: "Las fotografías deben tener calidad suficiente, mostrar el vehículo real o identificarse con claridad como representativas de la categoría, y no deben ser sustancialmente anteriores al aspecto actual del vehículo.\n\nLas descripciones deben indicar el tipo de transmisión, el número de plazas, la capacidad de equipaje, el tipo de combustible o de energía, el aire acondicionado y cualquier característica que razonablemente pueda influir en la decisión del Cliente. No pueden exagerarse los años de modelo ni los niveles de equipamiento.\n\nEl Proveedor debe corregir sin dilación cualquier anuncio que haya dejado de ser exacto.",
      },
      {
        id: "9",
        heading: "Cargos obligatorios",
        body: "Constituye cargo obligatorio todo importe que el Cliente deba abonar para poder retirar el vehículo. Los cargos obligatorios deben incluirse en el precio publicado o declararse en el campo específico previsto por la Plataforma antes de que el Cliente complete la Reserva.\n\nSe incluyen aquí los recargos de aeropuerto o estación, las tasas de matriculación o de contrato, las tasas medioambientales o de circulación, los recargos por conductor joven y por conductor adicional cuando sean inevitables, y cualquier producto de seguro obligatorio que el Cliente no pueda rechazar.\n\nEl cobro en mostrador de un cargo obligatorio no informado constituye un incumplimiento de las presentes Normas y del Contrato de Colaboración.",
      },
      {
        id: "10",
        heading: "Extras opcionales y venta adicional",
        body: "Los extras opcionales, tales como sillas infantiles, conductores adicionales cuando sean genuinamente opcionales, equipamiento complementario y mejoras de seguro, deben presentarse como opcionales y con un precio transparente.\n\nEl Proveedor no puede presentar un producto opcional como obligatorio, no puede condicionar la entrega a la contratación de un producto opcional y no puede ejercer presión en el mostrador.\n\nTodo extra reservado y abonado por el Cliente a través de la Plataforma debe facilitarse. Si no fuera posible facilitarlo, el Proveedor deberá reembolsarlo o proporcionar un equivalente sin coste adicional.",
      },
      {
        id: "11",
        heading: "Reglas de sustitución de vehículo",
        body: "Solo podrá ofrecerse una sustitución cuando el vehículo reservado no pueda suministrarse realmente. El vehículo de sustitución debe ser de categoría igual o superior, sin incremento de precio y sin empeorar las características esenciales del vehículo.\n\nEl Proveedor debe comunicar al Operador la necesidad de sustitución con al menos {{settings.replacementNotificationHours}} horas de antelación respecto de la entrega prevista o, si las circunstancias surgieran con posterioridad, de forma inmediata.\n\nDeben mostrarse al Cliente los datos y las fotografías del vehículo alternativo, y este debe prestar su consentimiento expreso a través de la Plataforma antes de que la sustitución surta efecto. Queda prohibida la sustitución en el mostrador sin consentimiento previo registrado.",
      },
      {
        id: "12",
        heading: "Procedimiento de cancelación",
        body: "El Proveedor que necesite cancelar una Reserva deberá hacerlo a través de la Plataforma, indicando el motivo y aportando la documentación acreditativa cuando el motivo sea un acontecimiento ajeno a su control. La cancelación telefónica o la comunicación directa al Cliente no satisfacen este requisito.\n\nEl Proveedor debe intentar una sustitución antes de cancelar, salvo que las circunstancias la hagan imposible.\n\nUna vez registrada la cancelación, el Operador informará al Cliente, gestionará la devolución de los importes percibidos a través de la Plataforma y aplicará las consecuencias previstas en el Contrato de Colaboración.",
      },
      {
        id: "13",
        heading: "Incomparecencia del Cliente e incomparecencia del Proveedor",
        body: "Cuando el Cliente no se presente en el momento y lugar convenidos, el Proveedor deberá esperar el periodo de cortesía razonable publicado para la ubicación, intentar contactar con el Cliente mediante los datos facilitados y dejar constancia del intento en la Plataforma antes de declarar la incomparecencia.\n\nCuando el Proveedor no esté presente, se encuentre cerrado fuera de su horario publicado o no pueda entregar el vehículo, se tratará de una incomparecencia del Proveedor, que se considerará cancelación tardía conforme al Contrato de Colaboración.\n\nAmbos supuestos de incomparecencia deben registrarse en la Plataforma el mismo día en que se produzcan.",
      },
      {
        id: "14",
        heading: "Devoluciones de importes",
        body: "Las devoluciones del Prepago de Reserva y de cualquier otro importe percibido por el Operador son tramitadas por el Operador. El Operador inicia toda devolución aprobada en un plazo de {{settings.refundProcessingDays}} días, si bien el tiempo que los fondos tarden en llegar al Cliente depende además del proveedor de pagos y de la entidad bancaria del Cliente.\n\nLos importes percibidos directamente por el Proveedor, incluidos el Saldo, las fianzas y los cargos aplicados tras la devolución del vehículo, serán reembolsados por el Proveedor directamente al Cliente, dentro de los plazos exigidos por la normativa aplicable.\n\nEl Proveedor no puede remitir al Cliente al Operador para la devolución de un importe percibido por el propio Proveedor.",
      },
      {
        id: "15",
        heading: "Reclamaciones de Clientes",
        body: "Las reclamaciones remitidas por el Operador deben contestarse en un plazo de {{settings.partnerComplaintResponseHours}} horas con una posición de fondo, que incluya los hechos acreditados por el Proveedor y las pruebas en que se apoye.\n\nEl Proveedor debe tramitar las reclamaciones con corrección y sin presionar al Cliente, no puede condicionar la resolución de una reclamación a la retirada de una valoración y no puede ofrecer incentivos a cambio de la eliminación de una opinión.\n\nCuando la reclamación se refiera a un cargo, el Proveedor deberá aportar el cálculo y los documentos justificativos.",
      },
      {
        id: "16",
        heading: "Contacto de emergencia y disponibilidad",
        body: "El Proveedor debe mantener un contacto de emergencia localizable durante su horario de apertura publicado y durante cualquier periodo en el que esté prevista una entrega o una devolución, y debe mantener dichos datos actualizados en la cuenta de colaborador.\n\nEl contacto de emergencia debe estar en condiciones de atender una avería, un accidente, un fallo en la entrega y la situación de un Cliente que quede desatendido en un punto de recogida.\n\nCuando el Proveedor modifique su horario de apertura o sus datos de contacto, deberá actualizar la cuenta de colaborador antes de que el cambio surta efecto.",
      },
      {
        id: "17",
        heading: "Comunicación de incidencias",
        body: "El Proveedor debe comunicar al Operador, en un plazo de {{settings.incidentReportingHours}} horas, todo accidente que afecte a un vehículo alquilado a través de la Plataforma, toda imposibilidad de entregar un vehículo reservado, toda controversia con una aseguradora que afecte a un vehículo publicado, toda reclamación grave de un Cliente y todo hecho que pueda impedir la ejecución de Reservas confirmadas.\n\nLa comunicación se efectuará a través de la Plataforma cuando exista canal habilitado y, en su defecto, a {{operator.legalEmail}}, e identificará las Reservas afectadas.\n\nLa comunicación de una incidencia no sustituye a las notificaciones que el Proveedor deba realizar a su aseguradora o a cualquier autoridad pública.",
      },
      {
        id: "18",
        heading: "Estándares de calidad del servicio",
        body: "El Proveedor debe atender a los Clientes captados a través de la Plataforma en condiciones no menos favorables que las aplicadas a sus propios clientes directos, incluidos los tiempos de espera, la asignación de vehículos y la gestión de las mejoras de categoría.\n\nEl Operador realiza un seguimiento de las tasas de confirmación y de cancelación, de los tiempos de respuesta, de las reclamaciones fundadas y de las valoraciones de los Clientes. El bajo rendimiento persistente dará lugar a un plan de acción correctora, a la reducción de visibilidad o a la suspensión.\n\nEl Proveedor podrá solicitar los datos en que se base cualquier indicador de calidad que se le aplique.",
      },
      {
        id: "19",
        heading: "Trazabilidad y conservación de registros",
        body: "Todas las comunicaciones relativas a una Reserva deben cursarse a través de la Plataforma, de modo que exista un registro completo. Cuando un asunto urgente se resuelva por teléfono, el Proveedor deberá consignar un resumen en la Plataforma el mismo día.\n\nEl Proveedor debe conservar los registros de entrega y devolución, los partes de estado, las fotografías, los Contratos de Alquiler y la documentación de los cargos durante el periodo exigido por la normativa aplicable, y facilitarlos al Operador cuando este lo solicite para la resolución de una reclamación, una retrocesión de cargo o una controversia.\n\nLa conservación de los documentos cargados en la Plataforma se rige por el periodo de conservación configurado de {{settings.documentRetentionDays}} días, según se describe en el Anexo de Protección de Datos.",
      },
      {
        id: "20",
        heading: "Conductas prohibidas",
        body: "Quedan prohibidas las siguientes conductas:\n\n- publicar un vehículo que el Proveedor no pueda suministrar o no esté autorizado a arrendar;\n- publicar precios que no incluyan los cargos obligatorios, o cobrar en mostrador cargos no informados;\n- incrementar el precio o empeorar las condiciones de una Reserva confirmada;\n- sustituir un vehículo sin el consentimiento registrado del Cliente;\n- denegar la entrega a un Cliente que cumpla las condiciones publicadas;\n- exigir al Cliente el pago del Prepago de Reserva por segunda vez;\n- aportar al Operador pruebas falsas, manipuladas o fabricadas;\n- crear reservas ficticias, valoraciones falsas o cuentas múltiples para influir en el posicionamiento; y\n- cualquier trato discriminatorio hacia los Clientes prohibido por la normativa aplicable.",
      },
      {
        id: "21",
        heading: "Elusión directa de la Plataforma",
        body: "El Proveedor no puede fomentar ni facilitar la elusión de la Plataforma respecto de un Cliente captado a través de ella. En particular, el Proveedor no puede cancelar una Reserva para volver a contratar directamente con ese mismo Cliente, no puede ofrecer descuentos condicionados a reservar fuera de la Plataforma y no puede utilizar los datos de contacto del Cliente recibidos para una Reserva con el fin de captar una reserva directa.\n\nNo se permite distribuir material promocional de un canal directo junto con la documentación de entrega de una Reserva realizada a través de la Plataforma.\n\nLa presente cláusula no restringe la actividad comercial ordinaria del Proveedor dirigida a clientes captados con independencia de la Plataforma, ni impide al Proveedor atender a un cliente recurrente que contacte con él directamente por iniciativa propia y sin captación previa.",
      },
      {
        id: "22",
        heading: "Protección de los datos del Cliente en la operativa diaria",
        body: "Los datos personales de los Clientes recibidos a través de la Plataforma solo pueden utilizarse para ejecutar la Reserva y el alquiler y para cumplir obligaciones legales. No pueden utilizarse con fines de comercialización sin una base jurídica válida obtenida por el propio Proveedor.\n\nLos permisos de conducir y demás documentos de identidad deben tratarse conforme al Anexo de Protección de Datos. No pueden fotografiarse con dispositivos personales, no pueden enviarse como archivos adjuntos de correo electrónico, no pueden compartirse a través de aplicaciones de mensajería y no pueden conservarse más allá del periodo de conservación configurado de {{settings.documentRetentionDays}} días, salvo que una obligación legal lo exija.\n\nEl acceso dentro de la organización del Proveedor debe limitarse al personal que lo necesite para ejecutar el alquiler, y todo acceso a un documento a través de la Plataforma queda registrado.",
      },
      {
        id: "23",
        heading: "Modificación de las presentes Normas",
        body: "El Operador podrá modificar las presentes Normas y los plazos a los que remiten conforme al procedimiento de modificación previsto en el Contrato de Colaboración, con aviso previo en la cuenta de colaborador y por correo electrónico.\n\nA cada Reserva se aplicará la versión vigente en el momento de su confirmación.",
      },
      {
        id: "24",
        heading: "Estado de revisión jurídica",
        body: "El presente texto se ha elaborado como borrador de trabajo para la plataforma {{operator.platformBrand}}. Requiere la revisión profesional de un abogado habilitado en {{operator.country}} y de un abogado habilitado en España antes de su publicación para uso en producción o de su presentación a cualquier Proveedor para su aceptación.\n\nHasta que dicha revisión se haya completado y el documento se haya publicado con una fecha de entrada en vigor, el presente texto carece de eficacia contractual.",
      },
    ],
  },
};

export default doc;
