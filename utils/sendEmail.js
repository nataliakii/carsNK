/**
 * sendEmail - отправка имейлов через API роут
 * Использует nodemailer на сервере вместо EmailJS
 * 
 * @param {object} formData - данные для отправки
 * @param {string} formData.email - email клиента (опционально)
 * @param {string} formData.title - тема письма
 * @param {string} formData.message - текст письма
 * @param {string} companyEmail - email компании (обязательно)
 * @param {boolean} isUsingCompanyEmail - использовать ли email компании (deprecated, всегда true)
 * @returns {Promise<object>} - результат отправки
 */
const sendEmail = async (
  formData,
  companyEmail,
  isUsingCompanyEmail = true
) => {
  try {
    // Валидация обязательных полей
    if (!companyEmail) {
      throw new Error("Company email is required");
    }
    if (!formData.title) {
      throw new Error("Email title is required");
    }
    if (!formData.message) {
      throw new Error("Email message is required");
    }

    // Подготовка данных для API
    const emailData = {
      email: formData.email || "", // Email клиента (опционально)
      emailCompany: companyEmail, // Email компании (обязательно)
      title: formData.title,
      message: formData.message,
    };

    // Отправка через API роут
    const response = await fetch("/api/sendEmail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Failed to send email: ${response.statusText}`
      );
    }

    const result = await response.json();
    console.log("Email sent successfully!", result);

    // Возвращаем объект в формате, совместимом со старым API
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
