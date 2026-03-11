import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum TicketStatus {
    OPEN = 'open',
    IN_PROGRESS = 'in_progress',
    RESOLVED = 'resolved',
    CLOSED = 'closed'
}

export enum TicketPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    URGENT = 'urgent'
}

export type TicketDocument = Ticket & Document;

@Schema({ timestamps: true, collection: 'tickets' })
export class Ticket {
    @Prop({ required: true, unique: true })
    ticketNumber: string;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    customerId: Types.ObjectId;

    @Prop({ required: true })
    subject: string;

    @Prop({ required: true })
    description: string;

    @Prop({ enum: TicketStatus, default: TicketStatus.OPEN })
    status: TicketStatus;

    @Prop({ enum: TicketPriority, default: TicketPriority.MEDIUM })
    priority: TicketPriority;

    @Prop()
    category: string;

    @Prop()
    aiSummary: string;

    @Prop()
    assignedTeam: string;

    @Prop({
        type: [{
            subject: String,
            message: String,
            senderId: { type: Types.ObjectId, ref: 'User' },
            createdAt: { type: Date, default: Date.now }
        }], default: []
    })
    comments: {
        subject: string;
        message: string;
        senderId: Types.ObjectId;
        createdAt: Date;
    }[];

    @Prop()
    resolvedAt: Date;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);
TicketSchema.index({ customerId: 1, status: 1 });
TicketSchema.index({ ticketNumber: 1 });
