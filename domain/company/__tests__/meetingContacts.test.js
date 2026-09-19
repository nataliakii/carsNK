import {
  emptyMeetingContact,
  formatMeetingContactsDisplay,
  meetingContactsFromCompany,
  meetingContactsUpdatePayload,
  resolveMeetingContactsForConfirmation,
  sanitizeMeetingContactsInput,
} from "../meetingContacts";

describe("meetingContacts", () => {
  test("sanitize skips empty rows and caps at 10", () => {
    const rows = [
      { name: "A", phone: "+1", channel: "WA" },
      { name: "", phone: "" },
      { name: "B", phone: "+2" },
    ];
    expect(sanitizeMeetingContactsInput(rows)).toEqual([
      { name: "A", phone: "+1", channel: "WA" },
      { name: "B", phone: "+2", channel: "WhatsApp" },
    ]);
  });

  test("fromCompany falls back to legacy fields", () => {
    expect(
      meetingContactsFromCompany({
        meetingContactName: "Orest",
        meetingContactPhone: "+30",
        meetingContactChannel: "WhatsApp",
      })
    ).toEqual([
      { name: "Orest", phone: "+30", channel: "WhatsApp" },
    ]);
  });

  test("update payload mirrors first contact to legacy fields", () => {
    expect(
      meetingContactsUpdatePayload([
        { name: "A", phone: "1", channel: "WA" },
        { name: "B", phone: "2", channel: "TG" },
      ])
    ).toEqual({
      meetingContacts: [
        { name: "A", phone: "1", channel: "WA" },
        { name: "B", phone: "2", channel: "TG" },
      ],
      meetingContactName: "A",
      meetingContactPhone: "1",
      meetingContactChannel: "WA",
    });
  });

  test("format joins multiple contacts", () => {
    expect(
      formatMeetingContactsDisplay([
        { name: "A", phone: "+1", channel: "WA" },
        { name: "B", phone: "+2", channel: "TG" },
      ])
    ).toBe("+1 (WA) A · +2 (TG) B");
  });

  test("resolve prefers array over legacy", () => {
    const list = resolveMeetingContactsForConfirmation(
      {
        meetingContacts: [{ name: "X", phone: "9", channel: "Viber" }],
        meetingContactName: "Legacy",
        meetingContactPhone: "0",
      },
      { name: "Env", phone: "E", channel: "WA" }
    );
    expect(list).toEqual([{ name: "X", phone: "9", channel: "Viber" }]);
  });

  test("emptyMeetingContact defaults", () => {
    expect(emptyMeetingContact()).toEqual({
      name: "",
      phone: "",
      channel: "WhatsApp",
    });
  });
});
