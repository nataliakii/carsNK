/**
 * General Spain / rovaro platform rental terms.
 * Company-specific excess, deposit, age limits, etc. stay with each partner.
 */

const platformNoticeEn =
  "These are the general car rental rules of the rovaro platform for bookings in Spain. The vehicle is supplied by an independent rental company (the “Company”). Each Company reserves the right to apply its own terms — including insurance excess, deposit, driver age, licence requirements, mileage, fuel policy, and pickup/return conditions. Where the Company’s terms differ from these general rules, the Company’s terms apply to that booking, provided they were made available or communicated before or at confirmation.";

const acceptanceEn =
  "By submitting a booking request or confirming a reservation on this platform, you confirm that you have read and agree to (1) these general platform rental terms and (2) the rental terms of the Company supplying the vehicle for your booking.";

exports.termsSpain = {
  en: {
    title: "Car Rental Terms & Conditions",
    subtitle1bold: "PLATFORM AND COMPANY TERMS",
    text1: `${platformNoticeEn}\n\n${acceptanceEn}\n\nGENERAL RULES\n1. The driver must hold a valid driving licence accepted in Spain for the rented vehicle category. Minimum age and how long the licence must have been held may vary by Company and car class; the Company states these requirements for each vehicle.\n2. Only drivers named in the rental agreement may drive the vehicle.\n3. Fines, tolls, congestion charges, parking penalties and similar costs arising from use of the vehicle during the rental are payable by the renter.\n4. Pickup and return times, places, and any grace period after the booked end time are set by the Company and confirmed in the booking or voucher.\n5. The fuel policy (for example full-to-full) is set by the Company and recorded at pickup. The vehicle must be returned according to that policy.\n6. The rented vehicle must not be used:`,
    ul4: [
      "to carry prohibited or hazardous goods;",
      "to transport passengers for hire or reward without the required authorisation;",
      "to give driving lessons, even free of charge;",
      "to tow or push another vehicle unless the Company has authorised it;",
      "after an accident or mechanical failure, except as instructed by the Company;",
      "for motorsport or any similar competitive activity.",
    ],
    text2:
      "7. Taking the vehicle outside Spain, onto a ferry, or across borders is allowed only with the Company’s prior written consent.\n8. If the vehicle becomes unusable, the Company will replace it with a vehicle of similar specification where reasonably possible, according to its own policy.\n9. In the event of an accident, damage, theft or vandalism, the renter must contact the police where required, notify the Company immediately, and keep copies of all reports and documents.\n10. Insurance cover, excess (franquicia), security deposit, and exclusions are defined by each Company for each vehicle — they are not fixed by the platform.\n11. The Company may refuse handover or cancel a booking if licence, age, identity, payment or other eligibility requirements are not met.",
    subtitle3bold: "COMPANY-SPECIFIC TERMS",
    ul5: [
      "Each partner Company on rovaro may have its own full rental conditions.",
      "Those Company terms form part of your rental contract with that Company.",
      "rovaro is a booking platform and does not replace the Company’s rental agreement.",
      "Before driving, check the voucher, booking confirmation and any documents the Company provides at pickup.",
    ],
    text7red: "Important: by placing an order you agree to both the platform rules and the Company’s rules.",
    text3:
      "Insurance typically does not cover (unless the Company states otherwise in writing):",
    ul6: [
      "use of unpaved or non-public roads;",
      "driving by a person not named in the rental agreement;",
      "damage or an accident under the influence of alcohol, drugs or other intoxicating substances;",
      "interior damage (including burns, seat damage, pet damage, misuse of equipment, excessive soiling).",
    ],
    text4:
      "In such cases the renter is usually liable for the cost of the damage, subject to the Company’s terms.",
    subtitle4bold:
      "Questions about a specific car or booking? Contact the Company named on your voucher, or reach rovaro via the Contacts page.",
  },

  es: {
    title: "Condiciones de alquiler de vehículos",
    subtitle1bold: "TÉRMINOS DE LA PLATAFORMA Y DE LA EMPRESA",
    text1:
      "Estas son las normas generales de alquiler de la plataforma rovaro para reservas en España. El vehículo lo facilita una empresa de alquiler independiente (la “Empresa”). Cada Empresa se reserva el derecho a aplicar sus propias condiciones — incluida la franquicia del seguro, el depósito, la edad del conductor, los requisitos del permiso, el kilometraje, la política de combustible y las condiciones de recogida y devolución. Cuando las condiciones de la Empresa difieran de estas normas generales, prevalecen las de la Empresa para esa reserva, siempre que se hayan facilitado o comunicado antes o en el momento de la confirmación.\n\nAl enviar una solicitud de reserva o confirmar una reserva en esta plataforma, usted declara haber leído y aceptar (1) estas condiciones generales de la plataforma y (2) las condiciones de alquiler de la Empresa que suministra el vehículo de su reserva.\n\nNORMAS GENERALES\n1. El conductor debe tener un permiso de conducir válido y aceptado en España para la categoría del vehículo alquilado. La edad mínima y la antigüedad del permiso pueden variar según la Empresa y la clase de coche; la Empresa indica estos requisitos para cada vehículo.\n2. Solo pueden conducir el vehículo los conductores nombrados en el contrato de alquiler.\n3. Multas, peajes, tasas de congestión, sanciones de aparcamiento y costes similares derivados del uso del vehículo durante el alquiler corren a cargo del arrendatario.\n4. Los horarios y lugares de recogida y devolución, y cualquier periodo de cortesía tras la hora de fin reservada, los fija la Empresa y se confirman en la reserva o el voucher.\n5. La política de combustible (por ejemplo, lleno-lleno) la fija la Empresa y se registra en la recogida. El vehículo debe devolverse conforme a esa política.\n6. El vehículo alquilado no debe usarse:",
    ul4: [
      "para transportar mercancías prohibidas o peligrosas;",
      "para transportar pasajeros con ánimo de lucro sin la autorización requerida;",
      "para dar clases de conducción, aunque sean gratuitas;",
      "para remolcar o empujar otro vehículo salvo autorización de la Empresa;",
      "después de un accidente o avería, salvo instrucciones de la Empresa;",
      "para motordeportes o cualquier actividad competitiva similar.",
    ],
    text2:
      "7. Sacar el vehículo de España, embarcarlo en un ferry o cruzar fronteras solo está permitido con el consentimiento previo por escrito de la Empresa.\n8. Si el vehículo queda inutilizable, la Empresa lo sustituirá, cuando sea razonablemente posible, por otro de características similares, según su propia política.\n9. En caso de accidente, daño, robo o vandalismo, el arrendatario debe avisar a la policía cuando proceda, notificar de inmediato a la Empresa y conservar copias de todos los partes y documentos.\n10. La cobertura del seguro, la franquicia, el depósito de seguridad y las exclusiones las define cada Empresa para cada vehículo — no las fija la plataforma.\n11. La Empresa puede denegar la entrega o cancelar una reserva si no se cumplen los requisitos de permiso, edad, identidad, pago u otros de elegibilidad.",
    subtitle3bold: "CONDICIONES ESPECÍFICAS DE LA EMPRESA",
    ul5: [
      "Cada Empresa asociada en rovaro puede tener sus propias condiciones de alquiler completas.",
      "Esas condiciones forman parte de su contrato de alquiler con esa Empresa.",
      "rovaro es una plataforma de reservas y no sustituye el contrato de alquiler de la Empresa.",
      "Antes de conducir, revise el voucher, la confirmación de reserva y cualquier documento que la Empresa facilite en la recogida.",
    ],
    text7red:
      "Importante: al realizar un pedido usted acepta tanto las normas de la plataforma como las de la Empresa.",
    text3:
      "El seguro normalmente no cubre (salvo que la Empresa indique lo contrario por escrito):",
    ul6: [
      "uso de caminos sin asfaltar o no públicos;",
      "conducción por una persona no nombrada en el contrato;",
      "daños o accidente bajo los efectos del alcohol, drogas u otras sustancias;",
      "daños en el interior (incluyendo quemaduras, daños en asientos, mascotas, mal uso del equipamiento, suciedad excesiva).",
    ],
    text4:
      "En esos casos el arrendatario suele responder del coste del daño, con arreglo a las condiciones de la Empresa.",
    subtitle4bold:
      "¿Dudas sobre un coche o una reserva concreta? Contacte con la Empresa indicada en su voucher, o con rovaro a través de la página de Contacto.",
  },

  ca: {
    title: "Condicions de lloguer de vehicles",
    subtitle1bold: "TERMES DE LA PLATAFORMA I DE L’EMPRESA",
    text1:
      "Aquestes són les normes generals de lloguer de la plataforma rovaro per a reserves a Espanya. El vehicle el facilita una empresa de lloguer independent (l’“Empresa”). Cada Empresa es reserva el dret d’aplicar les seves pròpies condicions — inclosa la franquícia de l’assegurança, el dipòsit, l’edat del conductor, els requisits del permís, el quilometratge, la política de combustible i les condicions de recollida i devolució. Quan les condicions de l’Empresa difereixin d’aquestes normes generals, prevalen les de l’Empresa per a aquella reserva, sempre que s’hagin facilitat o comunicat abans o en el moment de la confirmació.\n\nEn enviar una sol·licitud de reserva o confirmar una reserva en aquesta plataforma, declareu haver llegit i acceptar (1) aquestes condicions generals de la plataforma i (2) les condicions de lloguer de l’Empresa que subministra el vehicle de la vostra reserva.\n\nNORMES GENERALS\n1. El conductor ha de tenir un permís de conduir vàlid i acceptat a Espanya per a la categoria del vehicle llogat. L’edat mínima i l’antiguitat del permís poden variar segons l’Empresa i la classe de cotxe; l’Empresa indica aquests requisits per a cada vehicle.\n2. Només poden conduir el vehicle els conductors nomenats al contracte de lloguer.\n3. Multes, peatges, taxes i costos similars derivats de l’ús del vehicle durant el lloguer van a càrrec de l’arrendatari.\n4. Els horaris i llocs de recollida i devolució, i qualsevol període de cortesia, els fixa l’Empresa i es confirmen a la reserva o al voucher.\n5. La política de combustible la fixa l’Empresa i es registra a la recollida. El vehicle s’ha de tornar d’acord amb aquesta política.\n6. El vehicle llogat no s’ha d’utilitzar:",
    ul4: [
      "per transportar mercaderies prohibides o perilloses;",
      "per transportar passatgers amb ànim de lucre sense l’autorització requerida;",
      "per donar classes de conducció, encara que siguin gratuïtes;",
      "per remolcar o empènyer un altre vehicle llevat d’autorització de l’Empresa;",
      "després d’un accident o avaria, llevat d’instruccions de l’Empresa;",
      "per motorport o qualsevol activitat competitiva similar.",
    ],
    text2:
      "7. Treure el vehicle d’Espanya, embarcar-lo en un ferri o creuar fronteres només està permès amb el consentiment previ per escrit de l’Empresa.\n8. Si el vehicle queda inutilitzable, l’Empresa el substituirà, quan sigui raonablement possible, per un altre de característiques similars, segons la seva política.\n9. En cas d’accident, dany, robatori o vandalisme, l’arrendatari ha d’avisar la policia quan calgui, notificar de seguida l’Empresa i conservar còpies de tots els parts i documents.\n10. La cobertura de l’assegurança, la franquícia, el dipòsit i les exclusions les defineix cada Empresa per a cada vehicle — no les fixa la plataforma.\n11. L’Empresa pot denegar el lliurament o cancel·lar una reserva si no es compleixen els requisits de permís, edat, identitat, pagament o altres d’elegibilitat.",
    subtitle3bold: "CONDICIONS ESPECÍFIQUES DE L’EMPRESA",
    ul5: [
      "Cada Empresa associada a rovaro pot tenir les seves pròpies condicions de lloguer completes.",
      "Aquestes condicions formen part del vostre contracte de lloguer amb aquella Empresa.",
      "rovaro és una plataforma de reserves i no substitueix el contracte de lloguer de l’Empresa.",
      "Abans de conduir, reviseu el voucher, la confirmació de reserva i qualsevol document que l’Empresa faciliti a la recollida.",
    ],
    text7red:
      "Important: en fer una comanda accepteu tant les normes de la plataforma com les de l’Empresa.",
    text3:
      "L’assegurança normalment no cobreix (llevat que l’Empresa indiqui el contrari per escrit):",
    ul6: [
      "ús de camins sense asfaltar o no públics;",
      "conducció per una persona no nomenada al contracte;",
      "danys o accident sota els efectes de l’alcohol, drogues o altres substàncies;",
      "danys a l’interior (incloses cremades, danys als seients, mascotes, mal ús de l’equipament, brutícia excessiva).",
    ],
    text4:
      "En aquests casos l’arrendatari sol respondre del cost del dany, d’acord amb les condicions de l’Empresa.",
    subtitle4bold:
      "Dubtes sobre un cotxe o una reserva concreta? Contacteu l’Empresa indicada al voucher, o rovaro a través de la pàgina de Contacte.",
  },

  ru: {
    title: "Условия аренды автомобиля",
    subtitle1bold: "УСЛОВИЯ ПЛАТФОРМЫ И КОМПАНИИ",
    text1:
      "Это общие правила аренды платформы rovaro для бронирований в Испании. Автомобиль предоставляет независимая прокатная компания («Компания»). Каждая Компания вправе применять свои условия — включая франшизу страховки, депозит, возраст водителя, требования к правам, лимит пробега, политику топлива и условия выдачи/возврата. Если условия Компании отличаются от этих общих правил, для данного бронирования действуют условия Компании, при условии что они были предоставлены или сообщены до или при подтверждении.\n\nОтправляя заявку или подтверждая бронь на этой платформе, вы подтверждаете, что ознакомились и соглашаетесь с (1) этими общими условиями платформы и (2) условиями аренды Компании, предоставляющей автомобиль по вашему заказу.\n\nОБЩИЕ ПРАВИЛА\n1. Водитель должен иметь действующие права, принимаемые в Испании для категории арендуемого автомобиля. Минимальный возраст и стаж прав могут отличаться у Компаний и классов авто; Компания указывает требования для каждого автомобиля.\n2. Управлять автомобилем могут только водители, указанные в договоре аренды.\n3. Штрафы, платные дороги, парковочные санкции и подобные расходы, связанные с использованием автомобиля в период аренды, оплачивает арендатор.\n4. Время и места выдачи и возврата, а также льготный период после окончания брони, устанавливает Компания и подтверждает в бронировании или ваучере.\n5. Политику топлива задаёт Компания и фиксирует при выдаче. Автомобиль нужно вернуть согласно этой политике.\n6. Арендованный автомобиль запрещается использовать:",
    ul4: [
      "для перевозки запрещённых или опасных грузов;",
      "для перевозки пассажиров за плату без необходимой авторизации;",
      "для обучения вождению, в том числе бесплатного;",
      "для буксировки или толкания другого ТС без разрешения Компании;",
      "после ДТП или поломки, кроме случаев по инструкции Компании;",
      "для автоспорта и любых соревнований.",
    ],
    text2:
      "7. Выезд за пределы Испании, паром и пересечение границ допускаются только с предварительного письменного согласия Компании.\n8. Если автомобиль непригоден к использованию, Компания по возможности заменит его на ТС со схожими характеристиками по своей политике.\n9. При ДТП, повреждении, угоне или вандализме арендатор должен при необходимости обратиться в полицию, немедленно уведомить Компанию и сохранить копии всех документов.\n10. Страховое покрытие, франшизу, депозит и исключения определяет каждая Компания для каждого автомобиля — платформа их не фиксирует.\n11. Компания может отказать в выдаче или отменить бронь, если не выполнены требования к правам, возрасту, документам, оплате и т.п.",
    subtitle3bold: "УСЛОВИЯ КОНКРЕТНОЙ КОМПАНИИ",
    ul5: [
      "Каждая компания-партнёр на rovaro может иметь свои полные условия аренды.",
      "Эти условия являются частью вашего договора аренды с этой Компанией.",
      "rovaro — платформа бронирования и не заменяет договор аренды Компании.",
      "Перед поездкой проверьте ваучер, подтверждение брони и документы, которые Компания выдаёт при получении авто.",
    ],
    text7red:
      "Важно: оформляя заказ, вы соглашаетесь с правилами платформы и правилами Компании.",
    text3:
      "Страховка обычно не покрывает (если Компания письменно не указала иное):",
    ul6: [
      "движение по грунтовым или непубличным дорогам;",
      "управление лицом, не указанным в договоре;",
      "повреждение или ДТП в состоянии опьянения;",
      "повреждения салона (ожоги, сиденья, животные, неправильное использование оборудования, сильное загрязнение).",
    ],
    text4:
      "В этих случаях арендатор, как правило, оплачивает ущерб согласно условиям Компании.",
    subtitle4bold:
      "Вопросы по конкретному авто или брони? Свяжитесь с Компанией из вашего ваучера или с rovaro через страницу контактов.",
  },
};
