import { redactMeta, maskEmail, truncateId } from "../../src/lib/redact";

describe("maskEmail", () => {
  it("masks a normal email", () => {
    expect(maskEmail("sebastian@dom.com")).toBe("se***@dom.com");
  });

  it("masks a short-prefix email", () => {
    expect(maskEmail("a@dom.com")).toBe("a***@dom.com");
  });

  it("returns [REDACTED] for invalid email (no @)", () => {
    expect(maskEmail("not-an-email")).toBe("[REDACTED]");
  });

  it("returns [REDACTED] when @ is the first char", () => {
    expect(maskEmail("@domain.com")).toBe("[REDACTED]");
  });
});

describe("truncateId", () => {
  it("truncates a UUID to 8 chars + ellipsis", () => {
    expect(truncateId("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400…",
    );
  });

  it("returns short IDs unchanged", () => {
    expect(truncateId("abc")).toBe("abc");
  });

  it("respects custom length", () => {
    expect(truncateId("abcdef1234567890", 4)).toBe("abcd…");
  });
});

describe("redactMeta", () => {
  it("redacts sensitive keys (authorization, cookie, token, password, secret)", () => {
    const meta = {
      authorization: "Bearer abc123",
      cookie: "session=xyz",
      token: "t0k3n",
      password: "hunter2",
      secret: "s3cr3t",
      safe: "hello",
    };
    const result = redactMeta(meta);
    expect(result.authorization).toBe("[REDACTED]");
    expect(result.cookie).toBe("[REDACTED]");
    expect(result.token).toBe("[REDACTED]");
    expect(result.password).toBe("[REDACTED]");
    expect(result.secret).toBe("[REDACTED]");
    expect(result.safe).toBe("hello");
  });

  it("redacts case-insensitively (Authorization, ACCESS_TOKEN)", () => {
    const meta = { Authorization: "Bearer x", access_token: "tok" };
    const result = redactMeta(meta);
    expect(result.Authorization).toBe("[REDACTED]");
    expect(result.access_token).toBe("[REDACTED]");
  });

  it("masks email PII keys", () => {
    const meta = { email: "ana@company.com", userEmail: "bob@company.com" };
    const result = redactMeta(meta);
    expect(result.email).toBe("an***@company.com");
    expect(result.userEmail).toBe("bo***@company.com");
  });

  it("truncates userId/user/owner PII keys", () => {
    const meta = {
      userId: "550e8400-e29b-41d4-a716-446655440000",
      owner: "abcdef1234567890",
    };
    const result = redactMeta(meta);
    expect(result.userId).toBe("550e8400…");
    expect(result.owner).toBe("abcdef12…");
  });

  it("recurses into headers/session/auth/details/data/meta", () => {
    const meta = {
      headers: { authorization: "Bearer secret", "x-custom": "ok" },
      session: { token: "tok123", name: "test" },
      details: { password: "pw", info: "safe" },
    };
    const result = redactMeta(meta);
    const h = result.headers as Record<string, unknown>;
    const s = result.session as Record<string, unknown>;
    const d = result.details as Record<string, unknown>;
    expect(h.authorization).toBe("[REDACTED]");
    expect(h["x-custom"]).toBe("ok");
    expect(s.token).toBe("[REDACTED]");
    expect(s.name).toBe("test");
    expect(d.password).toBe("[REDACTED]");
    expect(d.info).toBe("safe");
  });

  it("does NOT mutate the original object", () => {
    const meta = { authorization: "Bearer abc", email: "x@y.com" };
    const copy = { ...meta };
    redactMeta(meta);
    expect(meta.authorization).toBe(copy.authorization);
    expect(meta.email).toBe(copy.email);
  });

  it("respects depth limit (stops recursing at depth 3)", () => {
    // Build 4 levels of nesting via recurse keys
    const deep = {
      headers: {
        data: {
          meta: {
            session: { token: "should-be-kept-because-depth-exceeded" },
          },
        },
      },
    };
    const result = redactMeta(deep);
    // depth 0->headers, 1->data, 2->meta => depth 3 reached
    // "session" at depth 3 should NOT recurse further; it's an object, treated as pass-through
    const level3 = (
      (result.headers as Record<string, unknown>).data as Record<
        string,
        unknown
      >
    ).meta as Record<string, unknown>;
    // At depth 3, RECURSE_KEYS should not recurse deeper.
    // The "session" key value is an object but won't be recursed.
    expect(level3.session).toEqual({
      token: "should-be-kept-because-depth-exceeded",
    });
  });

  it("passes through non-sensitive keys unchanged", () => {
    const meta = { status: 200, method: "GET", path: "/api/test" };
    expect(redactMeta(meta)).toEqual(meta);
  });

  it("handles empty object", () => {
    expect(redactMeta({})).toEqual({});
  });
});
