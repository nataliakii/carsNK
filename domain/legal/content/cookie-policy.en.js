/**
 * Rovaro Cookie Policy — English (authoritative legal version).
 * Requires professional legal review before production publication.
 */

const doc = {
  documentType: "cookie-policy",
  language: "en",
  jurisdiction: "EU",
  version: 1,
  effectiveFrom: null,
  content: {
    title: "Rovaro Cookie Policy",
    sections: [
      {
        id: "1",
        heading: "About this Cookie Policy",
        body: "{{operator.platformSentence}}\n\nThis Cookie Policy explains how {{operator.platformBrand}} uses cookies and similar technologies on {{operator.primaryDomain}} and {{operator.spanishDomain}}, what each category is for, and how you can control them.\n\nThe operator responsible for these technologies is {{operator.description}}, trading as {{operator.tradingName}}. You can contact us about anything in this Policy at {{operator.legalEmail}}.",
      },
      {
        id: "1.1",
        heading: "Operator business address",
        body: "The business address of the operator is {{operator.businessAddress}}.\n\nWritten requests about cookies and consent may be sent to that address, although email to {{operator.legalEmail}} is the fastest route.",
        requires: ["businessAddress"],
      },
      {
        id: "2",
        heading: "What cookies and similar technologies are",
        body: "A cookie is a small text file that a website asks your browser to store on your device. When you return, the browser sends the file back, which lets the site recognise the session and remember certain choices.\n\nSimilar technologies achieve comparable results by other means. Local storage and session storage keep small amounts of information in the browser itself. Pixels and scripts loaded by a page can record that a page was viewed. Throughout this Policy the word cookies covers all of these.\n\nCookies set by us under our own domain are first-party. Cookies set by another organisation whose service is loaded on our pages are third-party.",
      },
      {
        id: "3",
        heading: "Strictly necessary cookies",
        body: "These cookies are required for the platform to work and are set without consent, because the service you asked for cannot be provided without them.\n\nThey are used to maintain your session while you move between pages, to keep you signed in to an account or to the partner area, to protect forms and requests against cross-site request forgery, to enforce security and rate limits, and to distribute traffic correctly across our servers.\n\nThe session cookie used by our authentication layer, NextAuth, belongs to this category. If you block strictly necessary cookies in your browser, signing in, submitting a booking request and paying will not work.",
      },
      {
        id: "4",
        heading: "Functional cookies and local storage",
        body: "Functional technologies remember choices you have made so that the platform behaves the way you expect.\n\nWe use browser storage to remember your language selection, so the site opens in the same language next time, and to keep the state of the booking form, so that the dates, locations and options you entered are not lost if you navigate away or reload the page. We also store your cookie consent choice so that the banner is not shown to you repeatedly.\n\nThese are stored locally in your browser. Clearing your browser storage removes them, and the platform then falls back to its defaults.",
      },
      {
        id: "5",
        heading: "Analytics cookies",
        body: "We use Google Analytics to understand how the platform is used in aggregate: which pages are visited, how users move through the booking flow, and where problems occur.\n\nGoogle Analytics sets cookies in the _ga family to distinguish one browser from another across visits. We do not use analytics to identify you personally, and we do not combine analytics data with your booking records to build a profile of you.\n\nAnalytics cookies are set only if you consent through the cookie banner. If you refuse or ignore the banner, they are not set, and the platform works normally without them.",
      },
      {
        id: "6",
        heading: "No advertising or profiling cookies by default",
        body: "We do not set advertising, retargeting or behavioural profiling cookies, and we do not sell or share cookie-derived data for the advertising purposes of third parties.\n\nIf we ever introduce such technologies, they will be presented as a separate category in the cookie banner, they will be switched off unless you actively consent, and this Policy will be updated before they are used.\n\nThe absence of advertising cookies does not affect your ability to use any part of the platform.",
      },
      {
        id: "7",
        heading: "Consent: how we ask for it",
        body: "When you first visit the platform, a cookie banner explains the categories in use and lets you accept or refuse the non-essential ones. Strictly necessary cookies are listed for transparency but are not subject to consent.\n\nRefusing is as easy as accepting: the banner offers a clear option to reject non-essential cookies, and closing the banner without accepting does not amount to consent. Non-essential cookies are not set before you have made your choice.\n\nWe record your choice so that we can honour it and demonstrate that it was given, and we ask again if the categories change materially.",
      },
      {
        id: "8",
        heading: "How to manage or withdraw consent",
        body: "You can change your mind at any time. Open the cookie settings from the link in the site footer, adjust the categories and save. The new choice applies immediately, and cookies from a category you have switched off are no longer set.\n\nWithdrawing consent does not affect the lawfulness of processing carried out while the consent was valid, and it does not delete data that was already collected. If you want previously collected analytics data deleted, contact us at {{operator.legalEmail}}.\n\nCookies already stored on your device can be removed through your browser at any time.",
      },
      {
        id: "9",
        heading: "Browser-level controls",
        body: "Every major browser lets you view, block and delete cookies, and offers a private browsing mode that discards them at the end of the session. The controls are usually found under privacy or site settings, and the help pages of your browser explain the exact steps for your version.\n\nBlocking all cookies, including strictly necessary ones, will break sign-in, the booking form and payment. Deleting cookies also deletes your stored cookie choice, so the banner appears again on your next visit.\n\nSome browsers send a general do-not-track or global privacy signal. Where we are able to recognise such a signal, we treat it as a refusal of non-essential cookies.",
      },
      {
        id: "10",
        heading: "How long cookies last",
        body: "Cookies are either session or persistent. Session cookies exist only while your browser session lasts and are discarded when you close the browser; they are what keeps a sign-in or a form submission coherent from one page to the next. Persistent cookies remain on your device until they expire or until you delete them, and they are what lets the site remember a preference between visits.\n\nAs a general guide, authentication and security cookies are session-based or short-lived; preference and consent items persist until changed or cleared; analytics identifiers persist across visits so that repeat use can be measured.\n\nWe do not publish exact durations for third-party cookies here, because they are set by the third party and can be changed by it without notice. Current durations can always be inspected in your browser and in the documentation of the provider concerned.",
      },
      {
        id: "11",
        heading: "Third parties whose technologies we use",
        body: "The following organisations may set or read cookies and similar identifiers when their services are loaded on our pages:\n\n- Google Analytics, for aggregated usage measurement, loaded only after you consent;\n- Stripe, for payment processing and payment fraud prevention, loaded on checkout and payment pages;\n- Cloudinary, for the delivery of vehicle images;\n- Google Maps, for address lookup and suggestions when you enter a pickup or delivery location.\n\nEach of these organisations processes the data it receives in accordance with its own privacy documentation. Stripe, Cloudinary and Google Maps are used where they are necessary to provide a function you have requested, such as paying or entering an address.",
      },
      {
        id: "12",
        heading: "International transfers",
        body: "Some of the providers named above are established outside the European Economic Area or process data outside it, including in the United States.\n\nWhere cookie-related data is transferred outside the EEA, we rely on a lawful transfer mechanism: an adequacy decision of the European Commission where one applies, or otherwise the European Commission standard contractual clauses together with appropriate additional safeguards.\n\nYou may ask us at {{operator.legalEmail}} which mechanism applies to a particular provider.",
      },
      {
        id: "13",
        heading: "Changes to this Policy",
        body: "We update this Policy when we add or remove a technology, when a provider changes, or when the law or the guidance of the supervisory authorities changes.\n\nThe current version is always available on the platform and the effective date is shown on the published page. If a change introduces a new non-essential category, we will ask for your consent again before that category is used.",
      },
      {
        id: "14",
        heading: "Relationship with the Privacy Policy",
        body: "This Cookie Policy describes the technologies themselves. The Rovaro Privacy Policy describes the wider picture: the personal data we process, the legal bases, the recipients, the retention periods and your rights under the General Data Protection Regulation.\n\nThe two documents are intended to be read together. Where cookie data constitutes personal data, the rights and procedures set out in the Privacy Policy apply to it, including the right to object and the right of access.\n\nThe Privacy Policy is published on the platform alongside this Policy.",
      },
      {
        id: "15",
        heading: "Contact and version",
        body: "For any question about cookies, consent or this Policy, write to {{operator.legalEmail}}.\n\nThe operator is {{operator.description}}, operating the {{operator.platformBrand}} platform at {{operator.primaryDomain}} and {{operator.spanishDomain}}.\n\nThis is version 1 of the Rovaro Cookie Policy. Its effective date is shown on the published page on the platform.",
      },
      {
        id: "16",
        heading: "Legal review status",
        body: "This text has been prepared as a working draft for the Rovaro platform. It requires professional legal review by a qualified lawyer in Ireland and by a qualified lawyer in Spain before it is published in production.\n\nUntil that review has been completed and the document has been approved, this text must not be relied upon as final legal advice or as a definitive description of the technologies in use.",
      },
    ],
  },
};

export default doc;
