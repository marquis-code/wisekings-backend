import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Gifting, GiftingDocument } from './schema/gifting.schema';
import { CreateGiftingDto } from './dto/create-gifting.dto';
import { UpdateGiftingDto } from './dto/update-gifting.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class GiftingService {
  constructor(
    @InjectModel(Gifting.name) private giftingModel: Model<GiftingDocument>,
    private mailService: MailService,
  ) {}

  async create(createDto: CreateGiftingDto) {
    const newRequest = await this.giftingModel.create(createDto);
    
    // Send acknowledgment email
    const subject = 'Your Gifting Request has been Received';
    const html = this.mailService.brandWrapper(subject, `
      <p>Hi ${createDto.senderDetails.name},</p>
      <p>Thank you for choosing WiseKings to curate a special gift for ${createDto.recipientDetails.name}.</p>
      <p>We are currently reviewing your request. Once approved, we will send you an invoice with the total cost including shipping, along with payment instructions.</p>
      <p>We look forward to making this occasion special.</p>
    `);
    this.mailService.sendEmail(createDto.senderDetails.email, subject, html);

    return newRequest;
  }

  async findAll() {
    return this.giftingModel.find().populate('products.product').sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    const request = await this.giftingModel.findById(id).populate('products.product').exec();
    if (!request) throw new NotFoundException('Gifting request not found');
    return request;
  }

  async update(id: string, updateDto: UpdateGiftingDto) {
    const request = await this.giftingModel.findById(id);
    if (!request) throw new NotFoundException('Gifting request not found');

    if (updateDto.productsCost !== undefined) request.pricing.productsCost = updateDto.productsCost;
    if (updateDto.shippingFee !== undefined) request.pricing.shippingFee = updateDto.shippingFee;
    if (updateDto.totalCost !== undefined) request.pricing.totalCost = updateDto.totalCost;
    if (updateDto.receiptUrl) request.receiptUrl = updateDto.receiptUrl;
    if (updateDto.status) request.status = updateDto.status;

    await request.save();

    // Trigger emails based on status change
    if (updateDto.status === 'approved') {
      const subject = 'Your Gifting Invoice is Ready';
      const amount = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(request.pricing.totalCost);
      const html = this.mailService.brandWrapper(subject, `
        <p>Hi ${request.senderDetails.name},</p>
        <p>Great news! Your gifting request for ${request.recipientDetails.name} has been approved.</p>
        <p>The total cost (including shipping) is <strong>${amount}</strong>.</p>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <h3 style="margin-top:0;">Payment Instructions</h3>
          <p>Please make a bank transfer to the following account:</p>
          <p><strong>Bank:</strong> Guaranty Trust Bank (GTB)</p>
          <p><strong>Account Name:</strong> WiseKings Ventures</p>
          <p><strong>Account Number:</strong> 0123456789</p>
          <p style="font-size: 13px; color: #64748b;">After payment, please reply to this email with your payment receipt.</p>
        </div>
      `);
      this.mailService.sendEmail(request.senderDetails.email, subject, html);
    } else if (updateDto.status === 'paid') {
      const subject = 'Payment Confirmed - Processing Delivery';
      const html = this.mailService.brandWrapper(subject, `
        <p>Hi ${request.senderDetails.name},</p>
        <p>We have successfully confirmed your payment for the gifting request.</p>
        <p>Your curated package is now being processed for delivery to ${request.recipientDetails.name}.</p>
        <p>Thank you for choosing WiseKings!</p>
      `);
      this.mailService.sendEmail(request.senderDetails.email, subject, html);
    }

    return request;
  }
}
