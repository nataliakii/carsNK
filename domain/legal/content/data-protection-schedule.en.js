/**
 * Rovaro Data Protection Schedule — English (authoritative legal version).
 */

const doc = {
  documentType: "data-protection-schedule",
  language: "en",
  jurisdiction: "EU",
  version: 1,
  effectiveFrom: null,
  content: {
    title: "Rovaro Data Protection Schedule",
    sections: [
      {
        id: "1",
        heading: "Purpose and scope",
        body: "This Schedule governs the processing of personal data carried out by {{operator.description}}, operator of {{operator.platformBrand}} (the Operator), and by the Supplier in connection with bookings made through the Platform. It forms part of the Partner Agreement.\n\nThe Schedule is to be read in accordance with Regulation (EU) 2016/679 (the GDPR) and with the national data protection law applicable to each party, including Spanish data protection law in respect of the Supplier activity in Spain.\n\nWhere this Schedule conflicts with the Partner Agreement on a data protection matter, this Schedule prevails.",
      },
      {
        id: "2",
        heading: "Subject matter and duration",
        body: "The subject matter of the processing is the personal data exchanged between the parties so that a booking made on the Platform can be confirmed, prepared and performed as a vehicle rental, and so that each party can meet its own legal, accounting, insurance and dispute-handling obligations.\n\nThe processing begins when the Supplier account is created and continues for as long as the Supplier offers vehicles on the Platform or holds personal data received through it.\n\nObligations that by their nature must survive, including confidentiality, security, deletion and cooperation in the event of a data subject request or a breach, continue after the Partner Agreement ends.",
      },
      {
        id: "3",
        heading: "Categories of data subjects",
        body: "The processing concerns the following categories of data subjects:\n\n- Customers who make a booking through the Platform;\n- additional drivers named for a booking or added at handover;\n- staff and authorised representatives of the Supplier who use the partner account or are named as operational or emergency contacts; and\n- other individuals who appear in booking-related correspondence, incident reports or documentation, such as a person accompanying the Customer or a third party involved in an incident.",
      },
      {
        id: "4",
        heading: "Categories of personal data",
        body: "The categories of personal data processed include:\n\n- identification data: name, date of birth, nationality and, where required for the rental, identity document data;\n- contact data: email address, telephone number and postal or delivery address;\n- booking data: dates, locations, vehicle selected, extras, prices paid and outstanding, and booking correspondence;\n- driving licence data, including licence number, categories, issuing authority and validity dates, and images of the driving licence as an identity document;\n- payment-related data limited to what each party needs, such as the payment status, the last digits of a card and refund references, with full card data held only by the regulated payment provider;\n- rental performance data: handover and return records, condition reports, odometer and fuel readings, and photographs taken at handover or return;\n- incident data: accident reports, damage records, fines and toll notifications; and\n- account data for partner staff: name, business contact details, role and access log entries.\n\nNeither party requires special categories of personal data for these purposes. If such data becomes necessary in an individual case, for example accessibility needs, it is processed only to the extent strictly necessary and on a valid legal basis.",
      },
      {
        id: "5",
        heading: "Driving licences and identity documents",
        body: "Driving licence images are processed as identity documents. They are used only to verify the identity and driving entitlement of the Customer and of any additional driver, to satisfy the legal and insurance requirements applicable to vehicle rental, and to defend or resolve a dispute arising from a rental.\n\nThey are not used for profiling, for marketing, for automated decision making with legal or similarly significant effect, or for any purpose unrelated to the rental.\n\nThe handling rules in this Schedule apply to any other identity document supplied for the same purpose, including a passport or national identity card where the rental lawfully requires one.",
      },
      {
        id: "6",
        heading: "Controller roles",
        body: "Each party determines the purposes and means of its own processing and therefore acts as an independent controller. Neither party acts as a processor for the other.\n\nThe Operator is controller for the purposes of the platform and the booking intermediation service, which include operating the websites and the partner account, presenting offers, taking and confirming the booking, processing the booking prepayment and refunds, communicating with the Customer about the booking, fraud prevention, customer support, complaint handling and the legal, accounting and tax obligations of the Operator.\n\nThe Supplier is controller for the purposes of the rental contract and the vehicle handover, which include verifying identity and driving entitlement, concluding and performing the Rental Agreement, collecting the balance and any security deposit, managing the vehicle, insurance, damage, fines and tolls, and the legal, accounting and tax obligations of the Supplier.\n\nEach party is responsible for the lawfulness of its own processing, for providing its own privacy information to data subjects and for responding to the supervisory authority in respect of that processing.",
      },
      {
        id: "7",
        heading: "Joint controllership where it genuinely applies",
        body: "The parties do not intend to create a general joint controllership. A joint controller arrangement under Article 26 GDPR arises only where the parties in fact jointly determine both the purposes and the essential means of a specific processing operation.\n\nWhere such an operation is identified, the parties will agree in writing an arrangement for that operation which allocates responsibility for providing information to data subjects, for handling data subject requests and for the point of contact, and will make the essence of the arrangement available to data subjects.\n\nUntil such an arrangement is agreed for a specific operation, the independent controller allocation in this Schedule applies.",
      },
      {
        id: "8",
        heading: "Legal bases",
        body: "Each party relies on the legal basis appropriate to its own processing, which will ordinarily be:\n\n- performance of a contract with the data subject, or steps taken at the request of the data subject before entering into a contract, for the booking and for the rental;\n- compliance with a legal obligation, for accounting and tax records, for identity and driving entitlement checks required for vehicle rental, and for cooperation with competent authorities; and\n- legitimate interests, for fraud prevention, platform security, service quality monitoring, defending legal claims and internal administration, where those interests are not overridden by the rights of the data subject.\n\nConsent is used only where it is genuinely required, for example for optional marketing communications, and each party obtains and records its own consent. Neither party may rely on a consent obtained by the other.",
      },
      {
        id: "9",
        heading: "Purpose limitation",
        body: "Personal data received from the other party may be used only for the purposes described in this Schedule.\n\nThe Supplier must not use Customer personal data received through the Platform for marketing, for building marketing lists, for transfer to third parties for their own purposes, or for soliciting direct bookings in circumvention of the Platform.\n\nThe Operator does not use partner staff data for purposes unrelated to operating the Platform and the partner relationship.",
      },
      {
        id: "10",
        heading: "Storage limitation and retention",
        body: "Personal data is retained no longer than is necessary for the purposes for which it is processed, or for the period required by applicable law.\n\nIdentity documents, including driving licence images, uploaded to or accessed through the Platform are subject to the configured retention period of {{settings.documentRetentionDays}} days, after which they are deleted or irreversibly anonymised, unless a longer period is required to comply with a legal obligation or to establish, exercise or defend a legal claim that is pending or reasonably anticipated.\n\nBooking records, financial records and correspondence are retained for the periods required by accounting, tax and limitation rules applicable to each party. Each party is responsible for applying retention to the copies it holds in its own systems.",
      },
      {
        id: "11",
        heading: "Security measures",
        body: "Each party implements appropriate technical and organisational measures under Article 32 GDPR, taking into account the state of the art, the costs of implementation and the risk to data subjects.\n\nThe measures applied to personal data exchanged through the Platform include: encryption in transit and encryption at rest for stored documents; role-based access control with individual named accounts; multi-factor authentication for privileged access; segregation of production data; logging and monitoring; backup and restoration procedures; secure development and change management; and staff confidentiality undertakings and training.\n\nThe Supplier must apply equivalent measures to any personal data it downloads or records in its own systems, and must ensure that its staff are bound by confidentiality.",
      },
      {
        id: "12",
        heading: "Document access through short-lived signed links",
        body: "Identity documents, including driving licence images, are made available to the Supplier only through short-lived signed URLs generated by the Platform for a single authorised user and expiring after a short validity period.\n\nAccess is restricted to authorised users of the partner account who need the document to perform a specific confirmed booking, and is limited to that booking.\n\nEvery view and every download of such a document is recorded in an audit log that captures the user, the booking, the document, the action and the timestamp. The audit log is retained as evidence of lawful access and is available to the Operator for security and compliance review.",
      },
      {
        id: "13",
        heading: "Prohibited handling of identity documents",
        body: "Driving licence documents and other identity documents are never sent as email attachments and are never exposed through a public endpoint or an unauthenticated link.\n\nThe Supplier must not forward, copy, re-upload or share such documents through email, messaging applications, consumer cloud storage or any other channel outside the Platform, must not store them on personal devices, and must not print them except where a specific legal obligation requires a paper record.\n\nAny signed link received must be used only by the authorised user to whom it was issued and must not be forwarded. A breach of this section must be reported to the Operator under the breach notification provisions of this Schedule.",
      },
      {
        id: "14",
        heading: "Sub-processors and service providers",
        body: "Each party may use service providers acting as its processors, such as hosting, storage, payment, communication, analytics and customer support providers.\n\nEach party remains responsible for its own processors, must engage them under a written contract complying with Article 28 GDPR, and must ensure that they provide sufficient guarantees as to security and confidentiality.\n\nOn request, each party provides the other with the categories of processors used for the processing covered by this Schedule so that the other can assess the associated risk.",
      },
      {
        id: "15",
        heading: "International transfers",
        body: "Personal data covered by this Schedule is processed within the European Economic Area wherever reasonably possible.\n\nWhere a transfer to a third country is necessary, the transferring party ensures that an appropriate safeguard under Chapter V GDPR is in place, such as an adequacy decision or the Standard Contractual Clauses, together with any supplementary measures required following a transfer risk assessment.\n\nNeither party transfers personal data received from the other to a third country without ensuring that such a safeguard applies.",
      },
      {
        id: "16",
        heading: "Data subject requests",
        body: "Each party handles requests from data subjects relating to its own processing, including access, rectification, erasure, restriction, portability and objection.\n\nWhere a party receives a request that relates wholly or partly to processing carried out by the other, it informs the data subject where to direct that part of the request and notifies the other party without undue delay, and in any event in time for the receiving party to answer within the statutory period of one month.\n\nEach party provides the other with the information and assistance reasonably necessary to answer a request, at no charge, unless the request is manifestly unfounded or excessive.",
      },
      {
        id: "17",
        heading: "Personal data breach notification",
        body: "A party that becomes aware of a personal data breach affecting personal data covered by this Schedule notifies the other party without undue delay, and in any event in time to allow the other party to meet its own notification obligations under Article 33 GDPR.\n\nThe notification states the nature of the breach, the categories and approximate number of data subjects and records concerned, the likely consequences, the measures taken or proposed, and a point of contact. Information not available at the time is provided as it becomes available.\n\nThe parties cooperate in investigating and mitigating the breach. Neither party makes a public statement naming the other in connection with a breach without prior consultation, except where a legal obligation requires it.",
      },
      {
        id: "18",
        heading: "Supervisory authorities",
        body: "The lead supervisory authority for the Operator is the {{operator.dpa}} ({{operator.dpaUrl}}). Notification of a reportable breach by the Operator is made to that authority within seventy-two hours of becoming aware of it, in accordance with Article 33 GDPR.\n\nThe Supplier notifies the supervisory authority competent for its own establishment, which for a Supplier established in Spain is the Spanish data protection authority.\n\nEach party cooperates with the competent supervisory authorities and informs the other of any investigation, inspection or enforcement action that concerns the processing covered by this Schedule.",
      },
      {
        id: "19",
        heading: "Deletion or return on termination",
        body: "On termination of the Partner Agreement, and in any event once the purposes described in this Schedule have been exhausted, each party deletes or irreversibly anonymises the personal data it received from the other.\n\nData may be retained after termination only to the extent required by a legal obligation, or as necessary to establish, exercise or defend a legal claim that is pending or reasonably anticipated. Data retained on that basis is restricted to the minimum necessary, is not used for any other purpose and is deleted when the reason for retention ends.\n\nAccess to documents held on the Platform is withdrawn when the partner account is closed. The Supplier confirms in writing, on request, that it has deleted the personal data it held.",
      },
      {
        id: "20",
        heading: "Audits and evidence of compliance",
        body: "Each party, on reasonable written notice and no more than once in any twelve-month period unless a breach or a supervisory authority requires otherwise, may request evidence that the other complies with this Schedule.\n\nThe evidence may be provided through a completed security questionnaire, a summary of technical and organisational measures, relevant certifications or audit reports, or extracts from the access audit log. An on-site audit may be conducted only where that evidence is insufficient, during business hours, without disrupting operations and subject to confidentiality.\n\nThe Operator may review access audit logs for the partner account at any time as part of routine security monitoring.",
      },
      {
        id: "21",
        heading: "Changes to this Schedule",
        body: "The Operator may amend this Schedule to reflect changes in law, in supervisory authority guidance, in the platform architecture or in the security measures applied, following the change procedure set out in the Partner Agreement.\n\nWhere a change materially affects the obligations of the Supplier, the Operator gives advance notice and, where required, seeks the written agreement of the Supplier.",
      },
    ],
  },
};

export default doc;
