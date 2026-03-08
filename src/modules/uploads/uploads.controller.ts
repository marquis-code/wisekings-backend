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
    @Roles('admin', 'merchant', 'partner', 'superadmin')
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
            fileFilter: (req, file, callback) => {
                if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|gif)$/)) {
                    return callback(
                        new BadRequestException('Only image files are allowed!'),
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
    @Roles('admin', 'merchant', 'partner', 'superadmin')
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
            fileFilter: (req, file, callback) => {
                if (!file.mimetype.match(/\/(pdf|doc|docx|png|jpg|jpeg)$/)) {
                    return callback(
                        new BadRequestException('Only documents (PDF/DOC) or images are allowed!'),
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
