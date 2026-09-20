/**
 * Rovaro Customer Booking Terms — English (authoritative legal version).
 * Requires professional legal review before production publication.
 */

const doc = {
  documentType: "customer-booking-terms",
  language: "en",
  jurisdiction: "EU",
  version: 1,
  effectiveFrom: null,
  content: {
    title: "Rovaro Booking Terms",
    sections: [
      {
        id: "1",
        heading: "Who we are",
        body: "{{operator.platformSentence}}\n\nIn these Terms, Rovaro, we, us and our mean {{operator.platformBrand}} and the operator identified above. You and the Customer mean the person who submits a booking request through {{operator.primaryDomain}} or {{operator.spanishDomain}}.\n\nYou can contact us at any time at {{operator.legalEmail}}. These Terms apply to every booking request you submit and to every booking you make through the platform, so please read them before you confirm a request.",
      },
      {
        id: "2",
        heading: "Rovaro is a booking intermediary, not a car rental company",
        body: "Rovaro is an online booking platform. We bring together customers who want to rent a vehicle or arrange a transfer and local rental companies that provide those services.\n\nRovaro does not own, lease, maintain, insure or operate any vehicle. We do not employ drivers, we do not hold a fleet, and we do not perform the rental service ourselves. What we provide is the intermediation service: presenting offers, transmitting your request to the Supplier, collecting the booking prepayment, confirming the booking to you and supporting you in your communication with the Supplier.\n\nBecause of this, the vehicle, its condition, its insurance cover, its documentation and its availability at the agreed time are the responsibility of the Supplier, within the limits described in these Terms and subject to the mandatory rights you have as a consumer.",
      },
      {
        id: "3",
        heading: "The Supplier",
        body: "The Supplier is the local car rental company or transfer operator identified on the offer page and in your booking confirmation. The Supplier is an independent business. It is not a branch, an agent or a subsidiary of Rovaro.\n\nThe Supplier sets its own rental conditions, including deposit amounts, fuel policy, mileage limits, insurance and excess levels, additional driver rules, cross-border rules and rules on the return of the vehicle. Those conditions are made available to you before you complete the booking and are also presented to you again by the Supplier at handover.\n\nWhere the Supplier's own terms and these Terms deal with different matters, both apply side by side: these Terms govern your relationship with Rovaro, and the Supplier's terms govern the rental itself.",
      },
      {
        id: "4",
        heading: "The Rental Agreement and who the parties are",
        body: "The Rental Agreement for the vehicle is concluded directly between you and the Supplier. It is normally signed at the pickup location when the vehicle is handed over to you, after the Supplier has checked your documents.\n\nRovaro is not a party to the Rental Agreement. We do not sign it, we do not acquire rights under it and we do not assume the Supplier's obligations under it.\n\nDuring the rental period, matters such as the condition of the vehicle, fuel, mileage, damage, fines, tolls, extensions, additional drivers and the return of the vehicle are governed by the Rental Agreement and by the Supplier's terms. You should read the Rental Agreement carefully before signing it and raise any discrepancy with the Supplier at that moment, and with us at {{operator.legalEmail}} if you need our help.",
      },
      {
        id: "5",
        heading: "Submitting a booking request",
        body: "When you complete the booking form and submit it, you are sending a booking request. A booking request is not a confirmed booking and does not oblige the Supplier to provide a vehicle.\n\nAfter you submit the request, we pass it to the Supplier so that the Supplier can check whether the vehicle is actually available for the dates, times and location you selected. Prices and availability shown on the platform reflect the information supplied by the Supplier at that moment and may change before the Supplier confirms.\n\nYou will be told the outcome of the availability check by email and in the booking area of the platform.",
      },
      {
        id: "6",
        heading: "When a booking becomes confirmed",
        body: "A booking becomes confirmed only when both of the following have happened:\n\n- the Supplier has confirmed that the vehicle is available for your dates, times and location; and\n- you have successfully paid the booking prepayment described in these Terms.\n\nWhen both conditions are met, we send you a confirmation containing a booking ID. That booking ID is the reference for all further communication about the booking. Until you receive it, no booking exists, even if you have already received a message telling you that the vehicle is available.\n\nIf the Supplier does not confirm availability, no booking is created and no prepayment is taken. If a prepayment has nevertheless been captured, it is refunded in full.",
      },
      {
        id: "7",
        heading: "The booking prepayment",
        body: "To confirm a booking you pay a prepayment of 10% of the total rental price. The prepayment is paid to Rovaro.\n\nThe prepayment covers our booking service: reserving the vehicle with the Supplier, confirming the booking and supporting you before the rental starts. It is also applied against the total rental price, so the amount you pay to us is deducted from what you owe overall and is not an additional charge on top of the advertised total.\n\nThe prepayment is taken through our payment provider using the payment methods offered at checkout. The amount of the prepayment, and the resulting balance, are shown to you before you pay.",
      },
      {
        id: "8",
        heading: "The prepayment is not a security deposit",
        body: "The booking prepayment is not a security deposit, a damage deposit or a franchise or excess guarantee. It is a part payment of the rental price together with our booking service.\n\nAny security deposit for the vehicle is a separate matter. It is set by the Supplier, it is collected by the Supplier at handover, and it is held, blocked, released or applied by the Supplier under the Rental Agreement and the Supplier's own terms. Rovaro never collects the security deposit, never holds it and cannot release it.\n\nThe expected deposit amount and the means of payment the Supplier accepts for it are shown on the offer page before you book. Questions about the return of a deposit after the rental must be raised with the Supplier, although you may contact us at {{operator.legalEmail}} and we will help you pursue the matter.",
      },
      {
        id: "9",
        heading: "The remaining balance paid to the Supplier",
        body: "The remaining 90% of the total rental price is paid directly to the Supplier at the handover of the vehicle. Rovaro does not collect this amount.\n\nThe balance is paid by the payment methods the Supplier accepts. Those methods are listed on the offer page and may include cash, debit card or credit card depending on the Supplier and the location. Some Suppliers require a card in the name of the main driver, in particular where the same card is used to block the security deposit.\n\nIf you cannot pay the balance by a method the Supplier accepts, the Supplier may refuse to hand over the vehicle. Please check the accepted payment methods before you travel.",
      },
      {
        id: "10",
        heading: "The payment link and its expiry",
        body: "When the Supplier has confirmed availability, we send you a secure payment link so you can pay the prepayment. The link is valid for {{settings.paymentLinkExpirationMinutes}} minutes.\n\nThe time limit exists because the vehicle is held for you while the link is open. If the link expires before you pay, the hold is released, the booking is not confirmed and the vehicle may be taken by another customer.\n\nIf your link expires you can ask us for a new one at {{operator.legalEmail}} or from the booking area of the platform. A new link is subject to a fresh availability check, and the price may have changed in the meantime. No amount is taken from you when a link simply expires.",
      },
      {
        id: "11",
        heading: "Prices, taxes and what the price includes",
        body: "Prices are shown in the currency displayed on the offer page and include the taxes that apply to the rental service as notified to us by the Supplier, unless the offer page states otherwise.\n\nThe total rental price shown to you covers the rental of the vehicle for the selected period and any extras and delivery options you selected. Items that are not included, such as optional insurance bought at the counter, fuel, additional equipment added at pickup, cross-border fees, late return charges, tolls or traffic fines, are charged separately by the Supplier under the Rental Agreement.\n\nDelivery and collection charges, where offered, are calculated from the address or location you enter and are shown before you submit your request.",
      },
      {
        id: "12",
        heading: "Changes to a confirmed booking",
        body: "If you want to change the dates, times, pickup or return location, the vehicle or the driver of a confirmed booking, contact us at {{operator.legalEmail}} quoting your booking ID.\n\nEvery change depends on the Supplier accepting it and on availability. A change may increase or decrease the total price. If the price increases, the additional amount is settled in accordance with the payment arrangement for the booking; if it decreases, the difference is reflected in the balance you pay at handover or refunded where an overpayment has been made to Rovaro.\n\nUntil we confirm a change to you in writing, the original booking remains in force.",
      },
      {
        id: "13",
        heading: "Cancellation by you",
        body: "You may cancel a booking at any time before the start of the rental by contacting us at {{operator.legalEmail}} quoting your booking ID, or by using the cancellation option in the booking area of the platform.\n\nThe consequences of cancellation depend on the cancellation conditions shown on the offer page for that specific vehicle and Supplier. Those conditions are presented to you before you pay and are repeated in your confirmation. They may provide for a full refund of the prepayment within a stated period before pickup, for a partial refund, or for the prepayment to be retained where the cancellation is very close to the pickup time.\n\nIf you do not appear at the pickup location at the agreed time and have not cancelled or agreed a change with us, the booking may be treated as a no-show under those conditions.\n\nNothing in this section affects any statutory right of withdrawal you may have. Please note that under EU consumer law the right of withdrawal for distance contracts does not normally apply to contracts for vehicle rental services with a specific performance date or period; where a statutory right does apply to your booking, it is stated on the offer page and it prevails over this section.",
      },
      {
        id: "14",
        heading: "Cancellation or non-provision by the Supplier",
        body: "If the Supplier cancels a confirmed booking, or fails to provide the vehicle at the agreed time and place, or provides a vehicle that does not correspond to what was booked and no acceptable alternative is agreed with you, you are entitled to a full refund of the booking prepayment you paid to Rovaro.\n\nWe will offer you, where possible, a replacement vehicle of the same or a higher class on the terms described in the section on alternative vehicle offers. You are free to decline a replacement and take the refund instead.\n\nThis section does not limit any further rights you may have against the Supplier under the Rental Agreement or under applicable consumer law, including any right to compensation for loss caused by the Supplier.",
      },
      {
        id: "15",
        heading: "Refunds",
        body: "Refunds of the booking prepayment are made by Rovaro to the payment method you used to pay, unless that method no longer exists and another method is agreed with you.\n\nWe initiate refunds within {{settings.refundProcessingDays}} days of the refund being approved. The time it then takes for the money to appear on your statement depends on your bank or card issuer and is outside our control.\n\nAmounts paid directly to the Supplier, including the balance of the rental price and any security deposit, are refunded by the Supplier under the Rental Agreement and the Supplier's own terms. We will assist you in contacting the Supplier where such a refund is due.",
      },
      {
        id: "16",
        heading: "Alternative vehicle offers",
        body: "Occasionally a vehicle becomes unavailable after a booking has been confirmed, for example because of an accident, a mechanical failure or a late return by a previous customer.\n\nIn that situation the Supplier may offer an alternative vehicle. Any alternative must be of the same or a higher class, must not be offered at a higher price than the booking you already made, and must not have worsened key characteristics such as the number of seats, the transmission type, the fuel or energy type, the luggage capacity or the air conditioning.\n\nYou see the alternative vehicle in the booking area of the platform with its specification and its photographs, together with the price, before you decide anything. You must explicitly accept the alternative before any payment is requested or applied to it. No vehicle is ever substituted silently, and we never treat your silence as acceptance.\n\nAn alternative offer expires {{settings.alternativeOfferExpirationHours}} hours after it is made. If you decline the alternative, or if the offer expires without your acceptance, the refund and replacement workflow starts and you are entitled to a full refund of your prepayment in accordance with these Terms, or to a further replacement offer if you prefer one.",
      },
      {
        id: "17",
        heading: "Accurate information you must provide",
        body: "You must give complete and accurate information when you submit a booking request and when you respond to our messages about it. This includes the name of the main driver exactly as it appears on the driving licence, your contact email address and telephone number, the details of any additional driver, and, for airport pickups and deliveries, your flight number and arrival time.\n\nAccurate contact details matter because the availability confirmation, the payment link and any alternative vehicle offer are time limited and are sent to the address and number you provide. Accurate flight details matter because the Supplier uses them to track delays and to plan the handover.\n\nIf the information you provide is incorrect or incomplete, the Supplier may be unable to hand over the vehicle, and any resulting cost may fall on you under the cancellation conditions of your booking.",
      },
      {
        id: "18",
        heading: "Driving licence, age and eligibility checks",
        body: "Driving licence requirements, minimum and maximum driver ages, minimum licence-holding periods, young driver surcharges and the acceptability of an International Driving Permit are set by the Supplier and, where relevant, by the law of the country of the rental. They are shown on the offer page before you book.\n\nRovaro does not verify your entitlement to drive and does not guarantee that you will be accepted as a driver. The decision is taken by the Supplier when it inspects the original documents at handover. The Supplier may refuse to hand over the vehicle if the documents are missing, expired, not accepted in the country of the rental, or do not match the booking.\n\nIf the Supplier refuses the handover because the documents do not meet the published requirements, the booking may be treated under the no-show or late cancellation conditions. If the refusal is not justified by the published requirements, the section on cancellation or non-provision by the Supplier applies and you are entitled to a refund of your prepayment.",
      },
      {
        id: "19",
        heading: "Communication and response times",
        body: "We communicate with you by email and through the booking area of the platform, using the contact details you provided.\n\nWe aim to respond to a standard request within {{settings.standardRequestResponseHours}} hours. Where a request is urgent, in particular where the pickup is imminent, we aim to respond within {{settings.urgentRequestResponseMinutes}} minutes.\n\nWhere a vehicle has to be replaced, we aim to notify you within {{settings.replacementNotificationHours}} hours of the Supplier informing us. These are service targets rather than contractual guarantees, and they do not affect your statutory rights.",
      },
      {
        id: "20",
        heading: "Complaints",
        body: "If something goes wrong, write to us at {{operator.legalEmail}} quoting your booking ID and describing what happened. Photographs, the Rental Agreement and any counter documents help us deal with the matter quickly.\n\nWe acknowledge and respond to customer complaints within {{settings.customerComplaintResponseHours}} hours. Where a complaint concerns the conduct of the rental itself, we will take it up with the Supplier and keep you informed of the outcome, while noting that the Supplier is the party responsible under the Rental Agreement.\n\nMaking a complaint to us does not prevent you from pursuing the Supplier directly or from using the dispute resolution routes described in these Terms.",
      },
      {
        id: "21",
        heading: "Limitation of liability",
        body: "We are responsible for providing the booking intermediation service with reasonable care and skill, and for loss that is a foreseeable result of our failure to do so.\n\nTo the extent permitted by applicable consumer law, we are not responsible for the performance of the rental service itself, for the acts or omissions of the Supplier, for the condition or roadworthiness of the vehicle, for the insurance cover the Supplier provides, for charges the Supplier applies under the Rental Agreement, or for loss caused by inaccurate information you provided. Again to the extent permitted by applicable law, we are not liable for events outside our reasonable control.\n\nNothing in these Terms excludes or limits any liability that cannot lawfully be excluded or limited. This includes liability for death or personal injury caused by negligence, liability for fraud or fraudulent misrepresentation, and any liability under mandatory rules of consumer law that apply to you. Your statutory rights as a consumer are not affected by these Terms.",
      },
      {
        id: "22",
        heading: "Governing law, consumer rights and dispute resolution",
        body: "The contract between you and Rovaro for the booking intermediation service is governed by the law of Ireland.\n\nThis choice of law does not deprive you, as a consumer, of the protection afforded to you by provisions that cannot be derogated from by agreement under the law of the country where you are habitually resident. If you are resident in Spain or in another EU or EEA country, you keep the mandatory consumer protection of that country, and you may bring proceedings in the courts of your country of residence.\n\nThe Rental Agreement with the Supplier is governed by its own terms and normally by the law of the country where the vehicle is rented.\n\nIf you are an EU consumer, you may also submit a dispute through the European Commission online dispute resolution platform at https://ec.europa.eu/consumers/odr. Before using it, please contact us at {{operator.legalEmail}} so that we can try to resolve the matter directly.",
      },
      {
        id: "23",
        heading: "Changes to these Terms",
        body: "We may update these Terms, for example to reflect changes in the service, in our payment arrangements or in the law.\n\nThe version that applies to a booking is the version that was published when you submitted the booking request for it. A change to these Terms does not alter a booking you have already confirmed.\n\nThe current version is always available on the platform, and material changes are notified in the way described on the published page.",
      },
      {
        id: "24",
        heading: "Legal operator details",
        body: "The platform is operated by {{operator.description}}.\n\nTrading name: {{operator.tradingName}}. Platform brand: {{operator.platformBrand}}. Country of establishment: {{operator.country}}. Legal structure: {{operator.legalStructure}}.\n\nContact address for legal and contractual matters: {{operator.legalEmail}}. Platform websites: {{operator.primaryDomain}} and {{operator.spanishDomain}}.",
      },
      {
        id: "24.1",
        heading: "Operator business address",
        body: "Business address of the operator: {{operator.businessAddress}}.\n\nWritten correspondence concerning these Terms may be sent to that address, although email to {{operator.legalEmail}} is the fastest route and is the channel we monitor for booking matters.",
        requires: ["businessAddress"],
      },
      {
        id: "24.2",
        heading: "Registered business name",
        body: "Registered business name: {{operator.tradingName}}, business name number {{operator.businessNameNumber}}, registered in {{operator.country}}.",
        requires: ["businessNameNumber"],
      },
      {
        id: "25",
        heading: "Version and effective date",
        body: "This is version 1 of the Rovaro Booking Terms.\n\nThe effective date of this version is shown on the published page on the platform. Earlier versions remain applicable to bookings made while they were in force, and we keep a record of the version that applied to each booking.",
      },
      {
        id: "26",
        heading: "Legal review status",
        body: "This text has been prepared as a working draft for the Rovaro platform. It requires professional legal review by a qualified lawyer in Ireland and by a qualified lawyer in Spain before it is published in production.\n\nUntil that review has been completed and the document has been approved, this text must not be relied upon as final legal advice or as a definitive statement of the rights and obligations of any party.",
      },
    ],
  },
};

export default doc;
