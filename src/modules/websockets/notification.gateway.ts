import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
    cors: {
        origin: '*', // For development. In production, restrict to allowed origins.
    },
    namespace: '/notifications',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private readonly logger = new Logger(NotificationGateway.name);
    private userSockets = new Map<string, string[]>(); // userId -> socketIds[]

    constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
            if (!token) {
                client.disconnect();
                return;
            }

            const payload = this.jwtService.verify(token, {
                secret: this.configService.get<string>('jwt.accessSecret') || 'dev-access-secret-change-in-production',
            });

            const userId = payload.sub;
            client.data.user = payload;

            const existingSockets = this.userSockets.get(userId) || [];
            this.userSockets.set(userId, [...existingSockets, client.id]);

            // Also join a room for broadcast by role (e.g., 'admin_room', 'partner_room')
            client.join(`role_${payload.role}`);

            this.logger.log(`Client connected to notifications: ${client.id} (User: ${userId}, Role: ${payload.role})`);
        } catch (error) {
            this.logger.warn(`Failed connection attempt to notifications: ${error.message}`);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.data.user?.sub;
        if (userId) {
            const sockets = this.userSockets.get(userId) || [];
            const newSockets = sockets.filter(id => id !== client.id);
            if (newSockets.length === 0) {
                this.userSockets.delete(userId);
            } else {
                this.userSockets.set(userId, newSockets);
            }
        }
        this.logger.log(`Client disconnected from notifications: ${client.id}`);
    }

    // --- Utility Methods to emit notifications from other services --- //

    // Send a notification to a specific user
    sendToUser(userId: string, event: string, data: any) {
        const sockets = this.userSockets.get(userId);
        if (sockets && sockets.length > 0) {
            sockets.forEach(socketId => {
                this.server.to(socketId).emit(event, data);
            });
            return true;
        }
        return false;
    }

    // Send a notification to all admins
    sendToAdmins(event: string, data: any) {
        this.server.to('role_admin').emit(event, data);
    }

    // Send a notification to all partners
    sendToPartners(event: string, data: any) {
        this.server.to('role_user').emit(event, data); // 'role_user' with userType 'partner' handled via logic
        // We can also emit globally or target specific roles based on how roles map
    }
}
