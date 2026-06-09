import { redis } from "../src/lib/redis";
import { env } from "../src/config/env";
import crypto from "crypto";
import { createHmac } from "crypto";

function signSession(sessionId: string, secret: string): string {
  // cookie-signature package signs "s:<id>" not just "<id>"
  const val = `s:${sessionId}`;
  const signed = createHmac("sha256", secret)
    .update(val)
    .digest("base64")
    .replace(/=+$/, "");
  return `${val}.${signed}`;
}

async function main() {
  const sessionId = crypto.randomUUID();
  const key = "dom-bim:sess:" + sessionId;
  const data = JSON.stringify({
    cookie: {
      originalMaxAge: 86400000,
      expires: new Date(Date.now() + 86400000),
      httpOnly: true,
      path: "/",
    },
    // /api/auth/me checks req.session?.token — must be present
    token: "qa-mock-aps-token",
    refreshToken: "qa-mock-refresh-token",
    // Set expiresAt far in the future so sessionRefresh middleware won't try to refresh
    expiresAt: Date.now() + 3600000,
    user: {
      id: "2f467308-c529-4603-af16-222d72441b5b",
      email: "chirinosebastianmn@gmail.com",
      role: "ADMIN",
      displayName: "Sebastian QA",
      apsUserId: "qa-user",
    },
  });

  await redis.set(key, data, "EX", 86400);

  const signedCookie = signSession(sessionId, env.SESSION_SECRET);
  const encoded = encodeURIComponent(signedCookie);

  console.log("COOKIE=dom-bim-session=" + encoded);

  await redis.quit();
}

main();
