import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CvService } from './cv.service';
import { CreateCvDto } from './dto/create-cv.dto';
import { UpdateCvDto } from './dto/update-cv.dto';
import { CreateSectionDto } from './dto/create-section.dto';

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
}
