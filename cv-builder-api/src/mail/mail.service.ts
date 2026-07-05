import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SendEmailJobDto } from './dto/send-email-job.dto';
import { MAIL_QUEUE } from './constants/mail.constants';

@Injectable()
export class MailService {
  constructor(@InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue) {}

  async queueEmail(job: SendEmailJobDto): Promise<void> {
    await this.mailQueue.add('send-email', job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
