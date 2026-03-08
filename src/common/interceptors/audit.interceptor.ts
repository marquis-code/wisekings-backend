import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
    private readonly logger = new Logger(AuditInterceptor.name);

    constructor(
        @InjectModel('AuditLog') private readonly auditLogModel: Model<any>,
    ) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const method = request.method;

        // Only log write operations
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            return next.handle();
        }

        const user = request.user;
        const startTime = Date.now();

        return next.handle().pipe(
            tap(async (responseData) => {
                try {
                    const auditEntry = {
                        userId: user?._id || user?.sub || null,
                        userEmail: user?.email || 'anonymous',
                        action: this.getAction(method),
                        resource: this.getResource(request.route?.path || request.url),
                        resourceId: request.params?.id || responseData?.data?._id || null,
                        method,
                        url: request.url,
                        body: this.sanitizeBody(request.body),
                        previousData: null, // Set by specific service if needed
                        newData: responseData?.data || null,
                        ipAddress:
                            request.ip ||
                            request.headers['x-forwarded-for'] ||
                            request.connection?.remoteAddress,
                        userAgent: request.headers['user-agent'],
                        statusCode: context.switchToHttp().getResponse().statusCode,
                        duration: Date.now() - startTime,
                        timestamp: new Date(),
                    };

                    await this.auditLogModel.create(auditEntry);
                } catch (error) {
                    this.logger.error(`Failed to create audit log: ${error.message}`);
                }
            }),
        );
    }

    private getAction(method: string): string {
        const actionMap: Record<string, string> = {
            POST: 'CREATE',
            PUT: 'UPDATE',
            PATCH: 'UPDATE',
            DELETE: 'DELETE',
        };
        return actionMap[method] || 'UNKNOWN';
    }

    private getResource(path: string): string {
        // Extract resource name from path like /api/v1/merchants/:id
        const parts = path.split('/').filter(Boolean);
        // Find the first non-param segment after api/v1
        for (const part of parts) {
            if (!part.startsWith(':') && part !== 'api' && part !== 'v1') {
                return part;
            }
        }
        return 'unknown';
    }

    private sanitizeBody(body: any): any {
        if (!body) return null;
        const sanitized = { ...body };
        // Remove sensitive fields
        const sensitiveFields = [
            'password',
            'confirmPassword',
            'currentPassword',
            'newPassword',
            'token',
            'refreshToken',
            'bankAccountNumber',
            'bankAccountDetails',
        ];
        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }
        return sanitized;
    }
}
