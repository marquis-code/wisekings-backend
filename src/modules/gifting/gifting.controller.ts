import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { GiftingService } from './gifting.service';
import { CreateGiftingDto } from './dto/create-gifting.dto';
import { UpdateGiftingDto } from './dto/update-gifting.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('gifting')
export class GiftingController {
  constructor(private readonly giftingService: GiftingService) {}

  @Public()
  @Post()
  create(@Body() createGiftingDto: CreateGiftingDto) {
    return this.giftingService.create(createGiftingDto);
  }

  @Get()
  findAll() {
    return this.giftingService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.giftingService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGiftingDto: UpdateGiftingDto) {
    return this.giftingService.update(id, updateGiftingDto);
  }
}
