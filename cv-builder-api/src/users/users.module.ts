import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Profile } from './entities/profile.entity';
import { ProfilesService } from './profiles.service';
import { AvatarsService } from './avatars.service';
import { UsersController } from './users.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Profile]), StorageModule],
  controllers: [UsersController],
  providers: [UsersService, ProfilesService, AvatarsService],
  exports: [UsersService, ProfilesService, AvatarsService],
})
export class UsersModule {}
