import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ProductionService } from './production.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('production')
@UseGuards(AuthGuard('jwt'))
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Post('materials')
  createMaterial(@Body() dto: any) {
    return this.productionService.createMaterial(dto);
  }

  @Get('materials')
  findAllMaterials() {
    return this.productionService.findAllMaterials();
  }

  @Patch('materials/:id')
  updateMaterial(@Param('id') id: string, @Body() dto: any) {
    return this.productionService.updateMaterial(id, dto);
  }

  @Post('batches')
  createBatch(@Body() dto: any) {
    return this.productionService.createBatch(dto);
  }

  @Get('batches')
  findAllBatches(@Query() filters: any) {
    return this.productionService.findAllBatches(filters);
  }

  @Get('batches/:id')
  getBatchById(@Param('id') id: string) {
    return this.productionService.getBatchById(id);
  }

  // Purchase Orders
  @Post('orders')
  createPO(@Body() dto: any) {
    return this.productionService.createPO(dto);
  }

  @Get('orders')
  findAllPOs(@Query() params: any) {
    return this.productionService.findAllPOs(params);
  }

  @Patch('orders/:id/status')
  updatePOStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.productionService.updatePOStatus(id, status);
  }
}
