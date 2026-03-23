import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { Buffer } from 'buffer';
import * as sharp from 'sharp';

@Injectable()
export class UploadsService {
    private readonly logger = new Logger(UploadsService.name);

    constructor(private configService: ConfigService) {
        cloudinary.config({
            cloud_name: this.configService.get<string>('cloudinary.cloudName'),
            api_key: this.configService.get<string>('cloudinary.apiKey'),
            api_secret: this.configService.get<string>('cloudinary.apiSecret'),
        });
    }

    async uploadFile(file: Express.Multer.File, folder = 'general'): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                let fileBuffer = file.buffer;
                let resourceType = 'auto';

                // Aggressively optimize images to WebP format
                const isImageToOptimize = file.mimetype.startsWith('image/') && 
                                          file.mimetype !== 'image/svg+xml' && 
                                          file.mimetype !== 'image/gif';

                if (isImageToOptimize) {
                    fileBuffer = await sharp(file.buffer)
                        .webp({ quality: 80, effort: 6 })
                        .toBuffer();
                    resourceType = 'image';
                }

                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder: folder,
                        resource_type: resourceType as any,
                        format: isImageToOptimize ? 'webp' : undefined,
                    },
                    (error: UploadApiErrorResponse, result: UploadApiResponse) => {
                        if (error) {
                            this.logger.error(`Error uploading file to Cloudinary: ${error.message}`);
                            return reject(error);
                        }
                        resolve(result.secure_url);
                    },
                );

                // Create a buffer stream and pipe it to Cloudinary
                const stream = require('stream');
                const bufferStream = new stream.PassThrough();
                bufferStream.end(fileBuffer);
                bufferStream.pipe(uploadStream);
            } catch (error) {
                this.logger.error(`Error optimizing or uploading file: ${error.message}`);
                reject(error);
            }
        });
    }

    async deleteFile(url: string): Promise<void> {
        if (!url) return;

        try {
            // Extract public_id from URL
            // Example Cloudinary URL: https://res.cloudinary.com/<cloud_name>/image/upload/v1234567890/folder/filename.jpg
            const urlParts = url.split('/');
            const fileWithExtension = urlParts[urlParts.length - 1]; // filename.jpg
            const folder = urlParts[urlParts.length - 2]; // folder
            const public_id_base = fileWithExtension.split('.')[0]; // filename

            const public_id = `${folder}/${public_id_base}`;

            await cloudinary.uploader.destroy(public_id);
            this.logger.log(`Deleted file from Cloudinary: ${public_id}`);
        } catch (error) {
            this.logger.error(`Error deleting file from Cloudinary: ${error.message}`);
        }
    }

    async getPresignedUrl(url: string): Promise<string> {
        // Cloudinary handles public delivery by default.
        // If we want a signed delivery URL, we can generate one.
        // For standard implementations, returning the standard URL is usually sufficient unless transformations are strictly protected.
        // Provided we're just migrating direct uploads, we can return the URL itself.
        try {
            return url; // Could use cloudinary.utils.url(public_id, { sign_url: true }) if strict
        } catch (error) {
            this.logger.error(`Error getting URL: ${error.message}`);
            throw error;
        }
    }
}
