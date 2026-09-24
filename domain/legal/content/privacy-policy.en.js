/**
 * Rovaro Privacy Policy — English (authoritative legal version).
 */

const doc = {
  documentType: "privacy-policy",
  language: "en",
  jurisdiction: "EU",
  version: 1,
  effectiveFrom: null,
  content: {
    title: "Rovaro Privacy Policy",
    sections: [
      {
        id: "1",
        heading: "About this Privacy Policy",
        body: "{{operator.platformSentence}}\n\nThis Privacy Policy explains what personal data we collect when you use {{operator.primaryDomain}} or {{operator.spanishDomain}}, why we collect it, what we do with it, how long we keep it and what rights you have over it.\n\nFor the purposes described in this Policy, the controller of your personal data is {{operator.description}}. You can contact us about any privacy matter at {{operator.legalEmail}}.",
      },
      {
        id: "1.1",
        heading: "Operator business address",
        body: "The business address of the controller is {{operator.businessAddress}}.\n\nYou may send privacy requests to that address in writing, although email to {{operator.legalEmail}} is the fastest route and is the channel we monitor for data protection matters.",
        requires: ["businessAddress"],
      },
      {
        id: "2",
        heading: "Scope of this Policy",
        body: "This Policy covers the personal data we process as an online booking platform: the data of customers who search, request and make bookings, the data of drivers named on a booking, and the data of the individuals who act for our partner rental companies.\n\nIt does not cover the processing carried out by a Supplier under its own rental contract with you, nor the processing carried out by third-party websites that we link to. Those organisations have their own privacy notices and decide for themselves how they use your data.",
      },
      {
        id: "3",
        heading: "Who is the controller: Rovaro and the Supplier",
        body: "Two organisations act as controllers at different stages of a booking, each for its own purposes.\n\nRovaro is the controller for the booking-intermediation purposes: operating the platform, receiving and transmitting booking requests, checking availability with the Supplier, taking the booking prepayment, confirming the booking, sending booking-related notifications, handling complaints and meeting our own legal and accounting obligations.\n\nThe Supplier is the controller for the rental contract: verifying the driver at handover, concluding and performing the Rental Agreement, managing the vehicle and any security deposit, insurance, damage, traffic offences and its own statutory record-keeping. Once the data has been transmitted to the Supplier for the purposes of the rental, the Supplier decides independently how it is used and is responsible for that use under its own privacy notice.\n\nWe are not joint controllers with the Supplier and we do not control the Supplier's later processing. If you want to exercise rights over the data the Supplier holds, we will tell you which Supplier is involved and how to reach it.",
      },
      {
        id: "4",
        heading: "Customer data we collect",
        body: "When you use the platform we collect:\n\n- identification and contact data: first and last name, email address, telephone number and, where you create an account, your login identifiers;\n- booking data: pickup and return dates and times, pickup and return locations, selected vehicle, extras, delivery address, flight number and arrival time, price, booking ID and booking status;\n- driver data: the name, date of birth and licence details of the main driver and of any additional driver you add;\n- communication data: the messages, requests and complaints you send us and our replies;\n- technical data: IP address, device and browser information, language preference and the pages you visit on the platform.\n\nWe ask only for the data needed to place and support a booking. Where a field is optional, it is marked as such.",
      },
      {
        id: "5",
        heading: "Legal bases and purposes",
        body: "We rely on the following legal bases under the General Data Protection Regulation.\n\n- Performance of a contract or steps taken at your request before entering into one: processing booking requests, checking availability, taking the prepayment, confirming the booking, transmitting the data needed for the rental to the Supplier, and supporting you before and during the rental.\n- Compliance with a legal obligation: accounting and tax records, the handling of consumer complaints, and responses to lawful requests from public authorities.\n- Legitimate interests: keeping the platform secure, preventing fraud and abuse, maintaining audit logs, resolving disputes, and improving the service. We balance these interests against your rights and you may object as described below.\n- Consent: analytics and non-essential cookies, and any marketing message you have asked to receive. Consent can be withdrawn at any time without affecting the lawfulness of what was done before.\n\nWhere we process a special category of data, such as information that may appear on an identity or licence document, we do so only to the extent it is necessary to establish, exercise or defend legal claims or where another lawful ground under Article 9 applies.",
      },
      {
        id: "6",
        heading: "Driver documents",
        body: "Some bookings require driver documents, in particular images of the driving licence and, where applicable, of an International Driving Permit or passport page.\n\nWe collect these documents only when the Supplier needs them for the specific booking, for example to verify the driver in advance, to prepare the rental contract or to meet a legal requirement of the country of the rental. We do not collect them speculatively, we do not use them for any other purpose, and we never publish them.\n\nUploading a document is done through an authenticated area of the platform that is tied to your booking. Driver documents are never requested through a public unauthenticated endpoint, and we will never ask you to send a licence image by email attachment or through a messaging app. If you receive such a request, it does not come from us, and you should report it to {{operator.legalEmail}}.",
      },
      {
        id: "7",
        heading: "How driver documents are protected",
        body: "Driver documents are stored in a restricted area that is not publicly browsable and are not attached to any email we send.\n\nThe partner is shown a driver document only at the stage at which it is lawful and necessary for the booking in question, and only for the booking that partner is handling. Access is limited to authorised partner users of that Supplier; no other partner and no unauthenticated visitor can reach the document.\n\nAccess happens through short-lived signed URLs. A signed URL is generated on demand for a specific authorised user, is valid for a short period only and cannot be reused or shared after it expires. The underlying file cannot be reached by guessing a direct address.",
      },
      {
        id: "8",
        heading: "Audit logging of document access",
        body: "Every view and every download of a driver document is recorded in an audit log.\n\nThe log records which user accessed the document, which booking and which document was involved, the action taken and the time. The log is used to detect misuse, to answer your questions about who saw your document, and to support any investigation or legal claim.\n\nAudit entries are themselves protected and are retained for as long as necessary for those purposes, and in any event for no longer than is required by the applicable limitation periods.",
      },
      {
        id: "9",
        heading: "Automatic deletion of driver documents",
        body: "Driver documents are deleted automatically once they are no longer needed. Deletion runs on a configurable retention period of {{settings.documentRetentionDays}} days, counted from the end of the rental or from the closing of the booking, whichever is later.\n\nDeletion is automatic and does not depend on a manual request, although you may ask us to delete a document earlier and we will do so unless we are required to keep it to comply with a legal obligation or to defend a legal claim.\n\nAfter deletion, only the booking record itself and the audit log of access remain, without the document image.",
      },
      {
        id: "10",
        heading: "Payment data and {{operator.paymentProcessorName}}",
        body: "Booking prepayments are processed by {{operator.paymentProcessorName}}, our payment service provider, which acts as an independent controller for its own payment, fraud-prevention and regulatory purposes.\n\nCard details are entered on a {{operator.paymentProcessorName}}-operated payment page or component. Rovaro does not store full card numbers and never has access to your full card data or to your card security code. What we receive back is limited information such as the payment status, the amount, the currency, the payment reference and, in some cases, the card brand and the last digits, which we use to reconcile the booking and to process refunds.\n\nThe balance of the rental price and any security deposit are paid directly to the Supplier, and that payment is handled by the Supplier under its own arrangements.",
      },
      {
        id: "11",
        heading: "Partner data",
        body: "We process data about the individuals who represent our partner rental companies: name, business email address, telephone number, role, company details, the locations and fleet they operate, and their activity on the partner area of the platform, including booking confirmations, alternative offers and messages.\n\nThis data is processed to conclude and perform our agreement with the partner, to route bookings, to maintain quality and security, and to meet our accounting and legal obligations.\n\nBusiness contact details of a partner may be shown to a customer who has a confirmed booking with that partner, so that the customer can reach the Supplier about the rental.",
      },
      {
        id: "12",
        heading: "Email notifications",
        body: "We send transactional emails that are part of the service: availability confirmations, payment links, booking confirmations with the booking ID, alternative vehicle offers, reminders before pickup, cancellation and refund notices, and replies to your messages. These are necessary to perform the booking and are not marketing.\n\nWe send commercial or promotional messages only where you have asked to receive them or where another lawful basis applies, and every such message contains a link to unsubscribe. Unsubscribing from marketing does not stop the transactional emails that a live booking requires.\n\nEmails are delivered through an email service provider acting as our processor under a written agreement.",
      },
      {
        id: "13",
        heading: "Addresses, geolocation and delivery pricing",
        body: "When you enter a pickup, delivery or return address, or select a city or an airport, we process that location data to show available vehicles, to calculate delivery and collection pricing based on distance and zone, and to pass the agreed handover point to the Supplier.\n\nAddress lookup and suggestion use a third-party mapping service, which receives the text you type in order to return suggestions. Coordinates derived from the selected place are used for distance and zone calculations.\n\nIf your browser asks for permission to use your precise location, that is optional. Refusing it does not prevent you from booking; you can simply type the location instead.",
      },
      {
        id: "14",
        heading: "Analytics and cookies",
        body: "We use cookies and similar technologies that are strictly necessary to operate the platform, and, where you consent, analytics cookies that help us understand how the platform is used.\n\nAnalytics data is used in aggregate to improve the service. Analytics cookies are set only after you have given consent through the cookie banner, and you can withdraw that consent at any time.\n\nThe categories of cookies, the third parties involved and the ways to manage or withdraw consent are described in the Rovaro Cookie Policy, which forms part of the information we give you under this Policy.",
      },
      {
        id: "15",
        heading: "Service providers and other recipients",
        body: "We share personal data only where it is necessary:\n\n- with the Supplier of the booking, so that the rental can be prepared and performed;\n- with {{operator.paymentProcessorName}} for payment processing;\n- with our hosting, database, email delivery, image storage and mapping providers, which act as processors on our documented instructions under written agreements;\n- with professional advisers, insurers and auditors where necessary and under a duty of confidentiality;\n- with public authorities, courts or regulators where we are legally required to do so.\n\nWe do not sell personal data and we do not share it for the independent marketing purposes of third parties.",
      },
      {
        id: "16",
        heading: "International transfers",
        body: "Our processing is primarily carried out within the European Economic Area. Some of our providers, including analytics, payment, image hosting and mapping services, may process data outside the EEA, including in the United States.\n\nWhere data is transferred outside the EEA, we rely on a lawful transfer mechanism: an adequacy decision of the European Commission where one applies, or otherwise the European Commission standard contractual clauses together with the additional technical and organisational safeguards required by the case law.\n\nYou may ask us at {{operator.legalEmail}} for information about the transfer mechanism applying to a particular provider.",
      },
      {
        id: "17",
        heading: "How long we keep data",
        body: "We keep personal data only for as long as it is needed for the purpose it was collected for.\n\n- Driver documents: {{settings.documentRetentionDays}} days after the end of the rental or the closing of the booking, then deleted automatically.\n- Booking records, including the booking ID, dates, locations, vehicle, price and status: {{settings.bookingRetentionYears}} years, after which they are deleted or anonymised, subject to any longer period required by law.\n- Accounting and tax records: for the period required by the applicable tax legislation.\n- Correspondence and complaint files: for as long as necessary to handle the matter and to defend legal claims.\n- Audit logs of document access: for as long as necessary for security and evidential purposes.\n\nWhere a legal obligation or a pending claim requires a longer period, we keep the data restricted to that purpose only and delete it once the period ends.",
      },
      {
        id: "18",
        heading: "Security",
        body: "We apply technical and organisational measures appropriate to the risk: encryption in transit, access control based on role and on the specific booking, short-lived signed URLs for sensitive files, audit logging, separation of the public site from the authenticated partner area, and restricted administrative access.\n\nSensitive identifiers such as tax references are never included in public output, and driver documents are never exposed through a public endpoint.\n\nNo system can be guaranteed to be completely secure. If a personal data breach occurs that is likely to result in a risk to your rights and freedoms, we will notify the supervisory authority and, where required, you, in accordance with the GDPR.",
      },
      {
        id: "19",
        heading: "Your rights under the GDPR",
        body: "Subject to the conditions in the GDPR, you have the right to:\n\n- access the personal data we hold about you and receive a copy;\n- have inaccurate data rectified and incomplete data completed;\n- have your data erased where it is no longer needed or where the processing was based on consent you have withdrawn;\n- have the processing restricted while an objection or a question of accuracy is examined;\n- receive the data you provided in a structured, commonly used and machine-readable format and have it transmitted to another controller where technically feasible;\n- object to processing carried out on the basis of our legitimate interests, and to object at any time to direct marketing;\n- withdraw any consent you have given, at any time, without affecting the lawfulness of processing carried out before the withdrawal.\n\nYou are also entitled not to be subject to a decision based solely on automated processing that produces legal effects concerning you or similarly significantly affects you, in the circumstances described below.",
      },
      {
        id: "20",
        heading: "How to exercise your rights and withdraw consent",
        body: "Write to {{operator.legalEmail}}, stating what you are asking for and, where relevant, the booking ID concerned.\n\nWe respond within one month of receiving the request. That period may be extended by two further months where the request is complex or where several requests have been made, in which case we will tell you within the first month and explain why. We may need to verify your identity before acting, and we will ask only for what is necessary to do so.\n\nTo withdraw consent to analytics cookies, use the cookie settings on the site; to unsubscribe from marketing messages, use the link in any such message. Exercising your rights is free of charge, unless a request is manifestly unfounded or excessive.",
      },
      {
        id: "21",
        heading: "Automated decision-making",
        body: "We do not take decisions producing legal effects concerning you, or similarly significantly affecting you, based solely on automated processing.\n\nPrices, delivery charges and vehicle availability are calculated automatically from the parameters you enter and from the information supplied by the Supplier, but the decision to confirm a booking is taken by the Supplier, and the decision to accept a driver is taken by the Supplier when it checks the original documents at handover.\n\nAutomated checks may be applied by our payment provider to prevent fraud. If such a check affects your payment, you may contact us at {{operator.legalEmail}} and we will explain what happened and how to have the matter reviewed by a person.",
      },
      {
        id: "22",
        heading: "Children",
        body: "The platform is intended for adults. A booking requires a driver who meets the minimum age set by the Supplier, which is always above the age of majority for rental purposes.\n\nWe do not knowingly collect personal data relating to children. If you believe that a child has provided us with personal data, contact {{operator.legalEmail}} and we will delete it unless we are required to keep it.",
      },
      {
        id: "23",
        heading: "Complaints to a supervisory authority",
        body: "If you believe that our processing of your personal data infringes data protection law, you may lodge a complaint with the {{operator.dpa}}, whose website is {{operator.dpaUrl}}.\n\nYou may also lodge a complaint with the supervisory authority of the EU or EEA country where you live or work, or where the alleged infringement took place. If you are in Spain, that authority is the Spanish data protection authority.\n\nWe would be grateful for the chance to address your concern first, so please consider contacting us at {{operator.legalEmail}} before or alongside a complaint.",
      },
      {
        id: "24",
        heading: "Changes to this Policy",
        body: "We may update this Policy to reflect changes in the service, in the providers we use or in the law.\n\nThe current version is always available on the platform, and the effective date is shown on the published page. Where a change materially affects how we use your data, we will bring it to your attention before it takes effect, and we will obtain your consent again where the law requires it.",
      },
      {
        id: "25",
        heading: "Contact and version",
        body: "For any question about this Policy or about how we handle your personal data, write to {{operator.legalEmail}}.\n\nThe controller is {{operator.description}}, trading as {{operator.tradingName}} and operating the {{operator.platformBrand}} platform at {{operator.primaryDomain}} and {{operator.spanishDomain}}.\n\nThis is version 1 of the Rovaro Privacy Policy. Its effective date is shown on the published page on the platform.",
      }
    ],
  },
};

export default doc;
