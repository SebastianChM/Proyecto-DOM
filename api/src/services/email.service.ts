import nodemailer from 'nodemailer';
import fs from 'fs-extra';
import path from 'path';
import handlebars from 'handlebars';

export class EmailService {
    private transporter: nodemailer.Transporter | null = null;
    private templatesDir: string;

    constructor() {
        this.templatesDir = path.join(__dirname, '../templates');
        this.initializeTransporter();
    }

    private initializeTransporter() {
        // Only initialize if credentials are provided
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
            console.log('📧 Email Service: SMTP configuration loaded.');
        } else {
            console.warn('⚠️ Email Service: SMTP credentials not found in env. Email sending will be disabled.');
        }
    }

    public async verifyConnection(): Promise<boolean> {
        if (!this.transporter) return false;
        try {
            await this.transporter.verify();
            console.log('✅ Email Service: Connection verified.');
            return true;
        } catch (error) {
            console.error('❌ Email Service: verification failed.', error);
            return false;
        }
    }

    private async loadTemplate(templateName: string, data: any): Promise<string> {
        try {
            const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);
            const templateSource = await fs.readFile(templatePath, 'utf8');
            const template = handlebars.compile(templateSource);
            return template(data);
        } catch (error) {
            console.error(`Error loading template ${templateName}:`, error);
            throw new Error(`Failed to load email template: ${templateName}`);
        }
    }

    public async sendInvitationEmail(
        to: string,
        inviterName: string,
        projectName: string,
        role: string,
        link: string
    ): Promise<boolean> {
        if (!this.transporter) {
            console.warn(`[MOCKED] Would send email to ${to} invited by ${inviterName} for project ${projectName}`);
            return true; // Pretend we sent it if not configured, to avoid breaking flow
        }

        try {
            const html = await this.loadTemplate('invitation', {
                inviterName,
                projectName,
                role: role.replace('_', ' '),
                link,
                year: new Date().getFullYear()
            });

            const from = process.env.SMTP_FROM || '"DOM BIM Platform" <noreply@dom.com>';

            await this.transporter.sendMail({
                from,
                to,
                subject: `Invitation to collaborate on ${projectName}`,
                html,
            });

            console.log(`📨 Email sent successfully to ${to}`);
            return true;
        } catch (error) {
            console.error('Failed to send invitation email:', error);
            return false;
        }
    }
}

export const emailService = new EmailService();
