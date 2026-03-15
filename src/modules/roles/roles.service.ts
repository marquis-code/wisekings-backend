import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from './schemas/role.schema';

const DEFAULT_ROLES = [
    {
        name: 'superadmin',
        description: 'Full system access with all permissions',
        permissions: ['*:manage'],
        isSystem: true,
    },
    {
        name: 'admin',
        description: 'Administrative access with most permissions',
        permissions: [
            'merchants:manage', 'partners:manage', 'orders:manage',
            'commissions:manage', 'wallets:manage', 'products:manage',
            'categories:manage', 'users:read', 'users:update',
            'notifications:manage', 'chat:manage', 'audit:read',
            'reports:manage', 'withdrawals:manage',
        ],
        isSystem: true,
    },
    {
        name: 'finance',
        description: 'Financial operations and reporting',
        permissions: [
            'commissions:read', 'commissions:update',
            'wallets:read', 'wallets:update',
            'withdrawals:manage',
            'orders:read', 'merchants:read', 'partners:read',
            'reports:manage', 'audit:read',
        ],
        isSystem: true,
    },
    {
        name: 'support',
        description: 'Customer and merchant support',
        permissions: [
            'merchants:read', 'partners:read', 'orders:read',
            'users:read', 'commissions:read', 'wallets:read',
            'chat:manage', 'notifications:manage',
        ],
        isSystem: true,
    },
    {
        name: 'viewer',
        description: 'Read-only access to dashboards and reports',
        permissions: [
            'merchants:read', 'partners:read', 'orders:read',
            'users:read', 'commissions:read', 'reports:read',
        ],
        isSystem: true,
    },
    {
        name: 'user',
        description: 'Default role for merchants, partners, and customers',
        permissions: [],
        isSystem: true,
    },
];

@Injectable()
export class RolesService implements OnModuleInit {
    private readonly logger = new Logger(RolesService.name);

    constructor(
        @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    ) { }

    async onModuleInit() {
        await this.seedDefaultRoles();
    }

    private async seedDefaultRoles() {
        for (const roleData of DEFAULT_ROLES) {
            const existing = await this.roleModel.findOne({ name: roleData.name });
            if (!existing) {
                await this.roleModel.create(roleData);
                this.logger.log(`Created default role: ${roleData.name}`);
            }
        }
    }

    async findAll() {
        return this.roleModel.find().sort({ name: 1 }).lean();
    }

    async findByName(name: string) {
        const role = await this.roleModel.findOne({ name }).lean();
        if (!role) {
            throw new NotFoundException(`Role "${name}" not found`);
        }
        return role;
    }

    async create(data: { name: string; description: string; permissions: string[] }) {
        const existing = await this.roleModel.findOne({ name: data.name.toLowerCase().trim() });
        if (existing) {
            throw new Error(`A role with the name "${data.name}" already exists.`);
        }
        return this.roleModel.create({
            ...data,
            name: data.name.toLowerCase().trim()
        });
    }

    async update(id: string, data: Partial<Role>) {
        const role = await this.roleModel.findById(id);
        if (!role) {
            throw new NotFoundException('Role not found');
        }
        if (role.isSystem && data.name && data.name !== role.name) {
            throw new Error('Cannot rename system roles');
        }

        return this.roleModel
            .findByIdAndUpdate(id, data, { new: true })
            .lean();
    }

    async delete(id: string) {
        const role = await this.roleModel.findById(id);
        if (!role) {
            throw new NotFoundException('Role not found');
        }
        if (role.isSystem) {
            throw new Error('Cannot delete system roles');
        }
        await this.roleModel.findByIdAndDelete(id);
        return { message: 'Role deleted successfully' };
    }

    async getAvailablePermissions() {
        const resources = [
            'merchants', 'partners', 'orders', 'commissions',
            'wallets', 'withdrawals', 'products', 'categories',
            'users', 'roles', 'notifications', 'chat', 'audit', 'reports',
        ];
        const actions = ['create', 'read', 'update', 'delete', 'manage'];

        return resources.map((resource) => ({
            resource,
            actions: actions.map((action) => ({
                permission: `${resource}:${action}`,
                label: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource}`,
            })),
        }));
    }
}
