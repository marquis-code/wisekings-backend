import { Module, Global } from '@nestjs/common';
import { NotificationGateway } from './notification.gateway';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
    imports: [AuthModule],
    providers: [NotificationGateway],
    exports: [NotificationGateway],
})
export class WebsocketsModule { }
