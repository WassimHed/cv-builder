export enum MailTemplate {
  PASSWORD_RESET = 'password-reset',
  EMAIL_VERIFICATION = 'email-verification',
}

export interface SendEmailJobDto {
  to: string;
  subject: string;
  template: MailTemplate;
  context: Record<string, string | number>;
}
