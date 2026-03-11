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
import { MessageType } from '@common/constants';

@WebSocketGateway({
    namespace: 'chat',
    cors: {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST'],
    },
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
            if (!token) {
                this.logger.warn(`Connection attempt without token: ${client.id}`);
                return client.disconnect();
            }

            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.get<string>('jwt.accessSecret'),
            });

            client.data.user = payload;

            // Join personal user room for targeted notifications
            await client.join(`user:${payload.sub}`);

            this.logger.log(`Chat client connected: ${client.id} (User: ${payload.sub}, Role: ${payload.role})`);

            // Automatically join existing conversations to ensure real-time delivery
            const conversations = await this.chatService.findUserConversations(payload.sub, { limit: 100 });
            for (const conv of conversations.data) {
                await client.join(`conv:${conv._id.toString()}`);
            }
        } catch (error) {
            this.logger.error(`Chat connection error for client ${client.id}: ${error.message}`);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.data.user?.sub;
        this.logger.log(`Chat client disconnected: ${client.id} ${userId ? `(User: ${userId})` : ''}`);
    }

    @SubscribeMessage('chat:join')
    async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() conversationId: string) {
        if (!conversationId) return { error: 'No conversation ID provided' };

        await client.join(`conv:${conversationId}`);
        this.logger.debug(`Client ${client.id} joined room: conv:${conversationId}`);
        return { status: 'joined', room: conversationId };
    }

    @SubscribeMessage('chat:message')
    async handleMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { conversationId: string; content: string; type?: MessageType; attachments?: string[] },
    ) {
        if (!client.data.user) return { error: 'Unauthorized' };
        const senderId = client.data.user.sub;

        this.logger.log(`New message from ${senderId} in conv ${payload.conversationId}`);

        // Save to DB and get conversation participants
        const { message, conversation } = await this.chatService.saveMessage(
            payload.conversationId,
            senderId,
            payload.content,
            payload.type,
            payload.attachments,
        );

        // Ensure sender is in the room
        await client.join(`conv:${payload.conversationId}`);

        // Emit to the conversation room
        this.server.to(`conv:${payload.conversationId}`).emit('chat:message:new', message);

        // Also emit to each participant's personal room to ensure those not in the conv room get it
        if (conversation && conversation.participants) {
            for (const participantId of conversation.participants) {
                const pid = participantId.toString();
                if (pid !== senderId) {
                    this.server.to(`user:${pid}`).emit('chat:message:new', message);
                }
            }
        }

        return message;
    }

    @SubscribeMessage('chat:typing')
    handleTyping(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { conversationId: string; isTyping: boolean },
    ) {
        if (!client.data.user) return;

        client.to(`conv:${payload.conversationId}`).emit('chat:typing:state', {
            userId: client.data.user.sub,
            conversationId: payload.conversationId,
            isTyping: payload.isTyping,
        });
    }
}
