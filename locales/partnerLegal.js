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
    "Add your company name to start. Everything else is optional — fill it in when you have it. Bookings stay closed until Rovaro verifies you and you sign the Partner Agreement.",
  card: {
    title: "Trading status",
    subtitle: "Complete your company setup to start receiving bookings.",
    labels: {
      setup: "Setup in progress",
      almost: "Setup almost complete",
      ready: "Ready to receive bookings",
    },
    actions: {
      continueSetup: "Continue setup",
      uploadDocuments: "Upload documents",
      reviewTerms: "Review and accept terms",
      reviewUpdatedTerms: "Review updated terms",
    },
    states: {
      completeDetailsTitle: "Complete your company details to continue.",
      completeDetailsBody: "Complete your company setup to start receiving bookings.",
      uploadTitle: "Upload the remaining company documents.",
      uploadBody: "Complete your company setup to start receiving bookings.",
      reviewTitle: "Your documents are under review.",
      reviewBody: "Rovaro is preparing the terms. No action is required from you.",
      termsPreparingTitle: "Your documents are verified. Rovaro Terms are being prepared.",
      termsPreparingBody: "We will notify you when they are ready. No action is required from you.",
      termsReadyTitle: "Rovaro Terms are ready to review.",
      termsReadyBody: "Complete your company setup to start receiving bookings.",
      termsUpdateTitle: "Updated Rovaro Terms require your acceptance.",
      termsUpdateBody: "Complete your company setup to start receiving bookings.",
      listingTitle: "Your company is approved.",
      listingBody: "Rovaro will activate your marketplace listing.",
      readyTitle: "Ready to receive bookings",
      readyBody: "Your company can receive bookings.",
      suspendedTitle: "Setup almost complete",
      suspendedBody: "Rovaro is preparing the terms. No action is required from you.",
    },
  },
  gate: {
    okTitle: "You can take bookings",
    okBody:
      "Your company is verified and the current Partner Agreement is signed.",
    blockedTitle: "You cannot take bookings yet",
    blockedBody:
      "These items have to be cleared before listings can be offered and bookings received.",
    goToProfile: "Open legal profile",
    goToAgreement: "Review and accept terms",
    operatorAction: "Rovaro has to complete this step.",
    actionBlocked:
      "Complete your company setup to start receiving bookings.",
    actionBlockedSuspended:
      "Trading is suspended. Rovaro has to restore the account before you can publish cars or take bookings.",
    listingPending:
      "Your company is verified, but marketplace listing is not enabled yet. Rovaro turns listing on after the agreement is in force.",
    openProfileCta: "Continue setup.",
    blocker: {
      no_profile: "The legal profile has not been created yet.",
      profile_incomplete: "The legal profile is incomplete.",
      awaiting_verification: "The profile is waiting for Rovaro to verify it.",
      rejected: "The profile was rejected. Correct the details and submit again.",
      suspended: "Trading is suspended. Rovaro has to restore the account.",
      agreement_not_signed: "Rovaro Terms have not been accepted.",
      agreement_outdated:
        "A new version of the Partner Agreement is in force and has to be accepted.",
    },
  },
  status: {
    none: {
      title: "No legal profile yet",
      body: "Fill in the company name below. You can add papers and extra details later.",
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
    unlockToEdit: "Update company details",
    updateDetails: "Update company details",
    updateDetailsBody:
      "Changes to verified legal details may need review before they take effect.",
    readOnlyTitle: "This profile is read-only",
    readOnlyVerified:
      "Verified details stay active. Use Update company details to propose a change.",
    readOnlyPending:
      "The profile is with Rovaro for review and cannot be changed until that review finishes.",
    unlockWarningTitle: "Editing a verified profile",
    unlockWarningBody:
      "Changes to verified legal details may need review before they take effect.",
    missingTitle: "Still needed to submit",
    required: "Required",
    optional: "Optional",
    sections: {
      identity: {
        title: "Company identity",
        hint: "Legal name is enough to send for review. The rest helps Rovaro check you faster.",
      },
      addresses: {
        title: "Addresses",
        hint: "Optional. Registered address if you have it; business address only if it is different.",
      },
      signatory: {
        title: "Authorised signatory",
        hint: "Optional. The person who will accept the Partner Agreement.",
      },
      contact: {
        title: "Business contact",
        hint: "Optional. Used for verification contact. Not shown on the public site.",
      },
      payout: {
        title: "Bank details (optional)",
        hint: "Rovaro does not pay the supplier and does not run a settlement cycle. The supplier collects the remaining balance from the customer. This optional field is identity information only, not a Rovaro payout account.",
      },
      insurance: {
        title: "Insurance and licences",
        hint: "Optional. Fleet insurance details if you already have them.",
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
        label: "Bank account reference (optional)",
        hint: "A label or masked reference. Rovaro does not transfer rental money to the supplier.",
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
      "Optional. Attach what you have. Files stay private. Rovaro can ask for more during review.",
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
      payout_bank_proof: "Bank account proof (optional — not a Rovaro payout)",
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
      "They have not been published yet, so they cannot be accepted. Open Legal documents, load the built-in drafts and publish them. If you are testing as a partner, leave that view first.",
    emptyTitle: "No agreement documents to accept",
    emptyBody:
      "Nothing has been published yet, so this agreement cannot be signed. Open Legal documents, load the built-in drafts and publish them. If you are testing as a partner, leave that view first.",
    openLegalDocuments: "Open Legal documents",
    signingBlockedTitle: "This agreement cannot be signed yet",
    signingBlocker: {
      empty_package:
        "No agreement documents are available. Load the built-in drafts in Legal documents and publish them.",
      unpublished_documents:
        "The documents are still drafts. They have to be published in Legal documents before they can be accepted.",
      missing_checksum:
        "The document package has no checksum, so acceptance cannot be recorded.",
      already_signed: "This version has already been accepted.",
      clickwrap_unavailable:
        "Clickwrap signing is not the configured method, so this screen cannot record an acceptance.",
      no_profile: "Create the legal profile before signing the agreement.",
      profile_incomplete:
        "Complete and submit the legal profile. Signing is only possible after Rovaro verifies it.",
      awaiting_verification:
        "The company must be verified before the Partner Agreement can be signed. Rovaro has to complete that review.",
      rejected:
        "The legal profile was rejected. Correct it and submit again before signing.",
      suspended: "Trading is suspended. Rovaro has to restore the account before signing.",
    },
    formBlockedTitle: "Still needed to accept",
    formBlocker: {
      need_read: "Scroll to the end of the documents.",
      need_name: "Enter the signer's full name.",
      need_role: "Enter the signer's role.",
      need_authority: "Confirm that you are authorised to bind the company.",
      need_acceptance: "Tick the acceptance checkbox.",
    },
    submitError: {
      no_profile: "The legal profile has not been created.",
      not_verified:
        "The company must be verified before the Partner Agreement can be signed.",
      no_documents: "No agreement documents are available.",
      unpublished_documents:
        "The documents are still drafts and cannot be accepted until they are published.",
      missing_checksum: "The document package has no checksum.",
      missing_signer_details: "Full name, role and the signed-in email are required.",
      authority_not_confirmed:
        "Confirm that you are authorised to bind the company.",
      acceptance_not_ticked: "Tick the acceptance checkbox.",
      missing_audit_context:
        "The acceptance could not be recorded because the client address is missing.",
      provider_not_configured:
        "The configured e-signature provider cannot record an acceptance.",
    },
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
  customerRules: {
    title: "Customer rental rules",
    subtitle:
      "Write the rental rules {{company}} customers must accept when they book. English is the source. Save translates them into every site language so the booking form can open both the Rovaro contract and yours.",
    englishLabel: "Rental rules (English)",
    englishHint:
      "Deposit, fuel, mileage, extra driver, cross-border, smoking, pets, late return. Plain text, up to {{max}} characters.",
    save: "Save and translate",
    saving: "Translating…",
    unsaved: "Unsaved changes",
    saved: "Saved and translated into the site languages.",
    savedPartial:
      "Saved. Some languages could not be translated — check the warning below and save again.",
    savedWithoutTranslate:
      "English saved. Add GOOGLE_TRANSLATE_API_KEY (or enable Cloud Translation on the Maps key) to fill the other languages.",
    cleared: "Customer rental rules removed.",
    loadFailed: "Could not load rental rules.",
    saveFailed: "Could not save rental rules.",
    translateMissingTitle: "Translation API is not configured",
    translateMissingBody:
      "Customers will see the English text until Cloud Translation is enabled. The booking form still works.",
    translationsTitle: "Translations",
    translationsBody: "Generated for: {{languages}}",
    failedTitle: "Languages that did not translate",
  },
  review: {
    title: "Verify this partner",
    body: "Open the papers, then set VERIFIED or REJECTED. This is the document-review queue — platform contract publish is the other Legal tab.",
    verify: "Set VERIFIED",
    reject: "Set REJECTED",
    suspend: "Suspend",
    reopenDraft: "Return to draft",
    reason: "Reason",
    reasonRequired: "Give a reason when rejecting or suspending.",
    failed: "Could not update verification.",
    done: "Verification updated.",
    noProfile: "This partner has not submitted a legal profile yet.",
    draftTitle: "Status: Draft",
    draftBody:
      "The partner has uploaded documents but has not submitted the profile for review.",
    moveToReview: "Move to review",
    moveToReviewTitle: "Move to review",
    moveToReviewBody:
      "This puts the profile in Needs review. It does not approve the partner.",
    moveToReviewConfirm: "Move to review",
    moveToReviewCancel: "Cancel",
    approve: "Approve",
    requestChanges: "Reject / request changes",
    pendingTitle: "Review this partner",
    pendingBody:
      "Open the papers, then approve or ask for changes. Approval does not by itself let the company operate.",
    verifiedTitle: "Verified partner",
    verifiedBody:
      "This profile is already verified. You can suspend it. Approving again is not available.",
  },
  companyPage: {
    title: "Company legal",
    details: "Company details",
    documents: "Documents",
    terms: "Terms",
    draft: "Draft",
    submitted: "Submitted",
    underReview: "Under review",
    verified: "Verified",
    rejected: "Rejected",
    suspended: "Suspended",
    standardApply: "Standard Rovaro Terms apply",
    standardTerms: "Standard terms",
    customAgreement: "Custom agreement",
    termsReady: "Review and accept terms",
    acceptTerms: "Accept terms",
    termsAccepted: "Rovaro Terms accepted",
    termsUpdated: "Updated Rovaro Terms require acceptance",
    preparing:
      "Rovaro Terms are being prepared. You can continue setting up your company and submitting documents.",
    signerName: "Your name",
    signerRole: "Your role",
    rolePlaceholder: "Owner, Director or Authorised representative",
    signerEmail: "Email",
    authority: "I am authorised to accept these terms for this company.",
    acceptFailed: "Could not record the acceptance.",
    saved: "Saved.",
  },
};

export const partnerLegalEs = {
  title: "Perfil legal",
  subtitle:
    "Con el nombre de la empresa basta para empezar. El resto es opcional. Las reservas siguen cerradas hasta que Rovaro te verifique y firmes el Acuerdo de Partner.",
  card: {
    title: "Estado comercial",
    subtitle: "Completa la configuración de la empresa para empezar a recibir reservas.",
    labels: {
      setup: "Configuración en curso",
      almost: "Configuración casi lista",
      ready: "Lista para recibir reservas",
    },
    actions: {
      continueSetup: "Continuar configuración",
      uploadDocuments: "Subir documentos",
      reviewTerms: "Revisar y aceptar las condiciones",
      reviewUpdatedTerms: "Revisar las condiciones actualizadas",
    },
    states: {
      completeDetailsTitle: "Completa los datos de la empresa para continuar.",
      completeDetailsBody: "Completa la configuración de la empresa para empezar a recibir reservas.",
      uploadTitle: "Sube los documentos de la empresa que faltan.",
      uploadBody: "Completa la configuración de la empresa para empezar a recibir reservas.",
      reviewTitle: "Tus documentos están en revisión.",
      reviewBody: "Rovaro está preparando las condiciones. No tienes que hacer nada.",
      termsPreparingTitle: "Tus documentos están verificados. Las Condiciones de Rovaro se están preparando.",
      termsPreparingBody: "Te avisaremos cuando estén listas. No tienes que hacer nada.",
      termsReadyTitle: "Las Condiciones de Rovaro están listas para revisar.",
      termsReadyBody: "Completa la configuración de la empresa para empezar a recibir reservas.",
      termsUpdateTitle: "Las Condiciones de Rovaro actualizadas requieren tu aceptación.",
      termsUpdateBody: "Completa la configuración de la empresa para empezar a recibir reservas.",
      listingTitle: "Tu empresa está aprobada.",
      listingBody: "Rovaro activará tu anuncio en el marketplace.",
      readyTitle: "Lista para recibir reservas",
      readyBody: "Tu empresa puede recibir reservas.",
      suspendedTitle: "Configuración casi lista",
      suspendedBody: "Rovaro está preparando las condiciones. No tienes que hacer nada.",
    },
  },
  gate: {
    okTitle: "Puedes recibir reservas",
    okBody:
      "Tu empresa está verificada y el Acuerdo de Partner vigente está firmado.",
    blockedTitle: "Aún no puedes recibir reservas",
    blockedBody:
      "Hay que completar estos puntos antes de publicar anuncios y recibir reservas.",
    goToProfile: "Abrir perfil legal",
    goToAgreement: "Revisar y aceptar las condiciones",
    operatorAction: "Este paso lo tiene que completar Rovaro.",
    actionBlocked:
      "Completa la configuración de la empresa para empezar a recibir reservas.",
    actionBlockedSuspended:
      "La actividad está suspendida. Rovaro tiene que reactivar la cuenta antes de que puedas publicar coches o recibir reservas.",
    listingPending:
      "Tu empresa está verificada, pero el listado en el marketplace aún no está activo. Rovaro lo activa cuando el acuerdo está en vigor.",
    openProfileCta: "Continúa la configuración.",
    blocker: {
      no_profile: "Todavía no se ha creado el perfil legal.",
      profile_incomplete: "El perfil legal está incompleto.",
      awaiting_verification: "El perfil está pendiente de verificación por Rovaro.",
      rejected: "El perfil fue rechazado. Corrige los datos y vuelve a enviarlo.",
      suspended: "La actividad está suspendida. Rovaro tiene que reactivar la cuenta.",
      agreement_not_signed: "Las Condiciones de Rovaro no se han aceptado.",
      agreement_outdated:
        "Hay una nueva versión del Acuerdo de Partner y hay que aceptarla.",
    },
  },
  status: {
    none: {
      title: "Aún no hay perfil legal",
      body: "Indica el nombre de la empresa. Puedes añadir papeles y el resto de datos más tarde.",
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
    unlockToEdit: "Actualizar datos de la empresa",
    updateDetails: "Actualizar datos de la empresa",
    updateDetailsBody:
      "Los cambios en los datos legales verificados pueden necesitar revisión antes de aplicarse.",
    readOnlyTitle: "Este perfil es de solo lectura",
    readOnlyVerified:
      "Los datos verificados siguen activos. Usa Actualizar datos de la empresa para proponer un cambio.",
    readOnlyPending:
      "El perfil está en revisión por Rovaro y no se puede cambiar hasta que termine esa revisión.",
    unlockWarningTitle: "Edición de un perfil verificado",
    unlockWarningBody:
      "Los cambios en los datos legales verificados pueden necesitar revisión antes de aplicarse.",
    missingTitle: "Aún falta para enviar",
    required: "Obligatorio",
    optional: "Opcional",
    sections: {
      identity: {
        title: "Identidad de la empresa",
        hint: "Con la razón social basta para enviar a revisión. El resto ayuda a Rovaro a comprobarte antes.",
      },
      addresses: {
        title: "Domicilios",
        hint: "Opcional. Domicilio social si lo tienes; el de actividad solo si es distinto.",
      },
      signatory: {
        title: "Firmante autorizado",
        hint: "Opcional. La persona que aceptará el Acuerdo de Partner.",
      },
      contact: {
        title: "Contacto comercial",
        hint: "Opcional. Para el contacto de verificación. No se muestra en el sitio público.",
      },
      payout: {
        title: "Datos bancarios (opcional)",
        hint: "Rovaro no paga al proveedor ni opera un ciclo de liquidación. El proveedor cobra el saldo restante al cliente. Este campo opcional es solo información de identidad, no una cuenta de cobro de Rovaro.",
      },
      insurance: {
        title: "Seguro y licencias",
        hint: "Opcional. Datos del seguro de la flota si ya los tienes.",
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
        label: "Referencia de cuenta bancaria (opcional)",
        hint: "Una etiqueta o referencia enmascarada. Rovaro no transfiere el importe del alquiler al proveedor.",
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
      "Opcional. Adjunta lo que tengas. Los archivos se quedan en privado. Rovaro puede pedir más durante la revisión.",
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
      payout_bank_proof: "Justificante bancario (opcional — no es un pago de Rovaro)",
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
      "Aún no se han publicado, así que no se pueden aceptar. Abre Documentos legales, carga los borradores incorporados y publícalos. Si estás probando como partner, sal primero de esa vista.",
    emptyTitle: "No hay documentos de acuerdo para aceptar",
    emptyBody:
      "Todavía no se ha publicado nada, así que este acuerdo no se puede firmar. Abre Documentos legales, carga los borradores incorporados y publícalos. Si estás probando como partner, sal primero de esa vista.",
    openLegalDocuments: "Abrir documentos legales",
    signingBlockedTitle: "Este acuerdo aún no se puede firmar",
    signingBlocker: {
      empty_package:
        "No hay documentos de acuerdo. Carga los borradores incorporados en Documentos legales y publícalos.",
      unpublished_documents:
        "Los documentos siguen en borrador. Hay que publicarlos en Documentos legales antes de poder aceptarlos.",
      missing_checksum:
        "El paquete de documentos no tiene suma de comprobación, así que no se puede registrar la aceptación.",
      already_signed: "Esta versión ya se ha aceptado.",
      clickwrap_unavailable:
        "La firma clickwrap no es el método configurado, así que esta pantalla no puede registrar una aceptación.",
      no_profile: "Crea el perfil legal antes de firmar el acuerdo.",
      profile_incomplete:
        "Completa y envía el perfil legal. Solo se puede firmar cuando Rovaro lo haya verificado.",
      awaiting_verification:
        "La empresa tiene que estar verificada antes de firmar el Acuerdo de Partner. Rovaro tiene que terminar esa revisión.",
      rejected:
        "El perfil legal fue rechazado. Corrígelo y vuelve a enviarlo antes de firmar.",
      suspended:
        "La actividad está suspendida. Rovaro tiene que reactivar la cuenta antes de firmar.",
    },
    formBlockedTitle: "Falta para aceptar",
    formBlocker: {
      need_read: "Desplázate hasta el final de los documentos.",
      need_name: "Indica el nombre completo del firmante.",
      need_role: "Indica el cargo del firmante.",
      need_authority: "Confirma que estás autorizado para vincular a la empresa.",
      need_acceptance: "Marca la casilla de aceptación.",
    },
    submitError: {
      no_profile: "Todavía no se ha creado el perfil legal.",
      not_verified:
        "La empresa tiene que estar verificada antes de firmar el Acuerdo de Partner.",
      no_documents: "No hay documentos de acuerdo disponibles.",
      unpublished_documents:
        "Los documentos siguen en borrador y no se pueden aceptar hasta que se publiquen.",
      missing_checksum: "El paquete de documentos no tiene suma de comprobación.",
      missing_signer_details:
        "Hacen falta el nombre completo, el cargo y el email de la sesión.",
      authority_not_confirmed:
        "Confirma que estás autorizado para vincular a la empresa.",
      acceptance_not_ticked: "Marca la casilla de aceptación.",
      missing_audit_context:
        "No se ha podido registrar la aceptación porque falta la dirección del cliente.",
      provider_not_configured:
        "El proveedor de firma configurado no puede registrar una aceptación.",
    },
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
  customerRules: {
    title: "Normas de alquiler para el cliente",
    subtitle:
      "Escribe las normas de alquiler que los clientes de {{company}} deben aceptar al reservar. El inglés es el original. Al guardar se traducen a todos los idiomas del sitio para que el formulario abra el contrato de Rovaro y el vuestro.",
    englishLabel: "Normas de alquiler (inglés)",
    englishHint:
      "Depósito, combustible, kilometraje, conductor adicional, cruces de frontera, tabaco, mascotas, retraso en la devolución. Texto plano, hasta {{max}} caracteres.",
    save: "Guardar y traducir",
    saving: "Traduciendo…",
    unsaved: "Cambios sin guardar",
    saved: "Guardado y traducido a los idiomas del sitio.",
    savedPartial:
      "Guardado. Algunos idiomas no se han podido traducir: mira el aviso y vuelve a guardar.",
    savedWithoutTranslate:
      "Inglés guardado. Añade GOOGLE_TRANSLATE_API_KEY (o activa Cloud Translation en la clave de Maps) para el resto de idiomas.",
    cleared: "Se han eliminado las normas de alquiler.",
    loadFailed: "No se han podido cargar las normas de alquiler.",
    saveFailed: "No se han podido guardar las normas de alquiler.",
    translateMissingTitle: "La API de traducción no está configurada",
    translateMissingBody:
      "Los clientes verán el texto en inglés hasta que Cloud Translation esté activo. El formulario de reserva sigue funcionando.",
    translationsTitle: "Traducciones",
    translationsBody: "Generadas para: {{languages}}",
    failedTitle: "Idiomas que no se han traducido",
  },
  review: {
    title: "Verificar a este partner",
    body: "Abre los papeles y marca VERIFIED o REJECTED. Esta es la cola de revisión de documentos — publicar contratos de la plataforma es la otra pestaña de Legal.",
    verify: "Marcar VERIFIED",
    reject: "Marcar REJECTED",
    suspend: "Suspender",
    reopenDraft: "Volver a borrador",
    reason: "Motivo",
    reasonRequired: "Indica un motivo al rechazar o suspender.",
    failed: "No se pudo actualizar la verificación.",
    done: "Verificación actualizada.",
    noProfile: "Este partner aún no ha enviado un perfil legal.",
    draftTitle: "Estado: borrador",
    draftBody:
      "El partner ha subido documentos, pero no ha enviado el perfil a revisión.",
    moveToReview: "Pasar a revisión",
    moveToReviewTitle: "Pasar a revisión",
    moveToReviewBody:
      "El perfil entra en Necesita revisión. Esto no aprueba al partner.",
    moveToReviewConfirm: "Pasar a revisión",
    moveToReviewCancel: "Cancelar",
    approve: "Aprobar",
    requestChanges: "Rechazar / pedir cambios",
    pendingTitle: "Revisar a este partner",
    pendingBody:
      "Abre los papeles y aprueba o pide cambios. Aprobar no basta para que la empresa pueda operar.",
    verifiedTitle: "Partner verificado",
    verifiedBody:
      "Este perfil ya está verificado. Puedes suspenderlo. No se vuelve a aprobar.",
  },
  companyPage: {
    title: "Legal de la empresa",
    details: "Datos de la empresa",
    documents: "Documentos",
    terms: "Condiciones",
    draft: "Borrador",
    submitted: "Enviado",
    underReview: "En revisión",
    verified: "Verificado",
    rejected: "Rechazado",
    suspended: "Suspendido",
    standardApply: "Se aplican las Condiciones estándar de Rovaro",
    standardTerms: "Condiciones estándar",
    customAgreement: "Acuerdo personalizado",
    termsReady: "Revisar y aceptar las condiciones",
    acceptTerms: "Aceptar condiciones",
    termsAccepted: "Condiciones de Rovaro aceptadas",
    termsUpdated: "Las Condiciones de Rovaro actualizadas requieren aceptación",
    preparing:
      "Las Condiciones de Rovaro se están preparando. Puedes seguir configurando la empresa y enviando documentos.",
    signerName: "Tu nombre",
    signerRole: "Tu cargo",
    rolePlaceholder: "Propietario, director o representante autorizado",
    signerEmail: "Correo",
    authority: "Estoy autorizado a aceptar estas condiciones en nombre de esta empresa.",
    acceptFailed: "No se ha podido registrar la aceptación.",
    saved: "Guardado.",
  },
};

export const partnerLegalRu = {
  ...partnerLegalEn,
  customerRules: {
    title: "Правила аренды для клиента",
    subtitle:
      "Напишите правила аренды, которые клиенты {{company}} должны принять при бронировании. Источник — английский. При сохранении текст переводится на все языки сайта, чтобы в заказе открывались и договор Rovaro, и ваш.",
    englishLabel: "Правила аренды (английский)",
    englishHint:
      "Депозит, топливо, пробег, дополнительный водитель, выезд за границу, курение, животные, поздний возврат. Простой текст, до {{max}} символов.",
    save: "Сохранить и перевести",
    saving: "Перевод…",
    unsaved: "Есть несохранённые изменения",
    saved: "Сохранено и переведено на языки сайта.",
    savedPartial:
      "Сохранено. Часть языков не перевелась — смотрите предупреждение и сохраните ещё раз.",
    savedWithoutTranslate:
      "Английский сохранён. Добавьте GOOGLE_TRANSLATE_API_KEY (или включите Cloud Translation на ключе Maps), чтобы заполнить остальные языки.",
    cleared: "Правила аренды удалены.",
    loadFailed: "Не удалось загрузить правила аренды.",
    saveFailed: "Не удалось сохранить правила аренды.",
    translateMissingTitle: "API перевода не настроен",
    translateMissingBody:
      "Клиенты увидят английский текст, пока Cloud Translation не включён. Форма бронирования работает.",
    translationsTitle: "Переводы",
    translationsBody: "Сделано для: {{languages}}",
    failedTitle: "Языки, которые не перевелись",
  },
  review: {
    title: "Проверить этого партнёра",
    body: "Проверьте анкету и загруженные документы, затем поставьте VERIFIED или REJECTED. Это очередь проверки документов — публикация договоров платформы на соседней вкладке Юридическое.",
    verify: "Поставить VERIFIED",
    reject: "Поставить REJECTED",
    suspend: "Приостановить",
    reopenDraft: "Вернуть в черновик",
    reason: "Причина",
    reasonRequired: "Укажите причину при отклонении или приостановке.",
    failed: "Не удалось обновить проверку.",
    done: "Проверка обновлена.",
    noProfile: "Этот партнёр ещё не отправил юридический профиль.",
    draftTitle: "Статус: черновик",
    draftBody:
      "Партнёр загрузил документы, но не отправил профиль на проверку.",
    moveToReview: "Отправить на проверку",
    moveToReviewTitle: "Отправить на проверку",
    moveToReviewBody:
      "Профиль попадёт в очередь. Это не подтверждает партнёра.",
    moveToReviewConfirm: "Отправить на проверку",
    moveToReviewCancel: "Отмена",
    approve: "Подтвердить",
    requestChanges: "Отклонить / запросить правки",
    pendingTitle: "Проверить этого партнёра",
    pendingBody:
      "Откройте документы и подтвердите или запросите правки. Подтверждение само по себе не даёт право работать.",
    verifiedTitle: "Партнёр подтверждён",
    verifiedBody:
      "Профиль уже подтверждён. Его можно приостановить. Повторного подтверждения нет.",
  },
};

export const partnerLegalUk = {
  ...partnerLegalEn,
  review: {
    title: "Перевірити цього партнера",
    body: "Перевірте анкету і завантажені документи, потім поставте VERIFIED або REJECTED. Публікація договорів платформи — інша сторінка: Юридичне у верхньому меню.",
    verify: "Поставити VERIFIED",
    reject: "Поставити REJECTED",
    suspend: "Призупинити",
    reopenDraft: "Повернути в чернетку",
    reason: "Причина",
    reasonRequired: "Вкажіть причину при відхиленні або призупиненні.",
    failed: "Не вдалося оновити перевірку.",
    done: "Перевірку оновлено.",
    noProfile: "Цей партнер ще не надіслав юридичний профіль.",
    draftTitle: "Статус: чернетка",
    draftBody:
      "Партнер завантажив документи, але не надіслав профіль на перевірку.",
    moveToReview: "Передати на перевірку",
    moveToReviewTitle: "Передати на перевірку",
    moveToReviewBody:
      "Профіль потрапить у чергу. Це не підтверджує партнера.",
    moveToReviewConfirm: "Передати на перевірку",
    moveToReviewCancel: "Скасувати",
    approve: "Підтвердити",
    requestChanges: "Відхилити / запитати зміни",
    pendingTitle: "Перевірити цього партнера",
    pendingBody:
      "Відкрийте документи і підтвердьте або запитайте зміни. Підтвердження саме по собі не дає права працювати.",
    verifiedTitle: "Партнера підтверджено",
    verifiedBody:
      "Профіль уже підтверджено. Його можна призупинити. Повторного підтвердження немає.",
  },
};

export const partnerLegalEl = {
  ...partnerLegalEn,
  review: {
    title: "Επαλήθευση αυτού του συνεργάτη",
    body: "Ελέγξτε τη φόρμα και τα ανεβασμένα έγγραφα και ορίστε VERIFIED ή REJECTED. Η δημοσίευση των συμβολαίων της πλατφόρμας είναι άλλη σελίδα: Νομικά στην επάνω γραμμή.",
    verify: "Ορισμός VERIFIED",
    reject: "Ορισμός REJECTED",
    suspend: "Αναστολή",
    reopenDraft: "Επιστροφή σε πρόχειρο",
    reason: "Αιτία",
    reasonRequired: "Δώστε αιτία όταν απορρίπτετε ή αναστέλλετε.",
    failed: "Δεν ήταν δυνατή η ενημέρωση της επαλήθευσης.",
    done: "Η επαλήθευση ενημερώθηκε.",
    noProfile: "Αυτός ο συνεργάτης δεν έχει υποβάλει ακόμη νομικό προφίλ.",
    draftTitle: "Κατάσταση: πρόχειρο",
    draftBody:
      "Ο συνεργάτης ανέβασε έγγραφα, αλλά δεν υπέβαλε το προφίλ για έλεγχο.",
    moveToReview: "Μεταφορά σε έλεγχο",
    moveToReviewTitle: "Μεταφορά σε έλεγχο",
    moveToReviewBody:
      "Το προφίλ μπαίνει στην ουρά. Αυτό δεν εγκρίνει τον συνεργάτη.",
    moveToReviewConfirm: "Μεταφορά σε έλεγχο",
    moveToReviewCancel: "Ακύρωση",
    approve: "Έγκριση",
    requestChanges: "Απόρριψη / αίτημα αλλαγών",
    pendingTitle: "Έλεγχος αυτού του συνεργάτη",
    pendingBody:
      "Ανοίξτε τα έγγραφα και εγκρίνετε ή ζητήστε αλλαγές. Η έγκριση από μόνη της δεν επιτρέπει λειτουργία.",
    verifiedTitle: "Επαληθευμένος συνεργάτης",
    verifiedBody:
      "Το προφίλ είναι ήδη επαληθευμένο. Μπορείτε να το αναστείλετε. Δεν εγκρίνεται ξανά.",
  },
};

export const partnerLegalDe = {
  ...partnerLegalEn,
  review: {
    title: "Diesen Partner prüfen",
    body: "Prüfen Sie Formular und hochgeladene Unterlagen und setzen Sie VERIFIED oder REJECTED. Das Veröffentlichen der Plattformverträge ist eine andere Seite: Rechtliches in der oberen Leiste.",
    verify: "VERIFIED setzen",
    reject: "REJECTED setzen",
    suspend: "Sperren",
    reopenDraft: "Zurück auf Entwurf",
    reason: "Grund",
    reasonRequired: "Bitte einen Grund angeben beim Ablehnen oder Sperren.",
    failed: "Prüfung konnte nicht aktualisiert werden.",
    done: "Prüfung aktualisiert.",
    noProfile: "Dieser Partner hat noch kein Rechtsprofil eingereicht.",
    draftTitle: "Status: Entwurf",
    draftBody:
      "Der Partner hat Dokumente hochgeladen, das Profil aber nicht zur Prüfung eingereicht.",
    moveToReview: "In die Prüfung nehmen",
    moveToReviewTitle: "In die Prüfung nehmen",
    moveToReviewBody:
      "Das Profil kommt in die Warteschlange. Der Partner wird dadurch nicht freigegeben.",
    moveToReviewConfirm: "In die Prüfung nehmen",
    moveToReviewCancel: "Abbrechen",
    approve: "Freigeben",
    requestChanges: "Ablehnen / Änderungen verlangen",
    pendingTitle: "Diesen Partner prüfen",
    pendingBody:
      "Öffnen Sie die Unterlagen und geben Sie frei oder verlangen Sie Änderungen. Die Freigabe allein erlaubt den Betrieb nicht.",
    verifiedTitle: "Verifizierter Partner",
    verifiedBody:
      "Dieses Profil ist bereits verifiziert. Sie können es sperren. Eine erneute Freigabe gibt es nicht.",
  },
};

export function withPartnerLegal(base, copy, navLabel) {
  return {
    ...base,
    header: { ...(base.header || {}), legalProfile: navLabel },
    partnerLegal: copy,
  };
}
