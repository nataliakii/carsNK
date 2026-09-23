/**
 * @jest-environment node
 */

describe("buildMongoConnectOptions IPv4 override", () => {
  const original = process.env.MONGODB_FORCE_IPV4;

  afterEach(() => {
    if (original === undefined) delete process.env.MONGODB_FORCE_IPV4;
    else process.env.MONGODB_FORCE_IPV4 = original;
    jest.resetModules();
  });

  test("default connect options do not force family:4", async () => {
    delete process.env.MONGODB_FORCE_IPV4;
    const { buildMongoConnectOptions } = await import("../database");
    const opts = buildMongoConnectOptions();
    expect(opts.family).toBeUndefined();
    expect(opts.dbName).toBe("Car");
  });

  test("MONGODB_FORCE_IPV4=true sets family:4", async () => {
    process.env.MONGODB_FORCE_IPV4 = "true";
    const { buildMongoConnectOptions } = await import("../database");
    expect(buildMongoConnectOptions().family).toBe(4);
  });
});
