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

                // Fix for private key newlines - handles both literal \n and real newlines
                if (serviceAccount.private_key) {
                    this.logger.debug(`Original key length: ${serviceAccount.private_key.length}`);
                    
                    // Replace literal \n with real newlines, then cleanup any accidentally joined lines
                    serviceAccount.private_key = serviceAccount.private_key
                        .replace(/\\n/g, '\n')
                        .replace(/\n\n/g, '\n') // Remove double newlines
                        .trim();

                    this.logger.debug(`Processed key length: ${serviceAccount.private_key.length}`);
                    require('fs').writeFileSync('/tmp/firebase_key_debug.txt', serviceAccount.private_key);
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
                this.logger.warn('No Firebase service account credentials found. Social auth will be disabled.');
            }
        } catch (error) {
            this.logger.error('Failed to initialize Firebase Admin', error);
            this.logger.error(`Service Account JSON present: ${!!serviceAccountJson}`);
            this.logger.error(`Service Account Path present: ${!!serviceAccountPath}`);
        }
    }

    async verifyIdToken(idToken: string) {
        if (!this.firebaseApp) {
            throw new Error('Firebase Admin not initialized');
        }
        try {
            this.logger.debug(`Verifying Firebase ID Token (length: ${idToken?.length})`);
            const decodedToken = await this.firebaseApp.auth().verifyIdToken(idToken);
            this.logger.debug(`Firebase token verified for: ${decodedToken.email}`);
            return decodedToken;
        } catch (error) {
            this.logger.error(`Firebase token verification failed: ${error.message}`, error.stack);
            throw error;
        }
    }
}
