import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { PaginationDto, PaginatedResult } from '@common/dto';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
        private readonly gateway: NotificationsGateway,
    ) { }

    async create(userId: string, title: string, message: string, type: string, data?: any) {
        const notification = await this.notificationModel.create({
            userId: new Types.ObjectId(userId),
            title,
            message,
            type,
            data,
        });

        // Send real-time via socket
        this.gateway.sendToUser(userId, 'notification:new', notification);

        return notification;
    }

    async findAll(userId: string, paginationDto: PaginationDto) {
        const { page = 1, limit = 10 } = paginationDto;
        const skip = ((page as any) - 1) * (limit as any);

        const [data, total] = await Promise.all([
            this.notificationModel
                .find({ userId: new Types.ObjectId(userId) })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit as any)
                .lean(),
            this.notificationModel.countDocuments({ userId: new Types.ObjectId(userId) }),
        ]);

        return new PaginatedResult(data as any[], total, page, limit);
    }

    async markAsRead(id: string, userId: string) {
        const notification = await this.notificationModel.findOneAndUpdate(
            { _id: id, userId: new Types.ObjectId(userId) },
            { isRead: true },
            { new: true },
        );

        if (!notification) throw new NotFoundException('Notification not found');
        return notification;
    }

    async markAllAsRead(userId: string) {
        await this.notificationModel.updateMany(
            { userId: new Types.ObjectId(userId), isRead: false },
            { isRead: true },
        );
        return { success: true };
    }

    async getUnreadCount(userId: string) {
        const count = await this.notificationModel.countDocuments({
            userId: new Types.ObjectId(userId),
            isRead: false,
        });
        return { count };
    }

    async delete(id: string, userId: string) {
        const result = await this.notificationModel.deleteOne({
            _id: id,
            userId: new Types.ObjectId(userId),
        });
        if (result.deletedCount === 0) throw new NotFoundException('Notification not found');
        return { success: true };
    }
}
