/**
 * sendEmail - contact-form helper. Posts to /api/contact (fixed recipient).
 * Does not hit /api/sendEmail and cannot set to/cc.
 *
 * @param {object} formData
 * @param {string} [formData.email]
 * @param {string} [formData.name]
 * @param {string} [formData.title] - used as subject
 * @param {string} [formData.subject]
 * @param {string} formData.message
 * @returns {Promise<object>}
 */
const sendEmail = async (formData) => {
  try {
    if (!formData?.message) {
      throw new Error("Email message is required");
    }

    const response = await fetch("/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: formData.name || "",
        email: formData.email || "",
        subject: formData.subject || formData.title || "",
        message: formData.message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          errorData.error ||
          `Failed to send email: ${response.statusText}`
      );
    }

    const result = await response.json();
    return {
      status: 200,
      messageId: result.messageId,
      accepted: result.accepted,
    };
  } catch (error) {
    console.error("Failed to send email", error);
    throw error;
  }
};

export default sendEmail;
