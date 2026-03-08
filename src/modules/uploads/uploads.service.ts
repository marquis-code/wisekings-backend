import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadsService {
    private readonly s3Client: S3Client;
    private readonly bucketName: string;
    private readonly logger = new Logger(UploadsService.name);

    constructor(private configService: ConfigService) {
        this.s3Client = new S3Client({
            region: this.configService.get<string>('aws.region') || '',
            credentials: {
                accessKeyId: this.configService.get<string>('aws.accessKeyId') || '',
                secretAccessKey: this.configService.get<string>('aws.secretAccessKey') || '',
            },
        });
        this.bucketName = this.configService.get<string>('aws.s3Bucket') || '';
    }

    async uploadFile(file: Express.Multer.File, folder = 'general'): Promise<string> {
        const key = `${folder}/${uuidv4()}-${file.originalname}`;

        try {
            await this.s3Client.send(
                new PutObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                    Body: file.buffer,
                    ContentType: file.mimetype,
                    ACL: 'public-read',
                }),
            );

            // Return the public URL
            return `https://${this.bucketName}.s3.${this.configService.get<string>(
                'aws.region',
            )}.amazonaws.com/${key}`;
        } catch (error) {
            this.logger.error(`Error uploading file to S3: ${error.message}`);
            throw error;
        }
    }

    async deleteFile(url: string): Promise<void> {
        if (!url) return;

        // Extract key from URL
        // URL format: https://bucket.s3.region.amazonaws.com/folder/filename
        const key = url.split('.amazonaws.com/')[1];
        if (!key) return;

        try {
            await this.s3Client.send(
                new DeleteObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                }),
            );
        } catch (error) {
            this.logger.error(`Error deleting file from S3: ${error.message}`);
        }
    }

    async getPresignedUrl(key: string): Promise<string> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
        } catch (error) {
            this.logger.error(`Error generating presigned URL: ${error.message}`);
            throw error;
        }
    }
}
