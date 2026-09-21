/**
 * Partner legal profile + Master Partner Agreement UI copy.
 *
 * English and Spanish are complete. Other listed locales keep the same keys
 * (English text) so the screens never render raw key paths.
 */

export const PARTNER_LEGAL_NAV = {
  en: "Legal",
  es: "Legal",
  ru: "Юридическое",
  uk: "Юридичне",
  el: "Νομικά",
  de: "Rechtliches",
};

export const partnerLegalEn = {
  title: "Legal profile",
  subtitle:
    "Rovaro uses this information to verify your company before you can sign the Master Partner Agreement and take bookings.",
  card: {
    title: "Trading status",
    subtitle: "Verification and the signed Partner Agreement required to take bookings.",
    open: "Can trade",
    blocked: "Cannot trade yet",
    openProfile: "Legal profile",
    openAgreement: "Partner Agreement",
  },
  gate: {
    okTitle: "You can take bookings",
    okBody:
      "Your company is verified and the current Partner Agreement is signed.",
    blockedTitle: "You cannot take bookings yet",
    blockedBody:
      "These items have to be cleared before listings can be offered and bookings received.",
    goToProfile: "Open legal profile",
    goToAgreement: "Open agreement",
    operatorAction: "Rovaro has to complete this step.",
    blocker: {
      no_profile: "The legal profile has not been created yet.",
      profile_incomplete: "The legal profile is incomplete.",
      awaiting_verification: "The profile is waiting for Rovaro to verify it.",
      rejected: "The profile was rejected. Correct the details and submit again.",
      suspended: "Trading is suspended. Rovaro has to restore the account.",
      agreement_not_signed: "The Master Partner Agreement has not been signed.",
      agreement_outdated:
        "A new version of the Partner Agreement is in force and has to be accepted.",
    },
  },
  status: {
    none: {
      title: "No legal profile yet",
      body: "Fill in the fields below and upload the required documents to start verification.",
    },
    reason: "Reason given: {{reason}}",
    changedAt: "Last status change: {{at}} UTC",
    DRAFT: {
      label: "Draft",
      title: "Draft",
      body: "This profile has not been submitted for verification.",
    },
    PENDING_VERIFICATION: {
      label: "Pending verification",
      title: "Pending verification",
      body: "Rovaro is reviewing the information and documents. The profile cannot be edited until that review finishes.",
    },
    VERIFIED: {
      label: "Verified",
      title: "Verified",
      body: "The profile has been verified. Editing it will stop trading until Rovaro reviews the change.",
    },
    SUSPENDED: {
      label: "Suspended",
      title: "Suspended",
      body: "Trading is suspended. You can update the profile; Rovaro has to restore the account.",
    },
    REJECTED: {
      label: "Rejected",
      title: "Rejected",
      body: "The application was refused. Correct the details and submit the profile again.",
    },
  },
  form: {
    loadFailed: "Could not load the legal profile.",
    saveFailed: "Could not save the legal profile.",
    saved: "Legal profile saved.",
    submitted: "Submitted for verification.",
    saving: "Saving…",
    save: "Save",
    submitForVerification: "Submit for verification",
    resubmitForVerification: "Submit again for verification",
    cancelEdit: "Cancel editing",
    goToAgreement: "Partner Agreement",
    rejectedReopen:
      "The previous application was rejected. Update the fields or documents that were refused and submit again.",
    unlockToEdit: "Edit",
    readOnlyTitle: "This profile is read-only",
    readOnlyVerified:
      "The profile is verified. You can unlock it to correct something; trading will stop until Rovaro reviews the change.",
    readOnlyPending:
      "The profile is with Rovaro for review and cannot be changed until that review finishes.",
    unlockWarningTitle: "Editing a verified profile",
    unlockWarningBody:
      "Saving a change will suspend trading until Rovaro reviews the updated details.",
    missingTitle: "Still needed for verification",
    required: "Required",
    optional: "If it applies",
    sections: {
      identity: {
        title: "Company identity",
        hint: "The legal entity that will sign the Partner Agreement.",
      },
      addresses: {
        title: "Addresses",
        hint: "Registered address is required. Business address only if it is different.",
      },
      signatory: {
        title: "Authorised signatory",
        hint: "The person who will accept the Partner Agreement on behalf of the company.",
      },
      contact: {
        title: "Business contact",
        hint: "Used for verification and operational contact. Not shown on the public site.",
      },
      payout: {
        title: "Payout reference",
        hint: "A reference Rovaro can use to identify the account. Do not paste a full IBAN if you have not been asked to.",
      },
      insurance: {
        title: "Insurance and licences",
        hint: "Fleet insurance and any rental licences or permits that apply where you operate.",
      },
      vehicles: {
        title: "Authority to rent the vehicles",
        hint: "Confirm that you own the listed vehicles or are authorised to rent them out.",
      },
    },
    fields: {
      legalName: { label: "Legal name", hint: "Name on the company register or tax registration." },
      tradingName: { label: "Trading name", hint: "Leave empty if it is the same as the legal name." },
      entityType: { label: "Entity type", hint: "" },
      countryOfRegistration: {
        label: "Country of registration",
        hint: "ISO 3166-1 alpha-2, for example ES.",
      },
      registrationNumber: { label: "Registration number", hint: "" },
      nifCif: { label: "NIF / CIF", hint: "Spanish tax identifier, where you operate in Spain." },
      vatNumber: { label: "VAT number", hint: "Leave empty if you are not registered for VAT." },
      registeredAddress: { label: "Registered address", hint: "" },
      businessAddress: { label: "Business address", hint: "Only if different from the registered address." },
      signatoryName: { label: "Signatory name", hint: "" },
      signatoryRole: { label: "Signatory role", hint: "Director, administrator, or other authority." },
      signatoryAuthorityBasis: {
        label: "Basis of authority",
        hint: "How this person may bind the company (office held, power of attorney, etc.).",
      },
      businessEmail: { label: "Business email", hint: "" },
      businessPhone: { label: "Business phone", hint: "" },
      emergencyPhone: { label: "Emergency phone", hint: "Reachable during handovers. Optional." },
      payoutAccountReference: {
        label: "Payout account reference",
        hint: "A label or masked reference, not a public account number.",
      },
      insuranceProvider: { label: "Insurance provider", hint: "" },
      insurancePolicyReference: { label: "Policy reference", hint: "" },
      insuranceValidUntil: { label: "Cover valid until", hint: "" },
      licences: {
        label: "Licences and permits",
        hint: "One per line. Leave empty if none are required where you operate.",
      },
    },
    confirmations: {
      signatoryAuthorityConfirmed: {
        label: "I confirm that this person is authorised to bind the company.",
        short: "Signatory authority",
      },
      vehicleAuthorityConfirmed: {
        label:
          "I confirm that the company owns the listed vehicles or is authorised to rent them out.",
        short: "Vehicle authority",
      },
    },
    entityTypes: {
      sl: "Sociedad Limitada (SL)",
      sa: "Sociedad Anónima (SA)",
      autonomo: "Autónomo / sole trader",
      other: "Other",
    },
  },
  documents: {
    title: "Supporting documents",
    subtitle:
      "Files are stored privately and opened with a short-lived signed link. They are not published.",
    uploadFailed: "Could not upload the file.",
    removeFailed: "Could not remove the file.",
    viewFailed: "Could not open the file.",
    accepted: "Accepted",
    pendingReview: "Awaiting review",
    uploadedOn: "Uploaded {{date}}",
    notUploaded: "Not uploaded",
    view: "View",
    replace: "Replace",
    upload: "Upload",
    remove: "Remove",
    locked: "Documents cannot be changed while the profile is under review or verified.",
    formats: "PDF or image, up to 10 MB.",
    kinds: {
      company_registration: "Company registration extract",
      insurance_certificate: "Insurance certificate",
      vehicle_authority: "Proof of authority to rent the vehicles",
      tax_identification: "Tax identification",
      vat_certificate: "VAT certificate",
      licence_permit: "Rental licence or permit",
      payout_bank_proof: "Payout account proof",
      signatory_authority: "Proof of signatory authority",
    },
  },
  agreement: {
    title: "Master Partner Agreement",
    subtitle:
      "Read the current Partner Agreement and Operating Rules, then accept them if you are authorised to bind the company.",
    loadFailed: "Could not load the agreement.",
    submitFailed: "Could not record the acceptance.",
    submitted: "Acceptance recorded as {{id}}.",
    snapshotFailed: "Could not load the signed copy.",
    snapshotTitle: "Signed Partner Agreement",
    agreementId: "Agreement ID",
    partner: "Partner",
    signer: "Signer",
    acceptedAt: "Accepted",
    method: "Method",
    checksum: "Package checksum",
    operator: "Operator",
    draftTitle: "These documents are still drafts",
    draftBody:
      "They have not been published yet, so they cannot be accepted. Rovaro has to publish them first.",
    signedCurrent: "Current version signed",
    signedOutdated: "Superseded version",
    signedTitle: "Your signed copy",
    acceptedVersions: "Accepted versions",
    viewSnapshot: "View signed copy",
    downloadSnapshot: "Download signed copy",
    newVersionTitle: "A new version requires acceptance",
    newVersionBody:
      "The documents in force have changed since you last signed. Trading stays closed until you accept the current package. The earlier signed copy remains on file.",
    alreadySigned:
      "You have already accepted this version. There is nothing further to sign unless Rovaro publishes a new version.",
    packageTitle: "Documents to accept",
    documentTypes: {
      "partner-agreement": "Partner Agreement",
      "partner-operating-rules": "Partner Operating Rules",
      "data-protection-schedule": "Data Protection Schedule",
    },
    effectiveFrom: "effective",
    versionLine: "Version {{version}} · {{language}}",
    draftLabel: "draft",
    readConfirmed: "You have reached the end of the documents.",
    scrollToEnd: "Scroll to the end of the documents before you can accept them.",
    signTitle: "Accept",
    signerName: "Full name",
    signerRole: "Role",
    signerEmail: "Email",
    signerEmailHint: "Taken from the signed-in account.",
    authorityCheckbox:
      "I confirm that I am authorised to accept these documents on behalf of the company.",
    acceptanceFallback:
      "I have read the Partner Agreement, the Partner Operating Rules and the Data Protection Schedule, I am authorised to sign on behalf of the company named above, and I accept these documents on its behalf.",
    recordedTitle: "What is recorded",
    recordedBody:
      "Your name, role, the signed-in account, the time in UTC, the IP address, the browser, the document versions and the package checksum. The signed copy cannot be edited afterwards.",
    accepting: "Recording acceptance…",
    acceptNewVersion: "Accept the new version",
    accept: "Accept the Partner Agreement",
    backToProfile: "Back to legal profile",
  },
};

export const partnerLegalEs = {
  title: "Perfil legal",
  subtitle:
    "Rovaro usa estos datos para verificar tu empresa antes de que puedas firmar el Acuerdo Marco de Partner y recibir reservas.",
  card: {
    title: "Estado comercial",
    subtitle:
      "Verificación y Acuerdo de Partner firmado, necesarios para recibir reservas.",
    open: "Puede operar",
    blocked: "Aún no puede operar",
    openProfile: "Perfil legal",
    openAgreement: "Acuerdo de Partner",
  },
  gate: {
    okTitle: "Puedes recibir reservas",
    okBody:
      "Tu empresa está verificada y el Acuerdo de Partner vigente está firmado.",
    blockedTitle: "Aún no puedes recibir reservas",
    blockedBody:
      "Hay que completar estos puntos antes de publicar anuncios y recibir reservas.",
    goToProfile: "Abrir perfil legal",
    goToAgreement: "Abrir acuerdo",
    operatorAction: "Este paso lo tiene que completar Rovaro.",
    blocker: {
      no_profile: "Todavía no se ha creado el perfil legal.",
      profile_incomplete: "El perfil legal está incompleto.",
      awaiting_verification: "El perfil está pendiente de verificación por Rovaro.",
      rejected: "El perfil fue rechazado. Corrige los datos y vuelve a enviarlo.",
      suspended: "La actividad está suspendida. Rovaro tiene que reactivar la cuenta.",
      agreement_not_signed: "El Acuerdo Marco de Partner no está firmado.",
      agreement_outdated:
        "Hay una nueva versión del Acuerdo de Partner y hay que aceptarla.",
    },
  },
  status: {
    none: {
      title: "Aún no hay perfil legal",
      body: "Completa los campos e incorpora los documentos exigidos para iniciar la verificación.",
    },
    reason: "Motivo indicado: {{reason}}",
    changedAt: "Último cambio de estado: {{at}} UTC",
    DRAFT: {
      label: "Borrador",
      title: "Borrador",
      body: "Este perfil no se ha enviado para verificación.",
    },
    PENDING_VERIFICATION: {
      label: "Pendiente de verificación",
      title: "Pendiente de verificación",
      body: "Rovaro está revisando la información y los documentos. El perfil no se puede editar hasta que termine esa revisión.",
    },
    VERIFIED: {
      label: "Verificado",
      title: "Verificado",
      body: "El perfil está verificado. Editarlo detendrá la actividad hasta que Rovaro revise el cambio.",
    },
    SUSPENDED: {
      label: "Suspendido",
      title: "Suspendido",
      body: "La actividad está suspendida. Puedes actualizar el perfil; Rovaro tiene que reactivar la cuenta.",
    },
    REJECTED: {
      label: "Rechazado",
      title: "Rechazado",
      body: "La solicitud fue rechazada. Corrige los datos y vuelve a enviar el perfil.",
    },
  },
  form: {
    loadFailed: "No se ha podido cargar el perfil legal.",
    saveFailed: "No se ha podido guardar el perfil legal.",
    saved: "Perfil legal guardado.",
    submitted: "Enviado para verificación.",
    saving: "Guardando…",
    save: "Guardar",
    submitForVerification: "Enviar para verificación",
    resubmitForVerification: "Volver a enviar para verificación",
    cancelEdit: "Cancelar edición",
    goToAgreement: "Acuerdo de Partner",
    rejectedReopen:
      "La solicitud anterior fue rechazada. Actualiza los campos o documentos rechazados y vuelve a enviarlo.",
    unlockToEdit: "Editar",
    readOnlyTitle: "Este perfil es de solo lectura",
    readOnlyVerified:
      "El perfil está verificado. Puedes desbloquearlo para corregir algo; la actividad se detendrá hasta que Rovaro revise el cambio.",
    readOnlyPending:
      "El perfil está en revisión por Rovaro y no se puede cambiar hasta que termine esa revisión.",
    unlockWarningTitle: "Edición de un perfil verificado",
    unlockWarningBody:
      "Guardar un cambio suspenderá la actividad hasta que Rovaro revise los datos actualizados.",
    missingTitle: "Aún falta para la verificación",
    required: "Obligatorio",
    optional: "Si aplica",
    sections: {
      identity: {
        title: "Identidad de la empresa",
        hint: "La entidad jurídica que firmará el Acuerdo de Partner.",
      },
      addresses: {
        title: "Domicilios",
        hint: "El domicilio social es obligatorio. El domicilio de actividad solo si es distinto.",
      },
      signatory: {
        title: "Firmante autorizado",
        hint: "La persona que aceptará el Acuerdo de Partner en nombre de la empresa.",
      },
      contact: {
        title: "Contacto comercial",
        hint: "Para verificación y contacto operativo. No se muestra en el sitio público.",
      },
      payout: {
        title: "Referencia de cobro",
        hint: "Una referencia con la que Rovaro pueda identificar la cuenta. No pegues un IBAN completo si no te lo han pedido.",
      },
      insurance: {
        title: "Seguro y licencias",
        hint: "Seguro de la flota y las licencias o permisos de alquiler que correspondan donde operas.",
      },
      vehicles: {
        title: "Autorización para alquilar los vehículos",
        hint: "Confirma que sois propietarios de los vehículos anunciados o que estáis autorizados a alquilarlos.",
      },
    },
    fields: {
      legalName: { label: "Razón social", hint: "Nombre en el registro mercantil o fiscal." },
      tradingName: { label: "Nombre comercial", hint: "Déjalo vacío si coincide con la razón social." },
      entityType: { label: "Tipo de entidad", hint: "" },
      countryOfRegistration: {
        label: "País de registro",
        hint: "ISO 3166-1 alpha-2, por ejemplo ES.",
      },
      registrationNumber: { label: "Número de registro", hint: "" },
      nifCif: { label: "NIF / CIF", hint: "Identificador fiscal español, si operas en España." },
      vatNumber: { label: "NIF-IVA / VAT", hint: "Déjalo vacío si no estás dado de alta en IVA." },
      registeredAddress: { label: "Domicilio social", hint: "" },
      businessAddress: { label: "Domicilio de actividad", hint: "Solo si es distinto del domicilio social." },
      signatoryName: { label: "Nombre del firmante", hint: "" },
      signatoryRole: { label: "Cargo del firmante", hint: "Administrador, apoderado u otro título." },
      signatoryAuthorityBasis: {
        label: "Base de la autorización",
        hint: "Cómo puede vincular esta persona a la empresa (cargo, poder, etc.).",
      },
      businessEmail: { label: "Email comercial", hint: "" },
      businessPhone: { label: "Teléfono comercial", hint: "" },
      emergencyPhone: { label: "Teléfono de emergencia", hint: "Localizable en las entregas. Opcional." },
      payoutAccountReference: {
        label: "Referencia de la cuenta de cobro",
        hint: "Una etiqueta o referencia enmascarada, no un número de cuenta público.",
      },
      insuranceProvider: { label: "Aseguradora", hint: "" },
      insurancePolicyReference: { label: "Referencia de póliza", hint: "" },
      insuranceValidUntil: { label: "Cobertura válida hasta", hint: "" },
      licences: {
        label: "Licencias y permisos",
        hint: "Uno por línea. Déjalo vacío si no se exigen donde operas.",
      },
    },
    confirmations: {
      signatoryAuthorityConfirmed: {
        label: "Confirmo que esta persona está autorizada para vincular a la empresa.",
        short: "Autorización del firmante",
      },
      vehicleAuthorityConfirmed: {
        label:
          "Confirmo que la empresa es propietaria de los vehículos anunciados o está autorizada a alquilarlos.",
        short: "Autorización sobre los vehículos",
      },
    },
    entityTypes: {
      sl: "Sociedad Limitada (SL)",
      sa: "Sociedad Anónima (SA)",
      autonomo: "Autónomo",
      other: "Otra",
    },
  },
  documents: {
    title: "Documentos de respaldo",
    subtitle:
      "Los archivos se guardan en privado y se abren con un enlace firmado de corta duración. No se publican.",
    uploadFailed: "No se ha podido subir el archivo.",
    removeFailed: "No se ha podido eliminar el archivo.",
    viewFailed: "No se ha podido abrir el archivo.",
    accepted: "Aceptado",
    pendingReview: "Pendiente de revisión",
    uploadedOn: "Subido el {{date}}",
    notUploaded: "Sin subir",
    view: "Ver",
    replace: "Sustituir",
    upload: "Subir",
    remove: "Eliminar",
    locked:
      "Los documentos no se pueden cambiar mientras el perfil está en revisión o verificado.",
    formats: "PDF o imagen, hasta 10 MB.",
    kinds: {
      company_registration: "Extracto de registro mercantil",
      insurance_certificate: "Certificado de seguro",
      vehicle_authority: "Prueba de autorización para alquilar los vehículos",
      tax_identification: "Identificación fiscal",
      vat_certificate: "Certificado de IVA",
      licence_permit: "Licencia o permiso de alquiler",
      payout_bank_proof: "Justificante de la cuenta de cobro",
      signatory_authority: "Prueba de la autorización del firmante",
    },
  },
  agreement: {
    title: "Acuerdo Marco de Partner",
    subtitle:
      "Lee el Acuerdo de Partner y las Normas de Funcionamiento vigentes y acéptalos si estás autorizado para vincular a la empresa.",
    loadFailed: "No se ha podido cargar el acuerdo.",
    submitFailed: "No se ha podido registrar la aceptación.",
    submitted: "Aceptación registrada como {{id}}.",
    snapshotFailed: "No se ha podido cargar la copia firmada.",
    snapshotTitle: "Acuerdo de Partner firmado",
    agreementId: "ID del acuerdo",
    partner: "Partner",
    signer: "Firmante",
    acceptedAt: "Aceptado",
    method: "Método",
    checksum: "Suma de comprobación del paquete",
    operator: "Operador",
    draftTitle: "Estos documentos siguen en borrador",
    draftBody:
      "Aún no se han publicado, así que no se pueden aceptar. Rovaro tiene que publicarlos primero.",
    signedCurrent: "Versión vigente firmada",
    signedOutdated: "Versión sustituida",
    signedTitle: "Tu copia firmada",
    acceptedVersions: "Versiones aceptadas",
    viewSnapshot: "Ver copia firmada",
    downloadSnapshot: "Descargar copia firmada",
    newVersionTitle: "Hay que aceptar una nueva versión",
    newVersionBody:
      "Los documentos vigentes han cambiado desde tu última firma. La actividad permanece cerrada hasta que aceptes el paquete actual. La copia firmada anterior se conserva.",
    alreadySigned:
      "Ya has aceptado esta versión. No hay nada más que firmar salvo que Rovaro publique una versión nueva.",
    packageTitle: "Documentos a aceptar",
    documentTypes: {
      "partner-agreement": "Acuerdo de Partner",
      "partner-operating-rules": "Normas de Funcionamiento",
      "data-protection-schedule": "Anexo de Protección de Datos",
    },
    effectiveFrom: "en vigor",
    versionLine: "Versión {{version}} · {{language}}",
    draftLabel: "borrador",
    readConfirmed: "Has llegado al final de los documentos.",
    scrollToEnd: "Desplázate hasta el final de los documentos antes de poder aceptarlos.",
    signTitle: "Aceptar",
    signerName: "Nombre completo",
    signerRole: "Cargo",
    signerEmail: "Email",
    signerEmailHint: "Se toma de la cuenta con la que has iniciado sesión.",
    authorityCheckbox:
      "Confirmo que estoy autorizado para aceptar estos documentos en nombre de la empresa.",
    acceptanceFallback:
      "He leído el Acuerdo de Partner, las Normas de Funcionamiento y el Anexo de Protección de Datos, estoy autorizado para firmar en nombre de la empresa indicada y los acepto en su nombre.",
    recordedTitle: "Qué se registra",
    recordedBody:
      "Tu nombre, cargo, la cuenta con la que has iniciado sesión, la hora en UTC, la dirección IP, el navegador, las versiones de los documentos y la suma de comprobación del paquete. La copia firmada no se puede editar después.",
    accepting: "Registrando la aceptación…",
    acceptNewVersion: "Aceptar la nueva versión",
    accept: "Aceptar el Acuerdo de Partner",
    backToProfile: "Volver al perfil legal",
  },
};

export const partnerLegalRu = partnerLegalEn;
export const partnerLegalUk = partnerLegalEn;
export const partnerLegalEl = partnerLegalEn;
export const partnerLegalDe = partnerLegalEn;

export function withPartnerLegal(base, copy, navLabel) {
  return {
    ...base,
    header: { ...(base.header || {}), legalProfile: navLabel },
    partnerLegal: copy,
  };
}
