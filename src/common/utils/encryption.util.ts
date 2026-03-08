import * as CryptoJS from 'crypto-js';

export class EncryptionUtil {
    private static key: string;

    static init(key: string) {
        EncryptionUtil.key = key;
    }

    static encrypt(text: string): string {
        if (!text) return text;
        return CryptoJS.AES.encrypt(text, EncryptionUtil.key).toString();
    }

    static decrypt(cipherText: string): string {
        if (!cipherText) return cipherText;
        const bytes = CryptoJS.AES.decrypt(cipherText, EncryptionUtil.key);
        return bytes.toString(CryptoJS.enc.Utf8);
    }
}
