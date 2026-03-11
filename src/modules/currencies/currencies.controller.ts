import { Controller, Get } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';
import { Public } from '../../common/decorators';

@Controller('currencies')
export class CurrenciesController {
    constructor(private readonly currenciesService: CurrenciesService) { }

    @Public()
    @Get()
    async findAll() {
        return this.currenciesService.getCurrencies();
    }

    @Public()
    @Get('rates')
    async getRates() {
        return this.currenciesService.getRates();
    }
}
