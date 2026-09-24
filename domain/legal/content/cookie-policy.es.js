/**
 * Rovaro Cookie Policy — Spanish translation.
 * The English version is the authoritative legal version.
 */

const doc = {
  documentType: "cookie-policy",
  language: "es",
  jurisdiction: "EU",
  version: 1,
  effectiveFrom: null,
  content: {
    title: "Política de Cookies de Rovaro",
    sections: [
      {
        id: "1",
        heading: "Sobre esta Política de Cookies",
        body: "{{operator.platformSentence}}\n\nEsta Política de Cookies explica cómo {{operator.platformBrand}} utiliza cookies y tecnologías similares en {{operator.primaryDomain}} y {{operator.spanishDomain}}, para qué sirve cada categoría y cómo puede controlarlas.\n\nEl operador responsable de estas tecnologías es {{operator.description}}, que opera bajo el nombre comercial {{operator.tradingName}}. Puede dirigirse a nosotros en relación con cualquier aspecto de esta Política en {{operator.legalEmail}}.\n\nLa versión en inglés de este documento es la versión legal auténtica y prevalecerá en caso de discrepancia con esta traducción al español.",
      },
      {
        id: "1.1",
        heading: "Domicilio profesional del operador",
        body: "El domicilio profesional del operador es {{operator.businessAddress}}.\n\nLas solicitudes escritas relativas a las cookies y al consentimiento pueden remitirse a dicho domicilio, si bien el correo electrónico dirigido a {{operator.legalEmail}} es la vía más rápida.",
        requires: ["businessAddress"],
      },
      {
        id: "2",
        heading: "Qué son las cookies y las tecnologías similares",
        body: "Una cookie es un pequeño archivo de texto que un sitio web solicita a su navegador que almacene en su dispositivo. Cuando usted regresa, el navegador devuelve el archivo, lo que permite al sitio reconocer la sesión y recordar determinadas opciones.\n\nLas tecnologías similares obtienen resultados equiparables por otros medios. El almacenamiento local y el de sesión guardan pequeñas cantidades de información en el propio navegador. Los píxeles y los scripts cargados por una página pueden registrar que dicha página ha sido visitada. A lo largo de esta Política, el término cookies comprende todas ellas.\n\nLas cookies instaladas por nosotros bajo nuestro propio dominio son de origen. Las instaladas por otra organización cuyo servicio se carga en nuestras páginas son de terceros.",
      },
      {
        id: "3",
        heading: "Cookies estrictamente necesarias",
        body: "Estas cookies son imprescindibles para el funcionamiento de la plataforma y se instalan sin consentimiento, ya que sin ellas no puede prestarse el servicio que usted ha solicitado.\n\nSe utilizan para mantener su sesión mientras navega entre páginas, mantener su acceso a una cuenta o al área de socios, proteger los formularios y las peticiones frente a la falsificación de peticiones entre sitios, aplicar medidas de seguridad y límites de frecuencia, y distribuir correctamente el tráfico entre nuestros servidores.\n\nLa cookie de sesión utilizada por nuestra capa de autenticación, NextAuth, pertenece a esta categoría. Si bloquea las cookies estrictamente necesarias en su navegador, no podrá iniciar sesión, enviar una solicitud de reserva ni realizar el pago.",
      },
      {
        id: "4",
        heading: "Cookies funcionales y almacenamiento local",
        body: "Las tecnologías funcionales recuerdan las opciones que ha elegido para que la plataforma se comporte como usted espera.\n\nUtilizamos el almacenamiento del navegador para recordar su selección de idioma, de modo que el sitio se abra en el mismo idioma la próxima vez, y para conservar el estado del formulario de reserva, de manera que las fechas, ubicaciones y opciones introducidas no se pierdan si abandona la página o la recarga. También guardamos su elección sobre cookies para no mostrarle el banner de forma reiterada.\n\nEstos elementos se almacenan localmente en su navegador. Al borrar el almacenamiento del navegador se eliminan, y la plataforma vuelve entonces a sus valores por defecto.",
      },
      {
        id: "5",
        heading: "Cookies analíticas",
        body: "Utilizamos Google Analytics para comprender de forma agregada cómo se utiliza la plataforma: qué páginas se visitan, cómo avanzan los usuarios por el proceso de reserva y dónde se producen incidencias.\n\nGoogle Analytics instala cookies de la familia _ga para distinguir unos navegadores de otros entre visitas. No utilizamos la analítica para identificarle personalmente ni combinamos los datos analíticos con sus registros de reserva para elaborar un perfil suyo.\n\nLas cookies analíticas solo se instalan si usted presta su consentimiento a través del banner de cookies. Si lo rechaza o no responde al banner, no se instalan, y la plataforma funciona con normalidad sin ellas.",
      },
      {
        id: "6",
        heading: "Sin cookies publicitarias ni de elaboración de perfiles por defecto",
        body: "No instalamos cookies publicitarias, de reorientación ni de elaboración de perfiles de comportamiento, y no vendemos ni cedemos los datos derivados de cookies para las finalidades publicitarias de terceros.\n\nSi en algún momento introdujéramos tecnologías de ese tipo, se presentarían como una categoría independiente en el banner de cookies, permanecerían desactivadas salvo que usted preste activamente su consentimiento, y esta Política se actualizaría antes de su utilización.\n\nLa ausencia de cookies publicitarias no afecta a su capacidad de utilizar ninguna parte de la plataforma.",
      },
      {
        id: "7",
        heading: "El consentimiento: cómo lo solicitamos",
        body: "En su primera visita a la plataforma, un banner de cookies explica las categorías utilizadas y le permite aceptar o rechazar las no esenciales. Las cookies estrictamente necesarias se enumeran por transparencia, pero no están sujetas a consentimiento.\n\nRechazar es tan sencillo como aceptar: el banner ofrece una opción clara para rechazar las cookies no esenciales, y cerrar el banner sin aceptar no equivale a consentir. Las cookies no esenciales no se instalan antes de que usted haya hecho su elección.\n\nDejamos constancia de su elección para poder respetarla y acreditar que fue prestada, y volvemos a solicitarla si las categorías cambian de forma sustancial.",
      },
      {
        id: "8",
        heading: "Cómo gestionar o retirar el consentimiento",
        body: "Puede cambiar de opinión en cualquier momento. Abra la configuración de cookies desde el enlace situado en el pie del sitio, ajuste las categorías y guarde. La nueva elección se aplica de inmediato y dejan de instalarse las cookies de las categorías que haya desactivado.\n\nLa retirada del consentimiento no afecta a la licitud del tratamiento realizado mientras el consentimiento estuvo vigente, ni suprime los datos ya recogidos. Si desea que se supriman datos analíticos recabados con anterioridad, escríbanos a {{operator.legalEmail}}.\n\nLas cookies ya almacenadas en su dispositivo pueden eliminarse en cualquier momento desde su navegador.",
      },
      {
        id: "9",
        heading: "Controles del navegador",
        body: "Todos los navegadores principales permiten consultar, bloquear y eliminar cookies, y ofrecen un modo de navegación privada que las descarta al finalizar la sesión. Estos controles suelen encontrarse en la configuración de privacidad o de sitios, y las páginas de ayuda de su navegador explican los pasos exactos para su versión.\n\nBloquear todas las cookies, incluidas las estrictamente necesarias, impedirá el inicio de sesión, el formulario de reserva y el pago. Al eliminar las cookies también se elimina su elección guardada sobre cookies, por lo que el banner volverá a aparecer en su siguiente visita.\n\nAlgunos navegadores envían una señal general de no seguimiento o de privacidad global. Cuando podemos reconocer una señal de ese tipo, la tratamos como un rechazo de las cookies no esenciales.",
      },
      {
        id: "10",
        heading: "Duración de las cookies",
        body: "Las cookies son de sesión o persistentes. Las cookies de sesión existen únicamente mientras dura la sesión del navegador y se descartan al cerrarlo; son las que mantienen la coherencia de un inicio de sesión o del envío de un formulario de una página a otra. Las cookies persistentes permanecen en su dispositivo hasta que caducan o hasta que usted las elimina, y son las que permiten al sitio recordar una preferencia entre visitas.\n\nComo orientación general, las cookies de autenticación y seguridad son de sesión o de corta duración; los elementos de preferencia y de consentimiento persisten hasta que se modifican o se borran; los identificadores analíticos persisten entre visitas para poder medir el uso recurrente.\n\nNo publicamos aquí duraciones exactas de las cookies de terceros, ya que las fija el tercero y este puede modificarlas sin previo aviso. Las duraciones vigentes pueden consultarse en todo momento en su navegador y en la documentación del proveedor correspondiente.",
      },
      {
        id: "11",
        heading: "Terceros cuyas tecnologías utilizamos",
        body: "Las siguientes organizaciones pueden instalar o leer cookies e identificadores similares cuando sus servicios se cargan en nuestras páginas:\n\n- Google Analytics, para la medición agregada del uso, que se carga únicamente después de que preste su consentimiento;\n- {{operator.paymentProcessorName}}, para el tratamiento de los pagos y la prevención del fraude en los mismos, que se carga en las páginas de pago;\n- Cloudinary, para la entrega de las imágenes de los vehículos;\n- Google Maps, para la búsqueda y sugerencia de direcciones cuando introduce un lugar de recogida o de entrega.\n\nCada una de estas organizaciones trata los datos que recibe conforme a su propia documentación de privacidad. {{operator.paymentProcessorName}}, Cloudinary y Google Maps se utilizan cuando son necesarios para prestar una funcionalidad solicitada por usted, como pagar o introducir una dirección.",
      },
      {
        id: "12",
        heading: "Transferencias internacionales",
        body: "Algunos de los proveedores mencionados están establecidos fuera del Espacio Económico Europeo o tratan datos fuera de él, incluidos los Estados Unidos.\n\nCuando los datos relacionados con cookies se transfieren fuera del EEE, nos amparamos en un mecanismo de transferencia lícito: una decisión de adecuación de la Comisión Europea, cuando resulte aplicable, o bien las cláusulas contractuales tipo de la Comisión Europea junto con las garantías adicionales adecuadas.\n\nPuede solicitarnos en {{operator.legalEmail}} qué mecanismo resulta aplicable a un proveedor concreto.",
      },
      {
        id: "13",
        heading: "Modificaciones de esta Política",
        body: "Actualizamos esta Política cuando añadimos o eliminamos una tecnología, cuando cambia un proveedor o cuando varía la legislación o los criterios de las autoridades de control.\n\nLa versión vigente está siempre disponible en la plataforma y la fecha de entrada en vigor figura en la página publicada. Si una modificación introduce una nueva categoría no esencial, le solicitaremos de nuevo su consentimiento antes de utilizarla.",
      },
      {
        id: "14",
        heading: "Relación con la Política de Privacidad",
        body: "Esta Política de Cookies describe las tecnologías en sí. La Política de Privacidad de Rovaro describe el marco más amplio: los datos personales que tratamos, las bases jurídicas, los destinatarios, los plazos de conservación y sus derechos en virtud del Reglamento General de Protección de Datos.\n\nAmbos documentos están concebidos para leerse conjuntamente. Cuando los datos derivados de cookies constituyan datos personales, les resultarán de aplicación los derechos y procedimientos previstos en la Política de Privacidad, incluidos el derecho de oposición y el derecho de acceso.\n\nLa Política de Privacidad está publicada en la plataforma junto a esta Política.",
      },
      {
        id: "15",
        heading: "Contacto y versión",
        body: "Para cualquier cuestión relativa a las cookies, al consentimiento o a esta Política, escriba a {{operator.legalEmail}}.\n\nEl operador es {{operator.description}}, que gestiona la plataforma {{operator.platformBrand}} en {{operator.primaryDomain}} y {{operator.spanishDomain}}.\n\nEsta es la versión 1 de la Política de Cookies de Rovaro. Su fecha de entrada en vigor figura en la página publicada de la plataforma.",
      }
    ],
  },
};

export default doc;
