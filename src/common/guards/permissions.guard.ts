import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        @InjectModel('Role') private readonly roleModel: Model<any>,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
            PERMISSIONS_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();
        if (!user) {
            throw new ForbiddenException('Access denied');
        }

        // SuperAdmin bypasses all permission checks
        if (user.role === 'superadmin') {
            return true;
        }

        // Fetch user's role and its permissions
        const role = await this.roleModel.findOne({ name: user.role }).lean();
        if (!role) {
            throw new ForbiddenException('Role not found');
        }

        const userPermissions: string[] = (role as any).permissions || [];

        // Check if user has 'manage' permission for the resource (wildcard)
        const hasPermission = requiredPermissions.every((required) => {
            const [resource, action] = required.split(':');
            return (
                userPermissions.includes(required) ||
                userPermissions.includes(`${resource}:manage`) ||
                userPermissions.includes('*:manage')
            );
        });

        if (!hasPermission) {
            throw new ForbiddenException(
                'You do not have the required permissions to perform this action',
            );
        }

        return true;
    }
}
