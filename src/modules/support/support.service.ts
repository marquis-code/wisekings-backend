import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Ticket, TicketDocument, TicketStatus } from './schemas/ticket.schema';
import { AiService } from '../ai/ai.service';

@Injectable()
export class SupportService {
    constructor(
        @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
        private aiService: AiService,
    ) { }

    async createTicket(customerId: string, data: Partial<Ticket>) {
        const count = await this.ticketModel.countDocuments();
        const ticketNumber = `TIC-${1000 + count + 1}`;

        const ticket = new this.ticketModel({
            ...data,
            customerId: new Types.ObjectId(customerId),
            ticketNumber,
        });

        const saved = await ticket.save();

        // Trigger AI classification (async)
        if (this.aiService?.classifyTicket) {
            this.aiService.classifyTicket(saved._id.toString());
        }

        return saved;
    }

    async findAll(query: any = {}) {
        return this.ticketModel.find(query)
            .populate('customerId', 'fullName email')
            .sort({ createdAt: -1 })
            .exec();
    }

    async findOne(id: string) {
        const ticket = await this.ticketModel.findById(id)
            .populate('customerId', 'fullName email')
            .populate('comments.senderId', 'fullName role')
            .exec();
        if (!ticket) throw new NotFoundException('Ticket not found');
        return ticket;
    }

    async updateStatus(id: string, status: TicketStatus) {
        return this.ticketModel.findByIdAndUpdate(id, { status }, { new: true });
    }

    async addComment(id: string, senderId: string, message: string) {
        return this.ticketModel.findByIdAndUpdate(
            id,
            {
                $push: {
                    comments: {
                        message,
                        senderId: new Types.ObjectId(senderId),
                        createdAt: new Date()
                    }
                }
            },
            { new: true }
        );
    }
}
