import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RawMaterial, RawMaterialDocument } from './schemas/raw-material.schema';
import { ProductionBatch, ProductionBatchDocument } from './schemas/production-batch.schema';
import { PurchaseOrder, PurchaseOrderDocument } from './schemas/purchase-order.schema';

@Injectable()
export class ProductionService {
  constructor(
    @InjectModel(RawMaterial.name) private materialModel: Model<RawMaterialDocument>,
    @InjectModel(ProductionBatch.name) private batchModel: Model<ProductionBatchDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
  ) {}

  // Raw Material Management
  async createMaterial(dto: any) {
    return this.materialModel.create(dto);
  }

  async findAllMaterials() {
    return this.materialModel.find().exec();
  }

  async updateMaterial(id: string, dto: any) {
    return this.materialModel.findByIdAndUpdate(id, dto, { new: true }).exec();
  }

  // Production Batch Management
  async createBatch(dto: {
    productId: string;
    batchNumber: string;
    materials: { materialId: string; weight: number }[];
    quantityProduced: number;
    sellingPricePerUnit: number;
    notes?: string;
  }) {
    let totalCost = 0;
    const processedMaterials = [];

    // 1. Calculate costs and update stock
    for (const m of dto.materials) {
      const material = await this.materialModel.findById(m.materialId);
      if (!material) throw new NotFoundException(`Material ${m.materialId} not found`);

      const cost = m.weight * material.costPerUnit;
      totalCost += cost;

      processedMaterials.push({
        materialId: new Types.ObjectId(m.materialId),
        weight: m.weight,
        cost: material.costPerUnit,
      });

      // Update stock (decrement)
      material.currentStock -= m.weight;
      await material.save();
    }

    // 2. Calculate Financials
    const revenue = dto.quantityProduced * dto.sellingPricePerUnit;
    const profit = revenue - totalCost;
    const marginPercentage = revenue > 0 ? (profit / revenue) * 100 : 0;

    // 3. Create Batch
    return this.batchModel.create({
      ...dto,
      productId: new Types.ObjectId(dto.productId),
      materials: processedMaterials,
      totalProductionCost: totalCost,
      revenue,
      profit,
      marginPercentage,
    });
  }

  async findAllBatches(filters: any = {}) {
    return this.batchModel.find(filters)
      .populate('productId', 'name slug')
      .populate('materials.materialId', 'name unit')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getBatchById(id: string) {
    const batch = await this.batchModel.findById(id)
      .populate('productId')
      .populate('materials.materialId')
      .exec();
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  // Purchase Order Methods
  async createPO(dto: any) {
    const totalAmount = dto.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    return this.poModel.create({
      ...dto,
      totalAmount,
    });
  }

  async findAllPOs(params: any = {}) {
    return this.poModel.find(params).sort({ createdAt: -1 }).exec();
  }

  async updatePOStatus(id: string, status: string) {
    return this.poModel.findByIdAndUpdate(id, { status }, { new: true }).exec();
  }
}
