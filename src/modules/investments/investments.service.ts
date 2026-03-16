import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Investment, InvestmentDocument } from './schemas/investment.schema';
import { InvestmentProposal, InvestmentProposalDocument } from './schemas/investment-proposal.schema';
import { InvestmentProduct, InvestmentProductDocument } from './schemas/investment-product.schema';
import { MailService } from '../mail/mail.service';

@Injectable()
export class InvestmentsService {
    constructor(
        @InjectModel(Investment.name) private investmentModel: Model<InvestmentDocument>,
        @InjectModel(InvestmentProposal.name) private proposalModel: Model<InvestmentProposalDocument>,
        @InjectModel(InvestmentProduct.name) private productModel: Model<InvestmentProductDocument>,
        private readonly mailService: MailService,
    ) {}

    async createProposal(dto: any) {
        return this.proposalModel.create(dto);
    }

    async findAllProposals(filters: any = {}) {
        return this.proposalModel.find(filters).exec();
    }

    async findProposalById(id: string) {
        const proposal = await this.proposalModel.findById(id).exec();
        if (!proposal) throw new NotFoundException('Proposal not found');
        return proposal;
    }

    async createInvestment(dto: any) {
        const investment = await this.investmentModel.create(dto);
        // Logic to update raisedAmount in proposal could go here
        return investment;
    }

    async findPartnerInvestments(partnerId: string) {
        return this.investmentModel.find({ partnerId: new Types.ObjectId(partnerId) })
            .populate('proposalId')
            .exec();
    }

    async findAllInvestments(filters: any = {}) {
        return this.investmentModel.find(filters)
            .populate('partnerId', 'companyName email')
            .populate('proposalId', 'title category')
            .exec();
    }

    async updateInvestmentStatus(id: string, update: any) {
        const investment = await this.investmentModel.findByIdAndUpdate(id, update, { new: true })
            .populate('partnerId')
            .exec();
        
        if (!investment) throw new NotFoundException('Investment record not found');

        // Trigger email if payment status changed to 'paid'
        if (update.paymentStatus === 'paid') {
            const partner = investment.partnerId as any;
            await this.mailService.sendInvestmentUpdate(partner.email, partner.contactPerson, investment);
        }

        return investment;
    }

    // Investment Product Methods (PiggyVest style)
    async createProduct(dto: any) {
        return this.productModel.create(dto);
    }

    async findAllProducts(filters: any = {}) {
        return this.productModel.find(filters).sort({ createdAt: -1 }).exec();
    }

    async findProductById(id: string) {
        const product = await this.productModel.findById(id).exec();
        if (!product) throw new NotFoundException('Investment product not found');
        return product;
    }

    async updateProduct(id: string, update: any) {
        const product = await this.productModel.findByIdAndUpdate(id, update, { new: true }).exec();
        if (!product) throw new NotFoundException('Investment product not found');
        return product;
    }
}
