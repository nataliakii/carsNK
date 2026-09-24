/**
 * Rovaro Partner Agreement — English (authoritative legal version).
 */

const doc = {
  documentType: "partner-agreement",
  language: "en",
  jurisdiction: "EU",
  version: 1,
  effectiveFrom: null,
  content: {
    title: "Rovaro Partner Agreement",
    sections: [
      {
        id: "1",
        heading: "Parties",
        body: "This Partner Agreement (the Agreement) is concluded between {{operator.description}}, operator of the {{operator.platformBrand}} platform (the Operator), and the rental company that registers a partner account on the platform and is accepted for commercial operation (the Supplier).\n\n{{operator.platformSentence}} The Operator is a sole trader established in {{operator.country}} and is not a company; references in this Agreement to the Operator are references to that natural person trading as {{operator.tradingName}}.\n\nThe Agreement is accepted electronically by an authorised representative of the Supplier. Acceptance covers this Agreement together with the Partner Operating Rules and the Data Protection Schedule, which form part of it.",
      },
      {
        id: "1.1",
        heading: "Operator business address",
        body: "The business address of the Operator for the purposes of this Agreement is {{operator.businessAddress}}.",
        requires: ["businessAddress"],
      },
      {
        id: "1.2",
        heading: "Registered business name",
        body: "The trading name {{operator.tradingName}} is registered in {{operator.country}} under registered business name number {{operator.businessNameNumber}}.",
        requires: ["businessNameNumber"],
      },
      {
        id: "2",
        heading: "Definitions",
        body: "In this Agreement the following terms have the meanings set out below.\n\n- Operator or Platform: {{operator.description}}, acting as operator of {{operator.platformBrand}} and of the websites {{operator.primaryDomain}} and {{operator.spanishDomain}}.\n- Supplier: the rental company or other professional vehicle provider that lists vehicles on the Platform and performs the rental service.\n- Customer: the natural or legal person who places a Booking through the Platform, together with any additional driver named in the rental documentation.\n- Booking: a request for a specific vehicle for a specific period and location that has been confirmed on the Platform after payment of the Rovaro Booking Fee.\n- Rovaro Booking Fee (also referred to in operational records as the Booking Prepayment): the applicable non-refundable amount paid by the Customer to the Operator through {{operator.paymentProcessorName}} at the moment of booking, equal to the percentage of the total rental price displayed to the Customer before payment and recorded in the booking confirmation. {{settings.bookingFeeDisplayNote}} It is retained entirely by the Operator. It is not money held for the Supplier and no part of it is settled or paid out to the Supplier. It is credited when calculating the remaining Balance. It is non-refundable, except where required by applicable law or expressly authorised by Rovaro in exceptional circumstances.\n- Balance: the remaining Balance of the total rental price, payable by the Customer directly to the Supplier at vehicle handover. The Supplier must never collect the full 100% again.\n- Rental Agreement: the contract for the rental of the vehicle concluded directly between the Supplier and the Customer, including the Supplier own general rental conditions and handover documentation.\n- Platform Settings: the configurable commercial and operational parameters maintained by the Operator and displayed to the Supplier in the partner account.",
      },
      {
        id: "3",
        heading: "Role of the parties",
        body: "{{operator.platformBrand}} is an online booking intermediary. The Operator provides a technical and commercial platform through which the Customer can find, compare and reserve vehicles offered by the Supplier, and through which the Booking Prepayment is processed.\n\nThe Supplier is the direct provider of the rental service. The Operator does not own, lease, operate, maintain or insure any vehicle listed on the Platform and does not employ the staff who prepare or hand over vehicles.\n\nThe contract for the rental of the vehicle is concluded directly between the Supplier and the Customer. The Operator is not a party to that contract, does not act as lessor and does not assume the obligations of a lessor.\n\nThe Supplier is fully responsible for the vehicle and for the performance of the rental, including its technical condition, roadworthiness, cleanliness, documentation, insurance cover, handover and return, and for all statements made to the Customer about the vehicle.",
      },
      {
        id: "4",
        heading: "Scope and limits of the Operator responsibility",
        body: "The Operator is responsible for its own booking service only. That responsibility covers the operation and availability of the Platform, the accurate transmission of Booking data to the Supplier, the correct processing of the Rovaro Booking Fee, the issuing of confirmation to the Customer and the handling of any refund of that fee only where required by applicable law or expressly authorised by Rovaro in exceptional circumstances.\n\nThe Operator is not responsible for the condition, availability, legality or suitability of a vehicle, for the conduct of the Supplier staff, for the content of the Rental Agreement, for security deposits collected by the Supplier, or for damages, fines, tolls or disputes arising during the rental period.\n\nNothing in this section limits liability that cannot be limited under applicable mandatory law.",
      },
      {
        id: "5",
        heading: "Supplier verification information",
        body: "Before activation, and at all times afterwards, the Supplier must provide the Operator with accurate and current information as follows.\n\n- Legal name of the entity or sole trader.\n- Trading name used commercially, where different.\n- Entity type and country of registration.\n- Registration number in the register of the country of establishment.\n- Spanish NIF or CIF, where the Supplier operates in Spain.\n- VAT number, where the Supplier is registered for VAT.\n- Registered address and business address.\n- Name of the director or authorised signatory accepting this Agreement, and evidence of that person authority to bind the Supplier.\n- Business email address and telephone number for commercial and operational contact.\n- Licences and permits required for vehicle rental activity, where applicable in the country or region of operation.\n- Insurance information for the fleet offered on the Platform, including the insurer and the scope of cover.\n- Evidence that the Supplier owns the listed vehicles or is contractually authorised to rent them out.\n\nThe Operator does not remit rental amounts to the Supplier and does not operate a payout or settlement cycle for Bookings. The Supplier therefore is not required to provide payout or bank details for the rental price. The Rovaro Booking Fee is retained entirely by the Operator. It is not money held for the Supplier. The remaining Balance is collected by the Supplier directly from the Customer. The Supplier must never collect the full 100% again.\n\nThe Supplier warrants that all information supplied is true and that supporting documents are genuine.",
      },
      {
        id: "6",
        heading: "Verification statuses and activation",
        body: "Each partner account carries exactly one verification status at any time. The statuses are DRAFT, PENDING_VERIFICATION, VERIFIED, SUSPENDED and REJECTED.\n\n- DRAFT: the partner profile has been created but has not been submitted for verification.\n- PENDING_VERIFICATION: the profile has been submitted and the Operator is reviewing the information and documents.\n- VERIFIED: the review has been completed successfully and the account is activated for commercial operation.\n- SUSPENDED: commercial operation has been stopped temporarily in accordance with this Agreement.\n- REJECTED: the application has been refused, and the account is not activated.\n\nOnly an account with the status VERIFIED is activated for commercial operation. A partner that is not verified may not publish bookable listings and may not receive Bookings. Reaching VERIFIED status does not constitute advice, certification or a guarantee by the Operator as to the Supplier business, and the Supplier remains solely responsible for its own compliance.\n\nThe Supplier must notify the Operator without undue delay of any change to the information listed in this Agreement, and in any event before the change takes commercial effect.",
      },
      {
        id: "7",
        heading: "Listings, vehicle ownership and authorisation",
        body: "The Supplier is responsible for the content of each listing. A listing must describe a vehicle that the Supplier can actually supply, in the class and specification stated, at the stated locations.\n\nThe Supplier warrants that it owns each listed vehicle or holds a valid contractual right to rent it out, and that listing it on the Platform does not breach any financing, leasing, fleet or insurance arrangement.\n\nPhotographs must show the actual vehicle or, where a class-based offer is made, must be clearly presented as representative of the class. Descriptions, equipment lists and vehicle categories must not mislead the Customer.",
      },
      {
        id: "8",
        heading: "Price setting, transparency and price integrity",
        body: "The Supplier sets the full rental price for each vehicle and period. The price published on the Platform must be the complete price payable by the Customer for the rental as configured, and must include all mandatory taxes, levies and charges applicable to that rental.\n\nHidden mandatory payments are prohibited. Any amount that the Customer must pay in order to take the vehicle is a mandatory charge and must be reflected in the published price or, where the Platform provides a dedicated field for it, disclosed in that field before the Customer completes the Booking. Charges that are genuinely optional must be presented as optional.\n\nAfter a Booking has been confirmed and the Booking Prepayment has been received, the Supplier may not increase the price, introduce additional mandatory charges, or worsen the conditions of the rental, including the excess or franchise, the deposit amount, the mileage allowance, the fuel policy, the included cover or the agreed handover arrangements.",
      },
      {
        id: "9",
        heading: "Rovaro Booking Fee and Balance",
        body: "The Customer pays the Operator the applicable non-refundable Rovaro Booking Fee at the moment of booking. The Operator confirms the Booking to the Customer and to the Supplier once that payment has succeeded.\n\nThe remaining Balance of the total rental price is the Balance. The Balance is paid by the Customer directly to the Supplier at vehicle handover, in accordance with the Supplier own payment terms as disclosed on the Platform.\n\nThe Rovaro Booking Fee is credited when calculating the remaining Balance. The Supplier must credit that Booking Fee against the total price and must never collect the full 100% again. No part of the Booking Fee is held for the Supplier or paid out to the Supplier.",
      },
      {
        id: "10",
        heading: "The Rovaro Booking Fee is retained entirely by the Operator",
        body: "In consideration for the intermediation, booking and payment services provided by the Operator, the Operator retains the applicable Rovaro Booking Fee of the total rental price. {{settings.bookingFeeDisplayNote}}\n\nThat amount is charged by {{operator.paymentProcessorName}} to the Customer and paid into the Operator own {{operator.paymentProcessorName}} account. The Operator retains the full Booking Fee. It is not money held for the Supplier. There is no separate commission percentage, no minimum commission, and no transfer of any part of the Booking Fee to the Supplier.\n\nThe remaining Balance is paid by the Customer directly to the Supplier at handover. The Supplier collects the Balance directly from the Customer at handover and must credit the Booking Fee against the total rental price. The Supplier must never collect the full 100% of the rental price from the Customer.\n\nThe Operator does not process the Balance, does not operate {{operator.paymentProcessorName}} Connect for Bookings, does not create a supplier payout, and does not run a settlement cycle for the rental price.",
      },
      {
        id: "11",
        heading: "How the Booking Fee is calculated and the financial snapshot",
        body: "The Rovaro Booking Fee is calculated on the total rental price, which includes the vehicle rental for the booked period together with delivery and collection charges, optional extras and insurance upgrades selected at booking.\n\n{{operator.paymentProcessorName}} payment processing fees on the Booking Fee are borne by the Operator from the amount it retains. They are not deducted from the Balance and are not charged on to the Supplier.\n\nFor each Booking the Platform records a financial snapshot showing the total rental price, the amount paid online to the Operator, and the remaining amount payable directly to the Supplier. {{settings.bookingFeeDisplayNote}} A later change to the configured percentage does not alter the percentage or amounts accepted for an existing Booking. That snapshot is the reference record. It does not create a supplier payout.",
      },
      {
        id: "12",
        heading: "Security deposit is separate from the Rovaro Booking Fee",
        body: "The Rovaro Booking Fee is not a security deposit, a damage deposit or a guarantee. It is a non-refundable platform fee retained entirely by the Operator and credited when calculating the remaining Balance.\n\nAny security deposit required for the vehicle is a separate amount, set by the Supplier, collected by the Supplier directly from the Customer at handover, held by the Supplier and released by the Supplier. The Operator neither collects nor holds security deposits and has no authority over their retention or release.\n\nThe Supplier must disclose the amount, the method of collection and the conditions of release of any security deposit before the Customer completes the Booking.",
      },
      {
        id: "13",
        heading: "Supplier warranties and responsibilities",
        body: "The Supplier warrants and undertakes for the duration of this Agreement that:\n\n- it operates lawfully and holds every authorisation, licence and permit required for its vehicle rental activity;\n- each vehicle offered is covered by valid commercial insurance appropriate to rental use, for the whole period during which it is offered;\n- each vehicle is technically roadworthy, has a valid technical inspection where required, and is maintained in accordance with the manufacturer schedule and applicable law;\n- the vehicle supplied matches the listing in class, specification and material characteristics;\n- prices, availability calendars, excess or franchise amounts, deposit amounts, mileage limits, fuel policy, cross-border rules and additional charges published on the Platform are accurate and kept current;\n- it provides each Customer with its own Rental Agreement and handover documentation in a language the Customer can reasonably understand;\n- it complies with applicable Spanish and European Union law, including consumer protection, road traffic, insurance and tax law; and\n- it processes personal data of Customers lawfully and in accordance with the Data Protection Schedule.",
      },
      {
        id: "14",
        heading: "The Supplier Rental Agreement with the Customer",
        body: "The Supplier must present its Rental Agreement to the Customer before or at handover and must not include in it any term that contradicts the conditions published on the Platform for that Booking or that reduces the rights the Customer has acquired by making the Booking.\n\nWhere the Supplier Rental Agreement contains terms that are less favourable to the Customer than the conditions published on the Platform, the published conditions prevail as between the Operator and the Supplier, and the Supplier bears the consequences of the discrepancy.\n\nThe Supplier must provide the Operator, on request, with a copy of the standard Rental Agreement and of the general conditions applied to Customers introduced through the Platform.",
      },
      {
        id: "15",
        heading: "Vehicle unavailability, replacement and customer consent",
        body: "If a booked vehicle becomes unavailable, the Supplier must first attempt to supply the same vehicle. If that is impossible, the Supplier must offer a replacement of the same or a higher class.\n\nA replacement offer must satisfy all of the following conditions: the price payable by the Customer may not increase; the key characteristics of the vehicle may not be worsened, including transmission type, number of seats, luggage capacity, fuel or energy type, air conditioning, mileage allowance and insurance conditions; and the Customer must be shown the data and photographs of the alternative vehicle before accepting it.\n\nA material substitution requires the explicit consent of the Customer, recorded through the Platform. A vehicle may never be substituted automatically, silently or at the rental desk without the Customer having consented to the specific alternative offered. If the Customer does not consent, the Booking is treated as cancelled by the Supplier.",
      },
      {
        id: "16",
        heading: "Cancellation by the Supplier of a paid Booking",
        body: "If the Supplier cancels a Booking for which the Rovaro Booking Fee has been received, the following consequences apply.\n\n- There is no automatic refund of the Rovaro Booking Fee. Any refund is made only where required by applicable law or expressly authorised by Rovaro in exceptional circumstances.\n- The Supplier reimburses the Operator for documented payment processing, refund and chargeback costs incurred in connection with the cancelled Booking where a refund is so authorised.\n- The Supplier pays the service charge set out in the Platform Settings for supplier cancellation, currently {{settings.supplierCancellationServiceCharge}}.\n\nA rental-company ADMIN cannot initiate a refund of the Booking Fee. Partner rejection does not trigger an automatic refund.\n\nThese consequences do not apply where the cancellation results from an event outside the reasonable control of the Supplier that the Supplier evidences to the reasonable satisfaction of the Operator, or where the Customer has agreed to cancel.",
      },
      {
        id: "17",
        heading: "Refusal before the rental begins",
        body: "If the Supplier refuses to release the vehicle before the rental begins, the Supplier is not entitled to collect any part of the remaining rental balance.\n\nRovaro will review the circumstances and decide whether the Rovaro Booking Fee is:\n\n- refunded to the Customer in full; or\n- retained by Rovaro.\n\nNo partial refund of the Booking Fee applies in this situation.\n\nRovaro will normally refund the Booking Fee when the Supplier cannot provide the booked vehicle or otherwise cannot fulfil the confirmed Booking.\n\nRovaro may retain the Booking Fee when the refusal results from the Customer's conduct, including suspected fraud, identity misuse, invalid or inconsistent documents, failure to meet clearly disclosed driver or rental requirements, unlawful activity, or a genuine safety or security concern.\n\nThe Supplier must provide the reason for refusal and any relevant supporting information. The Supplier cannot independently decide, promise or deny a refund of the Rovaro Booking Fee.\n\nRovaro's decision will be made case by case, based on the available evidence, the requirements disclosed before booking, the conduct of both parties and applicable law. The Booking Fee will always be refunded where required by applicable law.",
      },
      {
        id: "18",
        heading: "Late cancellation, supplier no-show and replacement cost difference",
        body: "Where the Supplier cancels late, or fails to hand over the vehicle at the agreed time and place without having offered an acceptable replacement, the Operator may arrange an equivalent replacement rental for the Customer.\n\nIn that case the Supplier reimburses the reasonable and evidenced difference in cost between the original Booking and the equivalent replacement, up to the cap configured in the Platform Settings, currently {{settings.replacementCostDifferenceCap}}. Reimbursement is made against documentary evidence of the replacement rental actually procured.\n\nThe Supplier must notify the Operator of any need to replace a vehicle at least {{settings.replacementNotificationHours}} hours before the scheduled handover, or immediately where the circumstances arise later than that.",
      },
      {
        id: "19",
        heading: "Nature of the configured amounts",
        body: "The service charge for supplier cancellation and the cap on the replacement cost difference are set in the Platform Settings and are visible to the Supplier in the partner account at all times. They are not fixed by this text and may be changed only in accordance with the section on changes to these terms.\n\nThe parties agree that these amounts represent a genuine pre-estimate of the loss suffered by the Operator and by the Customer when a confirmed Booking fails through the Supplier, including customer service handling, payment and refund costs, reputational harm and the cost of re-accommodating the Customer. They are not intended as a penalty and are not punitive in nature.",
      },
      {
        id: "20",
        heading: "Response deadlines",
        body: "The Supplier must respond to requests transmitted through the Platform within the deadlines configured in the Platform Settings.\n\n- Standard requests, including booking confirmations, modification requests and information requests: within {{settings.standardRequestResponseHours}} hours.\n- Urgent requests, including same-day or imminent handover matters: within {{settings.urgentRequestResponseMinutes}} minutes.\n- Customer complaints forwarded by the Operator: within {{settings.partnerComplaintResponseHours}} hours.\n\nRepeated failure to meet these deadlines is a ground for reducing visibility, suspending listings or suspending the partner account.",
      },
      {
        id: "21",
        heading: "Incident reporting",
        body: "The Supplier must inform the Operator within {{settings.incidentReportingHours}} hours of becoming aware of any of the following: an accident involving a vehicle rented through the Platform; an inability to hand over a booked vehicle; a dispute with an insurer that affects cover for a vehicle offered on the Platform; a serious complaint by a Customer; the withdrawal or suspension of a licence, permit or insurance policy; or any event likely to prevent the Supplier from performing confirmed Bookings.\n\nThe report must be sent through the Platform where a reporting channel exists, and otherwise to {{operator.legalEmail}}, and must include the affected Booking references and the measures the Supplier proposes to take.",
      },
      {
        id: "22",
        heading: "Hiding a vehicle, delisting and account suspension",
        body: "The Operator may hide or delist an individual vehicle where the listing is inaccurate or misleading, where required documentation or insurance evidence is missing or has expired, where the calendar is demonstrably unreliable, where the vehicle has generated repeated substantiated complaints, or where the listing may breach applicable law.\n\nThe Operator may suspend a partner account where the verification information is materially inaccurate or has ceased to be current, where a required authorisation or insurance cover has lapsed, where the Supplier repeatedly cancels confirmed Bookings or fails to hand over vehicles, where the Supplier fails to meet the response deadlines repeatedly, where there is a reasonable suspicion of fraud or of unlawful activity, or where suspension is necessary to protect Customers.\n\nExcept where an immediate measure is necessary to protect Customers or to comply with law, the Operator gives the Supplier a statement of reasons and an opportunity to remedy the situation before the measure takes effect. A statement of reasons is provided in all cases as soon as reasonably practicable.",
      },
      {
        id: "23",
        heading: "Termination and completion of confirmed Bookings",
        body: "Either party may terminate this Agreement for convenience by giving thirty days written notice. The Operator may terminate with immediate effect where the Supplier commits a material breach that is not remedied within a reasonable period, where the Supplier is subject to insolvency proceedings, where a required authorisation or insurance cover has definitively lapsed, or where continued cooperation would expose Customers or the Operator to serious risk.\n\nTermination does not affect Bookings already confirmed. Unless the Operator states otherwise in the notice, the Supplier must perform every confirmed Booking with a handover date falling before or after the termination date, and the commercial terms of this Agreement, including the Booking Fee retained by the Operator and the consequences of supplier cancellation, continue to apply to those Bookings until they are completed or refunded.\n\nProvisions that by their nature are intended to survive termination, including those on liability, data protection, confidentiality and governing law, survive it.",
      },
      {
        id: "24",
        heading: "Partner complaints and review procedure",
        body: "The Supplier may submit a complaint about a decision of the Operator, including hiding a listing, suspending an account or applying a service charge, through the complaint channel in the partner account or by writing to {{operator.legalEmail}}.\n\nThe Operator acknowledges the complaint, examines it, and communicates a reasoned outcome in the partner account within the period configured in the Platform Settings for partner complaints, currently {{settings.partnerComplaintResponseHours}} hours from acknowledgement. Where the matter requires investigation with third parties the Operator informs the Supplier of the expected timetable.\n\nThe internal complaint procedure does not deprive the Supplier of any right to pursue a claim before a competent court or to use any dispute resolution mechanism available under applicable law.",
      },
      {
        id: "25",
        heading: "Ranking parameters",
        body: "Search results and listing order on the Platform are determined by a combination of parameters, of which the main ones are: the match between the Customer search criteria and the vehicle offered; price and total value for the Customer; the accuracy and completeness of the listing, including photographs and specification; availability and calendar reliability; the Supplier record of confirmations, cancellations and response times; substantiated Customer feedback; and the pick-up location relative to the requested location.\n\nPayment by the Supplier does not by itself secure a higher position, and the Operator does not accept payment for a guaranteed ranking position. Where a placement is promoted or sponsored it is identified as such.\n\nThe Operator may adjust ranking parameters to improve the service and informs Suppliers of material changes in accordance with the section on changes to these terms.",
      },
      {
        id: "26",
        heading: "Changes to these terms",
        body: "The Operator may amend this Agreement, the Partner Operating Rules, the Data Protection Schedule and the commercial values held in the Platform Settings.\n\nThe Operator gives the Supplier notice of changes in the partner account and by email to the address on file at least fifteen days before they take effect, or for a longer period where required by applicable law. A shorter period may be used where the change is required by law or is necessary to address a security risk or to prevent fraud.\n\nIf the Supplier does not accept a change it may terminate this Agreement before the change takes effect. Continuing to accept Bookings after the effective date constitutes acceptance of the amended terms. Changes do not apply retroactively to Bookings already confirmed.",
      },
      {
        id: "27",
        heading: "Transfer of the business",
        body: "The Operator business may in future be transferred to a registered company established by the owner of that business. In that event this Agreement and the related partner documents may be assigned or novated to that company.\n\nThe Operator gives the Supplier prior written notice of the transfer, identifying the transferee. The transfer will not worsen the rights of the Supplier under this Agreement and does not affect confirmed Bookings, which continue on the same terms.\n\nThe Supplier may not assign this Agreement without the prior written consent of the Operator, which will not be unreasonably withheld.",
      },
      {
        id: "28",
        heading: "Liability",
        body: "Each party is liable for the performance of its own obligations. The Supplier is liable for all loss arising from the rental service, including the condition and availability of vehicles, the conduct of its staff, the content of its Rental Agreement and its compliance with applicable law, and indemnifies the Operator against third party claims arising from those matters.\n\nThe Operator is liable only for loss caused by a failure of the booking service it provides. To the maximum extent permitted by applicable law, the Operator is not liable for indirect or consequential loss, loss of profit, loss of business or loss of goodwill of the Supplier.\n\nNothing in this Agreement excludes or limits liability for death or personal injury caused by negligence, for fraud or fraudulent misrepresentation, or for any other liability that cannot lawfully be excluded or limited.",
      },
      {
        id: "29",
        heading: "Governing law and mandatory Spanish rules",
        body: "This Agreement and the relationship between the Operator and the Supplier are governed by the laws of {{operator.country}}, and the courts of {{operator.country}} have jurisdiction over disputes arising from it.\n\nThis choice is without prejudice to mandatory rules of Spanish law that apply to the Supplier because it carries on vehicle rental activity in Spain, and without prejudice to mandatory rules of European Union law, including the rules applicable to online intermediation services and to the protection of consumers, which continue to apply regardless of the choice of law.\n\nWhere a mandatory rule conflicts with a provision of this Agreement, the mandatory rule prevails and the remainder of this Agreement continues in force.",
      },
      {
        id: "29.1",
        heading: "Confirmed vehicle and price",
        body: "The Supplier must provide the confirmed vehicle. If the confirmed vehicle becomes unavailable, the Supplier may offer the same or a higher class at the same price. Any replacement requires the Customer's explicit agreement. The Supplier may not increase the confirmed price without the Customer's explicit agreement. If the Customer rejects a changed vehicle or price, the booking is cancelled and the Booking Fee is refunded in full. The Supplier reimburses the Operator for the refunded Booking Fee where the failure was within the Supplier's control. Repeated or serious failures may result in listing restrictions, suspension or termination. This does not impose an automatic penalty equal to the full rental price.",
      },
      {
        id: "30",
        heading: "Notices, entire agreement and versioning",
        body: "Formal notices to the Operator are sent to {{operator.legalEmail}}. Notices to the Supplier are sent to the business email address held in the partner account and are also made available in that account. It is the responsibility of the Supplier to keep that address current.\n\nThis Agreement, together with the Partner Operating Rules, the Data Protection Schedule and the values published in the Platform Settings, constitutes the entire agreement between the parties in respect of its subject matter and replaces any earlier understanding relating to that subject matter.\n\nEach version of these documents is numbered and dated. The version accepted by the Supplier is recorded with its acceptance and remains available in the partner account. The English version is the authoritative legal version and prevails in the event of any discrepancy with a translation.",
      },
    ],
  },
};

export default doc;
