import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatService } from './chat.service';
import { ChatConfigService } from './chat-config.service';
import { ChatController } from './chat.controller';
import { ChatConfigController } from './chat-config.controller';
import { ChatGateway } from './chat.gateway';
import { Conversation, ConversationSchema, Message, MessageSchema } from './schemas/chat.schema';
import { ChatConfig, ChatConfigSchema } from './schemas/chat-config.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Conversation.name, schema: ConversationSchema },
            { name: Message.name, schema: MessageSchema },
            { name: ChatConfig.name, schema: ChatConfigSchema },
        ]),
        AuthModule,
    ],
    controllers: [ChatController, ChatConfigController],
    providers: [ChatService, ChatGateway, ChatConfigService],
    exports: [ChatService, ChatConfigService],
})
export class ChatModule { }
