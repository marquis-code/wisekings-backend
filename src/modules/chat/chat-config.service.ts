import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatConfig, ChatConfigDocument } from './schemas/chat-config.schema';

@Injectable()
export class ChatConfigService {
    constructor(
        @InjectModel(ChatConfig.name) private configModel: Model<ChatConfigDocument>,
    ) { }

    async getConfig() {
        let config = await this.configModel.findOne({ scope: 'global' }).exec();
        if (!config) {
            config = await this.configModel.create({ scope: 'global' });
        }
        return config;
    }

    async updateConfig(updateDto: any) {
        let config = await this.configModel.findOneAndUpdate(
            { scope: 'global' },
            { $set: updateDto },
            { new: true, upsert: true }
        ).exec();
        return config;
    }

    async isWithinBusinessHours(): Promise<boolean> {
        const config = await this.getConfig();
        const now = new Date();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = days[now.getDay()];
        const hours = config.businessHours[dayName];

        if (!hours || hours.isClosed) return false;

        const currentLocalTime = now.getHours() * 60 + now.getMinutes();
        
        const [openH, openM] = hours.open.split(':').map(Number);
        const [closeH, closeM] = hours.close.split(':').map(Number);
        
        const openTime = openH * 60 + openM;
        const closeTime = closeH * 60 + closeM;

        return currentLocalTime >= openTime && currentLocalTime <= closeTime;
    }
}
