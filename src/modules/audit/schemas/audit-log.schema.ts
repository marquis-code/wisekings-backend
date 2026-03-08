import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
    @Prop()
    userId: string;

    @Prop()
    userEmail: string;

    @Prop({ required: true })
    action: string;

    @Prop({ required: true })
    resource: string;

    @Prop()
    resourceId: string;

    @Prop()
    method: string;

    @Prop()
    url: string;

    @Prop({ type: Object })
    body: Record<string, any>;

    @Prop({ type: Object })
    previousData: Record<string, any>;

    @Prop({ type: Object })
    newData: Record<string, any>;

    @Prop()
    ipAddress: string;

    @Prop()
    userAgent: string;

    @Prop()
    statusCode: number;

    @Prop()
    duration: number;

    @Prop({ default: Date.now })
    timestamp: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ resource: 1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 day TTL
