import {
    Injectable,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        const request = context.switchToHttp().getRequest();
        const path = request.url;
        
        // Log for debugging
        const authHeader = request.headers.authorization;
        const tokenSnippet = authHeader ? `${authHeader.substring(0, 15)}...` : 'None';
        console.log(`JwtAuthGuard: Checking path ${path} - isPublic: ${isPublic} - AuthHeader: ${tokenSnippet}`);

        if (isPublic || request.url.includes('/shipping/calculate') || request.url.includes('/shipping/calculate-public')) {
            return true;
        }

        return super.canActivate(context);
    }

    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        // If we are here, it might be because super.canActivate was called 
        // OR because NestJS calls handleRequest even if canActivate returns true (rare but possible in some setups)
        
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        const request = context.switchToHttp().getRequest();
        if (isPublic || request.url.includes('/shipping/calculate') || request.url.includes('/shipping/calculate-public')) {
            return user; // Return user (might be null) without throwing
        }

        if (err || !user) {
            throw err || new UnauthorizedException('Authentication required');
        }
        return user;
    }
}
