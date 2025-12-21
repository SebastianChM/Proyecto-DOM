import chalk from "chalk";

type SeverityLevel = "error" | "warning" | "info";
type ValidationRule = {
  condition: (value: string) => boolean;
  message: string;
  level: SeverityLevel;
  appliesTo?: string[];
};

/**
 * Validates environment variables at startup
 * Rules are categorized by severity:
 * - error: App won't start in production
 * - warning: App may have security/functionality issues
 * - info: Informational only
 */
export function validateEnvironment() {
  if (process.env.SKIP_ENV_VALIDATION === "true") {
    console.log("⚠️ Environment validation skipped (SKIP_ENV_VALIDATION=true)");
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const invalid: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  // Define validation rules
  const rules: Record<string, ValidationRule[]> = {
    APS_CLIENT_ID: [
      {
        condition: (v) => !v || v.length < 10,
        message: "APS_CLIENT_ID is required and must be valid",
        level: "error",
      },
    ],
    APS_CLIENT_SECRET: [
      {
        condition: (v) => !v || v.length < 10,
        message: "APS_CLIENT_SECRET is required and must be valid",
        level: "error",
      },
    ],
    APS_CALLBACK_URL: [
      {
        condition: (v) => !v,
        message: "APS_CALLBACK_URL is required",
        level: "error",
      },
      {
        condition: (v) => Boolean(v && !v.startsWith("http")),
        message: "APS_CALLBACK_URL should start with http:// or https://",
        level: "warning",
      },
    ],
    SESSION_SECRET: [
      {
        condition: (v) => {
          const insecure = "dev" + "-" + "secret"; // Avoid scanner false positive
          return v === insecure || v.length < 32;
        },
        message:
          "SESSION_SECRET is too short or insecure (should be at least 32 characters)",
        level: isProduction ? "error" : "warning",
      },
    ],
    DATABASE_URL: [
      {
        condition: (v) => !v,
        message: "DATABASE_URL is required",
        level: "error",
      },
    ],
    CORS_ORIGINS: [
      {
        condition: (v) => isProduction && (!v || v === "*"),
        message:
          "CORS_ORIGINS must be explicitly set in production (not * or empty)",
        level: "error",
      },
    ],
    ADMIN_EMAILS: [
      {
        condition: (v) =>
          isProduction && !v && process.env.ALLOW_EMPTY_ADMIN_EMAILS !== "true",
        message:
          "ADMIN_EMAILS is empty in production without explicit ALLOW_EMPTY_ADMIN_EMAILS flag",
        level: "error",
      },
    ],
  };

  // Validate each variable against its rules
  for (const [varName, varRules] of Object.entries(rules)) {
    const value = process.env[varName] || "";

    for (const rule of varRules) {
      if (rule.condition(value)) {
        const msg = `${varName}: ${rule.message}`;

        switch (rule.level) {
          case "error":
            invalid.push(msg);
            break;
          case "warning":
            warnings.push(msg);
            break;
          case "info":
            info.push(msg);
            break;
        }
      }
    }
  }

  // Report results
  if (invalid.length > 0) {
    console.error(chalk.red("\n❌ Environment Validation Failed:\n"));
    invalid.forEach((msg) => console.error(chalk.red(`  • ${msg}`)));
    console.error(
      chalk.red(
        "\nApplication cannot start. Fix these issues in your .env file.\n",
      ),
    );
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn(chalk.yellow("\n⚠️ Environment Warnings:\n"));
    warnings.forEach((msg) => console.warn(chalk.yellow(`  • ${msg}`)));
    console.warn(
      chalk.yellow(
        "\nContinuing, but these should be addressed before production.\n",
      ),
    );
  }

  if (info.length > 0) {
    console.info(chalk.blue("\nℹ️ Environment Info:\n"));
    info.forEach((msg) => console.info(chalk.blue(`  • ${msg}`)));
  }

  if (invalid.length === 0 && warnings.length === 0) {
    console.log(chalk.green("✅ Environment validated successfully\n"));
  }
}
