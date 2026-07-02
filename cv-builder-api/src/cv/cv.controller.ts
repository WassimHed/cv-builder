import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CvService } from './cv.service';
import { CreateCvDto } from './dto/create-cv.dto';
import { UpdateCvDto } from './dto/update-cv.dto';
import { CreateSectionDto } from './dto/create-section.dto';

import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

@ApiTags('cv')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cv')
export class CvController {
  constructor(private readonly cvService: CvService) {}

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateCvDto) {
    return this.cvService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: { userId: string }) {
    return this.cvService.findAllByUser(user.userId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.cvService.findOne(id, user.userId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateCvDto,
  ) {
    return this.cvService.update(id, user.userId, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.cvService.remove(id, user.userId);
  }

  @Post(':id/sections')
  addSection(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: CreateSectionDto,
  ) {
    return this.cvService.addSection(id, user.userId, dto);
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
    return this.cvService.uploadPdf(id, user.userId, file.buffer);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.cvService.downloadPdf(
      id,
      user.userId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }
}
