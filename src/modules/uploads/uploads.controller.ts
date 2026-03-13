import {
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
    BadRequestException,
    UseGuards,
    Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

@Controller('uploads')
@UseGuards(RolesGuard)
export class UploadsController {
    constructor(private readonly uploadsService: UploadsService) { }

    @Post('image/:folder')
    @Roles('admin', 'merchant', 'partner', 'superadmin', 'customer', 'support')
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
            fileFilter: (req, file, callback) => {
                if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|gif|mp4|mpeg|quicktime|wav|mp3|ogg)$/)) {
                    return callback(
                        new BadRequestException('File type not supported for rich media!'),
                        false,
                    );
                }
                callback(null, true);
            },
        }),
    )
    async uploadImage(
        @UploadedFile() file: Express.Multer.File,
        @Param('folder') folder: string,
    ) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        const url = await this.uploadsService.uploadFile(file, folder);
        return { url };
    }

    @Post('document/:folder')
    @Roles('admin', 'merchant', 'partner', 'superadmin', 'customer', 'support')
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
            fileFilter: (req, file, callback) => {
                const allowedMimes = [
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'image/jpeg',
                    'image/png',
                    'image/webp',
                    'image/gif',
                    'image/bmp',
                    'image/tiff',
                    'video/mp4',
                    'video/mpeg',
                    'video/quicktime',
                    'audio/mpeg',
                    'audio/wav',
                    'audio/ogg',
                    'audio/mp3',
                    'audio/webm',
                ];
                if (!allowedMimes.includes(file.mimetype)) {
                    return callback(
                        new BadRequestException('Only documents (PDF/DOC/DOCX) or images (JPG/PNG/WEBP/GIF) are allowed!'),
                        false,
                    );
                }
                callback(null, true);
            },
        }),
    )
    async uploadDocument(
        @UploadedFile() file: Express.Multer.File,
        @Param('folder') folder: string,
    ) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        const url = await this.uploadsService.uploadFile(file, folder);
        return { url };
    }
}
