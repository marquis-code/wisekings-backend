import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { PaginationDto, PaginatedResult } from '@common/dto';

@Injectable()
export class AuditService {
    constructor(
        @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    ) { }

    async findAll(paginationDto: PaginationDto, filters?: any) {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search } = paginationDto;
        const skip = (page - 1) * limit;

        const filter: any = {};
        if (search) {
            filter.$or = [
                { userEmail: { $regex: search, $options: 'i' } },
                { action: { $regex: search, $options: 'i' } },
                { resource: { $regex: search, $options: 'i' } },
            ];
        }

        if (filters?.userId) filter.userId = filters.userId;
        if (filters?.resource) filter.resource = filters.resource;
        if (filters?.action) filter.action = filters.action;

        const [data, total] = await Promise.all([
            this.auditLogModel
                .find(filter)
                .sort({ [sortBy as string]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            this.auditLogModel.countDocuments(filter),
        ]);

        return new PaginatedResult(data as any[], total, page, limit);
    }

    async findById(id: string) {
        return this.auditLogModel.findById(id).lean();
    }
}
