import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InvestmentsService } from './investments.service';
import { InvestmentsController } from './investments.controller';
import { Investment, InvestmentSchema } from './schemas/investment.schema';
import { InvestmentProposal, InvestmentProposalSchema } from './schemas/investment-proposal.schema';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Investment.name, schema: InvestmentSchema },
            { name: InvestmentProposal.name, schema: InvestmentProposalSchema },
        ]),
        MailModule,
    ],
    controllers: [InvestmentsController],
    providers: [InvestmentsService],
    exports: [InvestmentsService],
})
export class InvestmentsModule {}
