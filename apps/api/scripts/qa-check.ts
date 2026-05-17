import { redis } from "../src/lib/redis";
import { env } from "../src/config/env";

async function main() {
  // List all session keys
  const keys = await redis.keys("dom:sess:*");
  console.log("SESSION_COUNT:", keys.length);

  for (const key of keys.slice(-3)) {
    const val = await redis.get(key);
    if (val) {
      const data = JSON.parse(val);
      console.log("KEY:", key);
      console.log("HAS_USER:", !!data.user);
      console.log("HAS_TOKEN:", !!data.token);
      console.log("TOKEN_VAL:", data.token || "MISSING");
      console.log("EXPIRES_AT:", data.expiresAt || "MISSING");
      console.log("---");
    }
  }

  // Also sign a test cookie with the exact same method as cookie-signature
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cookieSig = require("cookie-signature");
  if (keys.length > 0) {
    const lastKey = keys[keys.length - 1];
    const sessionId = lastKey.replace("dom:sess:", "");
    const signed = cookieSig.sign("s:" + sessionId, env.SESSION_SECRET);
    const encoded = encodeURIComponent(signed);
    console.log("VALID_COOKIE=dom-session=" + encoded);
  }

  await redis.quit();
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
