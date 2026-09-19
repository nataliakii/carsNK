/**
 * @jest-environment node
 */
import {
  sanitizeProviderErrorMessage,
  redactSecretsForLog,
} from "../sanitizeProviderError";

describe("sanitizeProviderErrorMessage", () => {
  test("strips API keys and Google key query params", () => {
    expect(
      sanitizeProviderErrorMessage(
        "REQUEST_DENIED key=AIzaSyFakeSecretValue123"
      )
    ).toBe("Distance provider unavailable");
    expect(
      redactSecretsForLog("url?key=AIzaSyFakeSecretValue123")
    ).toMatch(/\[redacted\]/);
  });
});
