import nodemailer from "nodemailer";
import fs from "fs-extra";
import path from "path";
import handlebars from "handlebars";
import { logger } from "../lib/logger";

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private templatesDir: string;

  constructor() {
    this.templatesDir = path.join(__dirname, "../templates");
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // Only initialize if credentials are provided
    if (
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    ) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      logger.info("[EMAIL] SMTP configuration loaded");
    } else {
      logger.warn(
        "[EMAIL] SMTP credentials not found. Email sending disabled.",
      );
    }
  }

  public async verifyConnection(): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.verify();
      logger.info("[EMAIL] Connection verified");
      return true;
    } catch (error) {
      logger.error("[EMAIL] Verification failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async loadTemplate(
    templateName: string,
    data: unknown,
  ): Promise<string> {
    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);
      const templateSource = await fs.readFile(templatePath, "utf8");
      const template = handlebars.compile(templateSource);
      return template(data);
    } catch (error) {
      logger.error("[EMAIL] Error loading template", {
        templateName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to load email template: ${templateName}`);
    }
  }

  public async sendInvitationEmail(
    to: string,
    inviterName: string,
    projectName: string,
    role: string,
    link: string,
  ): Promise<boolean> {
    if (!this.transporter) {
      logger.debug("[EMAIL] Mocked - would send invitation", {
        to,
        inviterName,
        projectName,
      });
      return true;
    }

    try {
      const html = await this.loadTemplate("invitation", {
        inviterName,
        projectName,
        role: role.replace("_", " "),
        link,
        year: new Date().getFullYear(),
      });

      // Use env var for from address, example.com as fallback (never real domain)
      const from =
        process.env.SMTP_FROM || '"BIM Platform" <noreply@example.com>';

      await this.transporter.sendMail({
        from,
        to,
        subject: `Invitation to collaborate on ${projectName}`,
        html,
      });

      logger.info("[EMAIL] Sent successfully", { to });
      return true;
    } catch (error) {
      logger.error("[EMAIL] Failed to send invitation", {
        to,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

export const emailService = new EmailService();
