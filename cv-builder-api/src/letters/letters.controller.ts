import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LettersService } from './letters.service';
import { CreateMotivationLetterDto } from './dto/create-motivation-letter.dto';
import { UpdateMotivationLetterDto } from './dto/update-motivation-letter.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PdfService } from '../pdf/pdf.service';

import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('letters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('letters')
export class LettersController {
  constructor(
    private readonly lettersService: LettersService,
    private readonly pdfService: PdfService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateMotivationLetterDto,
  ) {
    return this.lettersService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: { userId: string }) {
    return this.lettersService.findAllByUser(user.userId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.lettersService.findOne(id, user.userId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateMotivationLetterDto,
  ) {
    return this.lettersService.update(id, user.userId, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.lettersService.remove(id, user.userId);
  }

  @Post(':id/pdf')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadPdf(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are accepted');
    }
    return this.lettersService.uploadPdf(id, user.userId, file.buffer);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.lettersService.downloadPdf(
      id,
      user.userId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Post(':id/pdf/generate')
  @UseGuards(JwtAuthGuard)
  async generatePdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.pdfService.enqueueLetterGeneration(id, user.userId);
    return { status: 'queued' };
  }

  @Get(':id/pdf/status')
  @UseGuards(JwtAuthGuard)
  async getPdfStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { status: await this.pdfService.getLetterStatus(id, user.userId) };
  }
}
