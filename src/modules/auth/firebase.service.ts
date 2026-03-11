import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
    private readonly logger = new Logger(FirebaseService.name);
    private firebaseApp: admin.app.App;

    constructor(private configService: ConfigService) { }

    onModuleInit() {
        const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');
        const serviceAccountPath = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');

        try {
            if (serviceAccountJson) {
                const serviceAccount = JSON.parse(serviceAccountJson);

                // Fix for private key newlines - extremely robust replacement
                if (serviceAccount.private_key) {
                    this.logger.debug(`Original key length: ${serviceAccount.private_key.length}`);

                    // Replace literal \n and escaped \\n
                    serviceAccount.private_key = serviceAccount.private_key.split('\\n').join('\n');

                    this.logger.debug(`Processed key length: ${serviceAccount.private_key.length}`);
                }

                // Validate PEM format
                if (!serviceAccount.private_key || !serviceAccount.private_key.includes('-----BEGIN PRIVATE KEY-----')) {
                    this.logger.error('Invalid private key format in service account JSON');
                }

                this.firebaseApp = admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                });
                this.logger.log('Firebase Admin initialized from inline JSON');
            } else if (serviceAccountPath) {
                this.firebaseApp = admin.initializeApp({
                    credential: admin.credential.cert(serviceAccountPath),
                });
                this.logger.log('Firebase Admin initialized from file path');
            } else {
                this.logger.warn('No Firebase service account credentials found. Social auth will be limited.');
            }
        } catch (error) {
            this.logger.error('Failed to initialize Firebase Admin', error);
        }
    }

    async verifyIdToken(idToken: string) {
        if (!this.firebaseApp) {
            throw new Error('Firebase Admin not initialized');
        }
        try {
            return await this.firebaseApp.auth().verifyIdToken(idToken);
        } catch (error) {
            this.logger.error('Firebase token verification failed', error);
            throw error;
        }
    }
}
