/**
 * Rovaro Partner Operating Rules — English (authoritative legal version).
 */

const doc = {
  documentType: "partner-operating-rules",
  language: "en",
  jurisdiction: "EU",
  version: 1,
  effectiveFrom: null,
  content: {
    title: "Rovaro Partner Operating Rules",
    sections: [
      {
        id: "1",
        heading: "Purpose and relationship to the Partner Agreement",
        body: "These Operating Rules set out the day to day standards that a Supplier must follow when offering vehicles and serving Customers through {{operator.platformBrand}}. {{operator.platformSentence}}\n\nThe Rules form part of the Partner Agreement and are referred to in it. Defined terms used here have the meaning given to them in the Partner Agreement. Where the Rules and the Partner Agreement conflict, the Partner Agreement prevails.\n\nAll deadlines and thresholds in these Rules are held in the Platform Settings and are shown to the Supplier in the partner account. They may be adjusted in accordance with the change procedure in the Partner Agreement.",
      },
      {
        id: "2",
        heading: "Calendar accuracy",
        body: "The Supplier must keep the availability calendar of every listed vehicle accurate and current at all times, including availability arising from rentals sold outside the Platform, maintenance, transfers between locations and seasonal withdrawal from service.\n\nWhere the Supplier uses a channel manager or an automated connection, it remains responsible for the accuracy of the data transmitted. A technical failure of the connection does not excuse an inaccurate calendar.\n\nA vehicle that cannot be supplied must be closed in the calendar or hidden before a Customer can book it, and not after a Booking has been received.",
      },
      {
        id: "3",
        heading: "Responsibility for overbooking",
        body: "Overbooking is the acceptance of a Booking for a vehicle that the Supplier cannot supply. Responsibility for overbooking lies entirely with the Supplier.\n\nAn overbooking is handled as a replacement situation under these Rules and, where no acceptable replacement is provided and accepted, as a cancellation by the Supplier under the Partner Agreement, with the consequences set out there.\n\nRepeated overbooking is a ground for reducing the visibility of the affected listings and for suspending the partner account.",
      },
      {
        id: "4",
        heading: "Standard response deadlines",
        body: "The Supplier must answer standard requests received through the Platform within {{settings.standardRequestResponseHours}} hours. Standard requests include confirmation of a Booking, a modification request, a question about the vehicle or the handover, and a request for documentation.\n\nAn answer means a substantive reply. An automatic acknowledgement does not satisfy the deadline.\n\nResponse times are measured by the Platform and are visible to the Supplier in the partner account.",
      },
      {
        id: "5",
        heading: "Urgent requests and same-day bookings",
        body: "Requests marked as urgent, including requests relating to a handover taking place on the same day or within a few hours, must be answered within {{settings.urgentRequestResponseMinutes}} minutes.\n\nThe Supplier must maintain a channel capable of receiving urgent requests during its published opening hours and must keep the contact details for that channel current in the partner account.\n\nWhere a payment link is issued to a Customer for an urgent booking, it remains valid for {{settings.paymentLinkExpirationMinutes}} minutes. The Supplier must hold the vehicle for the duration of that window and must not sell it to another customer while the link is live.",
      },
      {
        id: "6",
        heading: "Vehicle preparation before handover",
        body: "Before each handover the vehicle must be clean inside and out, technically checked, fuelled or charged in accordance with the fuel policy published for the Booking, and equipped with the mandatory safety equipment and documentation required in the country of use.\n\nThe vehicle must carry a valid technical inspection where required, valid insurance documentation, and the registration documents or lawful substitutes required for the intended use, including for cross-border travel where the Booking permits it.\n\nTyres, brakes, lights, wipers and fluid levels must be in a condition suitable for the whole rental period.",
      },
      {
        id: "7",
        heading: "Handover and return",
        body: "The Supplier must hand over the vehicle at the agreed time and place. Where delivery to an address or an out-of-hours handover has been booked, it must be performed as booked and at the price booked.\n\nAt handover the Supplier must record the condition of the vehicle, the fuel or charge level and the odometer reading, and must give the Customer a copy of that record together with the Rental Agreement.\n\nAt return the same items must be recorded in the presence of the Customer where practicable. Where a charge is to be made after return, the Supplier must notify the Customer with the supporting evidence.",
      },
      {
        id: "8",
        heading: "Photographs and vehicle descriptions",
        body: "Photographs must be of adequate quality, must show the actual vehicle or be clearly identified as representative of the class, and must not be materially older than the current appearance of the vehicle.\n\nDescriptions must state the transmission type, number of seats, luggage capacity, fuel or energy type, air conditioning, and any characteristic that would reasonably affect a Customer decision. Model years and equipment ranges must not be overstated.\n\nThe Supplier must correct a listing without delay once it becomes inaccurate.",
      },
      {
        id: "9",
        heading: "Mandatory charges",
        body: "Every charge that a Customer must pay in order to take the vehicle is a mandatory charge. Mandatory charges must be included in the published price or declared in the dedicated field provided by the Platform before the Customer completes the Booking.\n\nThis includes airport or station surcharges, registration or contract fees, environmental or road fees, young driver and additional driver charges where they are unavoidable, and any compulsory insurance product that the Customer cannot decline.\n\nCollecting an undisclosed mandatory charge at the desk is a breach of these Rules and of the Partner Agreement.",
      },
      {
        id: "10",
        heading: "Optional extras and upselling",
        body: "Optional extras such as child seats, additional drivers where genuinely optional, additional equipment, and insurance upgrades must be presented as optional and priced transparently.\n\nThe Supplier must not present an optional product as compulsory, must not make handover conditional on the purchase of an optional product, and must not apply pressure at the desk.\n\nAn extra that the Customer has booked and paid for through the Platform must be provided. If it cannot be provided, the Supplier must refund or arrange an equivalent at no additional cost.",
      },
      {
        id: "11",
        heading: "Replacement vehicle rules",
        body: "A replacement may be offered only where the booked vehicle genuinely cannot be supplied. The replacement must be of the same or a higher class, at no increase in price and without worsening the key characteristics of the vehicle.\n\nThe Supplier must notify the Operator of the need for a replacement at least {{settings.replacementNotificationHours}} hours before the scheduled handover, or immediately where the circumstances arise later than that.\n\nThe Customer must be shown the data and photographs of the alternative vehicle and must give explicit consent through the Platform before the substitution takes effect. Substitution at the desk without prior recorded consent is prohibited.",
      },
      {
        id: "12",
        heading: "Cancellation workflow",
        body: "A Supplier that needs to cancel a Booking must do so through the Platform, selecting the reason and attaching supporting evidence where the reason is an event outside its control. Cancelling by telephone or by informing the Customer directly does not satisfy this requirement.\n\nThe Supplier must attempt a replacement before cancelling, unless the circumstances make a replacement impossible.\n\nOnce a cancellation is registered, the Operator informs the Customer. There is no automatic refund of the Rovaro Booking Fee. Any refund is processed only where required by applicable law or expressly authorised by Rovaro in exceptional circumstances. The Operator then applies the other consequences set out in the Partner Agreement.",
      },
      {
        id: "13",
        heading: "Customer no-show and supplier no-show",
        body: "Where the Customer does not appear at the agreed time and place, the Supplier must wait for the reasonable grace period published for the location, must attempt to contact the Customer through the contact details supplied, and must record the attempt in the Platform before declaring a no-show.\n\nA customer no-show does not trigger an automatic refund of the Rovaro Booking Fee, except where required by applicable law or expressly authorised by Rovaro in exceptional circumstances.\n\nWhere the Supplier is not present, is closed outside its published hours, or is unable to hand over the vehicle, this is a supplier no-show and is treated as a late cancellation under the Partner Agreement.\n\nBoth types of no-show must be registered in the Platform on the day they occur.",
      },
      {
        id: "14",
        heading: "Refunds",
        body: "The Rovaro Booking Fee is non-refundable, except where required by applicable law or expressly authorised by Rovaro in exceptional circumstances. There is no automatic refund for customer cancellation, no-show, failed eligibility or safety checks, an invalid licence, incorrect information, refused verification or partner rejection. A rental-company ADMIN cannot initiate a refund.\n\nWhere Rovaro expressly authorises a refund, the Operator initiates it within {{settings.refundProcessingDays}} days, and the time taken for the funds to reach the Customer additionally depends on the payment provider and the Customer bank.\n\nAmounts collected directly by the Supplier, including the Balance, security deposits and charges applied after return, are refunded by the Supplier directly to the Customer, within the deadlines required by applicable law.\n\nThe Supplier must not direct a Customer to the Operator for the refund of an amount the Supplier itself has collected.",
      },
      {
        id: "15",
        heading: "Customer complaints",
        body: "Complaints forwarded by the Operator must be answered within {{settings.customerComplaintForwardResponseHours}} hours with a substantive position, including the facts established by the Supplier and any evidence relied upon.\n\nThe Supplier must handle complaints politely and without pressure on the Customer, must not condition the resolution of a complaint on the withdrawal of a review, and must not offer inducements in exchange for the removal of feedback.\n\nWhere the complaint concerns a charge, the Supplier must provide the calculation and the supporting documents.",
      },
      {
        id: "16",
        heading: "Emergency contact and availability",
        body: "The Supplier must maintain an emergency contact reachable during its published opening hours and during any period in which a handover or return is scheduled, and must keep those details current in the partner account.\n\nThe emergency contact must be able to deal with a breakdown, an accident, a handover failure and a Customer stranded at a pick-up location.\n\nWhere the Supplier changes its opening hours or its contact details, it must update the partner account before the change takes effect.",
      },
      {
        id: "17",
        heading: "Incident reporting",
        body: "The Supplier must report to the Operator within {{settings.incidentReportingHours}} hours any accident involving a vehicle rented through the Platform, any inability to hand over a booked vehicle, any insurance dispute affecting a listed vehicle, any serious Customer complaint, and any event likely to prevent the performance of confirmed Bookings.\n\nThe report must be made through the Platform where a channel exists and otherwise to {{operator.legalEmail}}, and must identify the affected Bookings.\n\nReporting an incident does not replace any notification the Supplier must make to its insurer or to a public authority.",
      },
      {
        id: "18",
        heading: "Service quality standards",
        body: "The Supplier must serve Customers introduced through the Platform on terms no less favourable than those it applies to its own direct customers, including on waiting times, vehicle allocation and the handling of upgrades.\n\nThe Operator monitors confirmation rates, cancellation rates, response times, substantiated complaints and Customer feedback. Persistent underperformance leads to a corrective action plan, reduced visibility or suspension.\n\nThe Supplier may ask for the data underlying a quality measure applied to it.",
      },
      {
        id: "19",
        heading: "Audit trail and record keeping",
        body: "All communications about a Booking must take place through the Platform so that a complete record exists. Where an urgent matter is handled by telephone, the Supplier must record a summary in the Platform on the same day.\n\nThe Supplier must retain handover and return records, condition reports, photographs, Rental Agreements and charge documentation for the period required by applicable law, and must produce them to the Operator on request for the resolution of a complaint, a chargeback or a dispute.\n\nRetention of documents uploaded to the Platform follows the configured retention period of {{settings.documentRetentionDays}} days, as described in the Data Protection Schedule.",
      },
      {
        id: "20",
        heading: "Prohibited actions",
        body: "The following are prohibited:\n\n- publishing a vehicle that the Supplier cannot supply or is not authorised to rent out;\n- publishing prices that do not include mandatory charges, or collecting undisclosed charges at the desk;\n- increasing the price or worsening the conditions of a confirmed Booking;\n- substituting a vehicle without the recorded consent of the Customer;\n- refusing handover to a Customer who meets the published conditions;\n- requiring the Customer to pay the Booking Prepayment a second time;\n- submitting false, manipulated or fabricated evidence to the Operator;\n- creating fake bookings, fake reviews or multiple accounts to influence ranking; and\n- any discriminatory treatment of Customers prohibited by applicable law.",
      },
      {
        id: "21",
        heading: "Direct circumvention and platform bypass",
        body: "The Supplier must not encourage or facilitate the bypassing of the Platform for a Customer introduced by the Platform. In particular the Supplier must not cancel a Booking and re-contract with the same Customer directly, must not offer a discount conditional on booking outside the Platform, and must not use the Customer contact data received for a Booking to solicit a direct booking.\n\nDistributing promotional material for a direct channel together with the handover documentation of a Booking made through the Platform is not permitted.\n\nThis section does not restrict the ordinary commercial activity of the Supplier towards customers it has acquired independently of the Platform, and does not prevent the Supplier from serving a returning customer who contacts it directly on the customer own initiative and without solicitation.",
      },
      {
        id: "22",
        heading: "Customer data protection in daily operations",
        body: "Customer personal data received through the Platform may be used only to perform the Booking and the rental, and to comply with legal obligations. It must not be used for marketing without a valid legal basis obtained by the Supplier itself.\n\nDriving licences and other identity documents must be handled in accordance with the Data Protection Schedule. They must not be photographed on personal devices, must not be sent as email attachments, must not be shared through messaging applications, and must not be retained beyond the configured retention period of {{settings.documentRetentionDays}} days unless a legal obligation requires it.\n\nAccess within the Supplier organisation must be limited to staff who need it to perform the rental, and every access to a document through the Platform is logged.",
      },
      {
        id: "22.1",
        heading: "Confirmed vehicle and price",
        body: "The Supplier must provide the confirmed vehicle. If the confirmed vehicle becomes unavailable, the Supplier may offer the same or a higher class at the same price. Any replacement requires the Customer's explicit agreement. The Supplier may not increase the confirmed price without the Customer's explicit agreement. If the Customer rejects a changed vehicle or price, the booking is cancelled and the Booking Fee is refunded in full. The Supplier reimburses Rovaro for the refunded Booking Fee where the failure was within the Supplier's control. Repeated or serious failures may result in listing restrictions, suspension or termination. This does not impose an automatic penalty equal to the full rental price.",
      },
      {
        id: "23",
        heading: "Changes to these Rules",
        body: "The Operator may amend these Rules and the deadlines they reference in accordance with the change procedure in the Partner Agreement, with prior notice in the partner account and by email.\n\nThe version in force at the time a Booking is confirmed applies to that Booking.",
      },
    ],
  },
};

export default doc;
