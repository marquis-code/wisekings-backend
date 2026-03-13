import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contact, ContactDocument, ContactStatus } from './schemas/contact.schema';

@Injectable()
export class ContactService {
    constructor(
        @InjectModel(Contact.name) private contactModel: Model<ContactDocument>,
    ) { }

    async create(data: Partial<Contact>) {
        const contact = new this.contactModel(data);
        return contact.save();
    }

    async findAll(query: any = {}) {
        return this.contactModel.find(query).sort({ createdAt: -1 }).exec();
    }

    async findOne(id: string) {
        const contact = await this.contactModel.findById(id).exec();
        if (!contact) throw new NotFoundException('Inquiry not found');
        return contact;
    }

    async update(id: string, data: Partial<Contact>) {
        const contact = await this.contactModel.findByIdAndUpdate(id, data, { new: true }).exec();
        if (!contact) throw new NotFoundException('Inquiry not found');
        return contact;
    }
}
