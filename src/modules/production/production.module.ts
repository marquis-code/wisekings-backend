import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductionService } from './production.service';
import { ProductionController } from './production.controller';
import { RawMaterial, RawMaterialSchema } from './schemas/raw-material.schema';
import { ProductionBatch, ProductionBatchSchema } from './schemas/production-batch.schema';
import { PurchaseOrder, PurchaseOrderSchema } from './schemas/purchase-order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RawMaterial.name, schema: RawMaterialSchema },
      { name: ProductionBatch.name, schema: ProductionBatchSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
    ]),
  ],
  providers: [ProductionService],
  controllers: [ProductionController],
  exports: [ProductionService],
})
export class ProductionModule {}
