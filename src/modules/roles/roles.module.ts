import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { Role, RoleSchema } from './schemas/role.schema';

@Global()
@Module({
    imports: [
        MongooseModule.forFeature([{ name: Role.name, schema: RoleSchema }]),
    ],
    controllers: [RolesController],
    providers: [RolesService],
    exports: [RolesService, MongooseModule],
})
export class RolesModule { }
