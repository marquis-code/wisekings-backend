import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GiftingController } from './gifting.controller';
import { GiftingService } from './gifting.service';
import { Gifting, GiftingSchema } from './schema/gifting.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Gifting.name, schema: GiftingSchema }]),
    MailModule // For sending emails
  ],
  controllers: [GiftingController],
  providers: [GiftingService],
  exports: [GiftingService]
})
export class GiftingModule {}
