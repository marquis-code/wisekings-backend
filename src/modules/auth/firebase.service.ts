import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
    private readonly logger = new Logger(FirebaseService.name);
    private firebaseApp: admin.app.App;
    private initialized = false;
    private readonly projectId: string;

    constructor(private configService: ConfigService) {
        this.projectId = 'wisekings-fe40a';
    }

    onModuleInit() {
        const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');
        const serviceAccountPath = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
        
        // Individual components
        const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
        const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
        const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

        try {
            if (projectId && privateKey && clientEmail) {
                this.logger.log('Firebase Admin: Initializing from individual environment variables');
                this.firebaseApp = admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId,
                        privateKey: privateKey.replace(/\\n/g, '\n'),
                        clientEmail
                    }),
                });
                this.initialized = true;
            } else if (serviceAccountPath) {
                const path = require('path');
                const resolvedPath = path.resolve(serviceAccountPath);
                this.logger.log(`Firebase Admin: Loading service account from: ${resolvedPath}`);
                const serviceAccount = require(resolvedPath);
                this.firebaseApp = admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                });
                this.initialized = true;
            } else if (serviceAccountJson) {
                const cleanedJson = serviceAccountJson.replace(/^['"]|['"]$/g, '').trim();
                const serviceAccount = JSON.parse(cleanedJson);
                if (serviceAccount.private_key) {
                    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
                }
                this.firebaseApp = admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                });
                this.initialized = true;
                this.logger.log('Firebase Admin: Initialized from inline JSON');
            } else {
                this.logger.warn('No Firebase service account found. Falling back to manual token verification.');
            }
        } catch (error) {
            this.logger.warn(`Firebase Admin SDK init failed: ${error.message}. Falling back to manual token verification.`);
        }

        if (!this.initialized) {
            this.logger.log('Using manual JWT verification for Firebase tokens (no Admin SDK).');
        }
    }

    async verifyIdToken(idToken: string): Promise<any> {
        // If Admin SDK is available, use it
        if (this.initialized && this.firebaseApp) {
            try {
                this.logger.debug(`Verifying Firebase ID Token via Admin SDK (length: ${idToken?.length})`);
                const decodedToken = await this.firebaseApp.auth().verifyIdToken(idToken);
                this.logger.debug(`Firebase token verified for: ${decodedToken.email}`);
                return decodedToken;
            } catch (error) {
                this.logger.error(`Admin SDK verification failed: ${error.message}`, error.stack);
                throw error;
            }
        }

        // Fallback: manually verify the Firebase ID token using Google's public keys
        this.logger.debug('Verifying Firebase ID Token via manual JWT verification');
        return this.verifyIdTokenManually(idToken);
    }

    private async verifyIdTokenManually(idToken: string): Promise<any> {
        const jwt = require('jsonwebtoken');
        const https = require('https');

        // 1. Decode header to get kid
        const decoded = jwt.decode(idToken, { complete: true });
        if (!decoded || !decoded.header || !decoded.header.kid) {
            throw new Error('Invalid Firebase ID token: cannot decode header');
        }

        const kid = decoded.header.kid;

        // 2. Fetch Google's public keys
        const publicKeys = await this.fetchGooglePublicKeys();
        const publicKey = publicKeys[kid];
        if (!publicKey) {
            throw new Error(`No matching public key found for kid: ${kid}`);
        }

        // 3. Verify the token
        try {
            const verifiedToken = jwt.verify(idToken, publicKey, {
                algorithms: ['RS256'],
                audience: this.projectId,
                issuer: `https://securetoken.google.com/${this.projectId}`,
            });

            this.logger.debug(`Firebase token manually verified for: ${verifiedToken.email}`);
            return verifiedToken;
        } catch (error) {
            this.logger.error(`Manual token verification failed: ${error.message}`);
            throw new Error(`Firebase token verification failed: ${error.message}`);
        }
    }

    private fetchGooglePublicKeys(): Promise<Record<string, string>> {
        return new Promise((resolve, reject) => {
            const https = require('https');
            const url = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

            https.get(url, (res: any) => {
                let data = '';
                res.on('data', (chunk: any) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const keys = JSON.parse(data);
                        resolve(keys);
                    } catch (e) {
                        reject(new Error('Failed to parse Google public keys'));
                    }
                });
            }).on('error', (err: any) => {
                reject(new Error(`Failed to fetch Google public keys: ${err.message}`));
            });
        });
    }
}
