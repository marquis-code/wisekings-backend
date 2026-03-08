import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';

@WebSocketGateway({
    namespace: 'chat',
    cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);

    constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
        private chatService: ChatService,
    ) { }

    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth.token?.split(' ')[1] || client.handshake.headers.authorization?.split(' ')[1];
            if (!token) return client.disconnect();

            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.get<string>('jwt.accessSecret'),
            });

            client.data.user = payload;
            client.join(`user:${payload.sub}`);
            this.logger.log(`Chat client connected: ${client.id} (User: ${payload.sub})`);
        } catch (error) {
            this.logger.error(`Chat connection error: ${error.message}`);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Chat client disconnected: ${client.id}`);
    }

    @SubscribeMessage('chat:join')
    async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() conversationId: string) {
        client.join(`conv:${conversationId}`);
        return { status: 'joined' };
    }

    @SubscribeMessage('chat:message')
    async handleMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { conversationId: string; content: string; type?: string; attachments?: any[] },
    ) {
        const senderId = client.data.user.sub;

        // Save to DB
        const message = await this.chatService.saveMessage(
            payload.conversationId,
            senderId,
            payload.content,
            payload.type,
            payload.attachments,
        );

        // Emit to conversation room
        this.server.to(`conv:${payload.conversationId}`).emit('chat:message:new', message);

        return message;
    }

    @SubscribeMessage('chat:typing')
    handleTyping(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { conversationId: string; isTyping: boolean },
    ) {
        client.to(`conv:${payload.conversationId}`).emit('chat:typing:state', {
            userId: client.data.user.sub,
            isTyping: payload.isTyping,
        });
    }
}
