import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailTemplate, EmailTemplateDocument } from './schemas/email-template.schema';

@Injectable()
export class EmailTemplatesService {
    constructor(
        @InjectModel(EmailTemplate.name) private templateModel: Model<EmailTemplateDocument>,
    ) { }

    async findAll() {
        return this.templateModel.find().sort({ createdAt: -1 }).lean();
    }

    async findById(id: string) {
        const template = await this.templateModel.findById(id).lean();
        if (!template) throw new NotFoundException('Email template not found');
        return template;
    }

    async findByName(name: string) {
        const template = await this.templateModel.findOne({ name, isActive: true }).lean();
        return template; // Return null if not found
    }

    async create(createData: any) {
        const existing = await this.templateModel.findOne({ name: createData.name });
        if (existing) throw new ConflictException('Template with this name already exists');

        const template = new this.templateModel(createData);
        return template.save();
    }

    async update(id: string, updateData: Partial<EmailTemplate>) {
        const template = await this.templateModel.findByIdAndUpdate(id, updateData, { new: true }).lean();
        if (!template) throw new NotFoundException('Email template not found');
        return template;
    }

    async delete(id: string) {
        const result = await this.templateModel.findByIdAndDelete(id);
        if (!result) throw new NotFoundException('Email template not found');
        return { message: 'Template deleted successfully' };
    }
}
