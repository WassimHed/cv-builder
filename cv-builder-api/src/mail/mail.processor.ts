import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import mjml2html from 'mjml';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SendEmailJobDto } from './dto/send-email-job.dto';
import { MAIL_QUEUE } from './constants/mail.constants';

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    super();

    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('SMTP_HOST'),
      port: this.configService.getOrThrow<number>('SMTP_PORT'),
      secure: false,
      auth: this.resolveAuth(),
    });
  }

  private resolveAuth() {
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    return user && pass ? { user, pass } : undefined;
  }

  async process(job: Job<SendEmailJobDto>): Promise<void> {
    const { to, subject, template, context } = job.data;

    const templatePath = join(__dirname, 'templates', `${template}.mjml`);
    const rawMjml = readFileSync(templatePath, 'utf-8');
    const interpolated = this.interpolate(rawMjml, context);
    const { html, errors } = await mjml2html(interpolated);

    if (errors?.length) {
      this.logger.warn(
        `MJML compile warnings for ${template}: ${JSON.stringify(errors)}`,
      );
    }

    await this.transporter.sendMail({
      from: this.configService.getOrThrow<string>('SMTP_FROM'),
      to,
      subject,
      html,
    });

    this.logger.log(`Email sent to ${to} using template "${template}"`);
  }

  private interpolate(
    template: string,
    context: Record<string, string | number>,
  ): string {
    return template.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) =>
      context[key] !== undefined ? String(context[key]) : '',
    );
  }
}
