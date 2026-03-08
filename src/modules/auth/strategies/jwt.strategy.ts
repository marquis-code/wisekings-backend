import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        configService: ConfigService,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('jwt.accessSecret'),
        });
    }

    async validate(payload: any) {
        const user = await this.userModel
            .findById(payload.sub)
            .select('-password -refreshToken')
            .lean();

        if (!user || !user.isActive) {
            throw new UnauthorizedException('User not found or deactivated');
        }

        return {
            _id: user._id,
            sub: user._id,
            email: user.email,
            fullName: user.fullName,
            userType: user.userType,
            role: user.role,
        };
    }
}
