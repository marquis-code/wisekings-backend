import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import OpenAI from 'openai';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Ticket, TicketDocument } from '../support/schemas/ticket.schema';
import { AuditLog, AuditLogDocument } from '../audit/schemas/audit-log.schema';

@Injectable()
export class AiService {
    private openai: OpenAI;
    private readonly logger = new Logger(AiService.name);

    constructor(
        @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
        @InjectModel(Product.name) private productModel: Model<ProductDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
        @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
        private configService: ConfigService,
    ) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
        }
    }

    private get isReady() {
        return !!this.openai;
    }

    async classifyTicket(ticketId: string) {
        if (!this.isReady) return;

        const ticket = await this.ticketModel.findById(ticketId);
        if (!ticket) return;

        const prompt = `Classify the following support ticket:
        Subject: ${ticket.subject}
        Description: ${ticket.description}
        
        Return a JSON object with:
        - category (billing, technical, account, general)
        - priority (low, medium, high, urgent)
        - assignedTeam (Finance, DevOps, Customer Success)
        - aiSummary (one sentence summary)`;

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
            });

            const content = response.choices[0].message.content;
            if (!content) return;

            const result = JSON.parse(content);
            await this.ticketModel.findByIdAndUpdate(ticketId, {
                category: result.category,
                priority: result.priority,
                assignedTeam: result.assignedTeam,
                aiSummary: result.aiSummary
            });
        } catch (e) {
            this.logger.error('Failed to classify ticket:', e);
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async predictDemand() {
        if (!this.isReady) return;

        const products = await this.productModel.find({ isActive: true });
        for (const product of products) {
            // Logic for demand forecasting based on totalSold and stock
            const score = Math.floor(Math.random() * 100); // Placeholder AI logic
            await this.productModel.findByIdAndUpdate(product._id, {
                demandForecast: score,
                nextReplenishmentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async analyzeChurn() {
        if (!this.isReady) return;

        const users = await this.userModel.find({ isActive: true });
        for (const user of users) {
            // Logic for churn probability
            const prob = Math.random();
            await this.userModel.findByIdAndUpdate(user._id, {
                churnProbability: prob,
                engagementStatus: prob > 0.7 ? 'churned' : prob > 0.3 ? 'at_risk' : 'active'
            });
        }
    }

    async detectFraud(orderId: string) {
        if (!this.isReady) return;

        const order = await this.orderModel.findById(orderId);
        if (!order) return;

        const prompt = `Analyze this order for fraud risk:
        Order ID: ${order.orderNumber}
        Total Amount: ${order.totalAmount}
        Items: ${JSON.stringify(order.items)}
        
        Return a JSON object with:
        - fraudScore (0-100)
        - flaggedReasons (array of strings)
        - isAnomaly (boolean)`;

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
            });

            const content = response.choices[0].message.content;
            if (!content) return;

            const result = JSON.parse(content);
            await this.orderModel.findByIdAndUpdate(orderId, {
                aiRiskAnalysis: result
            });
        } catch (e) {
            this.logger.error('Failed to detect fraud:', e);
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_10AM)
    async followUpOnInvoices() {
        if (!this.isReady) return;

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const overdueOrders = await this.orderModel.find({
            paymentStatus: 'pending',
            createdAt: { $lte: sevenDaysAgo },
            status: { $ne: 'cancelled' }
        }).populate('customerId');

        for (const order of overdueOrders) {
            const nextLevel = (order.followUpEscalationLevel || 0) + 1;
            const customer = order.customerId as any;

            const prompt = `Draft a firm but polite payment reminder for:
            Customer: ${customer.fullName}
            Order: ${order.orderNumber}
            Amount: ${order.totalAmount}
            Days Overdue: ${Math.floor((Date.now() - (order as any).createdAt.getTime()) / (1000 * 60 * 60 * 24))}
            Escalation Level: ${nextLevel} (1=Email, 2=Strong Email, 3=Call Suggestion)
            
            Return the reminder text.`;

            try {
                const response = await this.openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: prompt }],
                });

                const reminderText = response.choices[0].message.content;
                await this.orderModel.findByIdAndUpdate(order._id, {
                    followUpEscalationLevel: nextLevel,
                    lastAiReminderSentAt: new Date(),
                    notes: (order.notes || '') + `\n[AI Follow-up L${nextLevel}]: ${reminderText?.substring(0, 100)}...`
                });
            } catch (e) {
                this.logger.error(`Failed follow-up for order ${order.orderNumber}`, e);
            }
        }
    }

    async askAssistant(question: string) {
        if (!this.isReady) return 'AI Assistant is not configured. Please add OPENAI_API_KEY.';

        // Fetch context for the prompt
        const salesCount = await this.orderModel.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } });
        const pendingInvoices = await this.orderModel.countDocuments({ paymentStatus: 'pending' });

        const prompt = `You are the WiseKings ERP AI Assistant. 
        Current System State:
        - Today's Sales: ${salesCount}
        - Unpaid Invoices: ${pendingInvoices}
        
        Question: ${question}
        
        Provide a concise, helpful answer based on the data.`;

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
        });

        return response.choices[0].message.content;
    }

    async analyzeStaffProductivity() {
        // Get recent audit logs (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const logs = await this.auditLogModel
            .find({ timestamp: { $gte: sevenDaysAgo } })
            .select('userEmail action resource timestamp')
            .limit(500)
            .lean();

        if (logs.length === 0) return { insight: "Not enough data for productivity analysis yet." };

        const prompt = `
      Analyze the following system audit logs for staff productivity insights.
      Logs: ${JSON.stringify(logs)}
      
      Identify:
      1. Most active staff members.
      2. Peak activity times.
      3. Potential bottlenecks or unusually high volumes in specific resources.
      4. General efficiency trends.
      
      Return a professional summary for the administrator.
    `;

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'system', content: 'You are a staff productivity analyst for an ERP system.' }, { role: 'user', content: prompt }],
        });

        return { insight: response.choices[0].message?.content || "Analysis unavailable." };
    }

    async generateSupportResponse(history: any[], userMessage: string, systemPrompt?: string) {
        if (!this.isReady) return "I'm currently unable to assist. Please wait for an agent.";

        const messages: any[] = [
            { role: 'system', content: systemPrompt || 'You are the WiseKings Support AI. Assist the user professionally.' },
            ...history.map(m => ({
                role: m.senderId?.userType === 'customer' || m.senderId?.userType === 'partner' || m.senderId?.userType === 'merchant' ? 'user' : 'assistant',
                content: m.content
            })).slice(-10), // Take last 10 messages for context
            { role: 'user', content: userMessage }
        ];

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: messages,
            });

            return response.choices[0].message.content;
        } catch (e) {
            this.logger.error('AI Support generation failed:', e);
            return "I'm having trouble processing your request. One moment please.";
        }
    }
}
