/**
 * JUNO CHAT E2E Encryption Utility
 * uses Web Crypto API (SubtleCrypto)
 * 
 * Flow:
 * 1. Each user generates an RSA-OAEP key pair.
 * 2. Public key is shared via JUNO API (stored in User table).
 * 3. Private key is stored ONLY in the user's browser (localStorage).
 * 
 * Message Sending:
 * 1. Generate a random AES-GCM (256-bit) "Session Key".
 * 2. Encrypt the message body with the Session Key and a random IV.
 * 3. Encrypt the Session Key twice: 
 *    - Once with the Sender's RSA Public Key.
 *    - Once with the Receiver's RSA Public Key.
 * 4. Send [EncryptedBody, EncryptedKeyForSender, EncryptedKeyForReceiver, IV] to JUNO.
 * 
 * Message Receiving:
 * 1. Fetch [EncryptedBody, EncryptedKeyForReceiver, IV].
 * 2. Decrypt the EncryptedKeyForReceiver using the Receiver's RSA Private Key.
 * 3. Use the decrypted Session Key + IV to decrypt the Message Body.
 */

export class ChatCrypto {
    static async generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true,
            ["encrypt", "decrypt"]
        );

        const exportedPublic = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
        const exportedPrivate = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

        return {
            publicKey: btoa(String.fromCharCode(...new Uint8Array(exportedPublic))),
            privateKey: btoa(String.fromCharCode(...new Uint8Array(exportedPrivate))),
        };
    }

    static async encryptMessage(
        message: string,
        senderPublicKeyStr: string,
        receiverPublicKeyStr: string
    ): Promise<{ encryptedContent: string; encryptedKeyForSender: string; encryptedKeyForReceiver: string; iv: string }> {
        // 1. Generate AES Session Key
        const sessionKey = await window.crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );

        // 2. Encrypt Content with AES
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encodedContent = new TextEncoder().encode(message);
        const encryptedContentBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            sessionKey,
            encodedContent
        );

        // 3. Encrypt AES Key with both Public Keys
        const senderPublicKey = await this.importPublicKey(senderPublicKeyStr);
        const receiverPublicKey = await this.importPublicKey(receiverPublicKeyStr);

        const exportedSessionKey = await window.crypto.subtle.exportKey("raw", sessionKey);

        const encryptedKeyForSender = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            senderPublicKey,
            exportedSessionKey
        );

        const encryptedKeyForReceiver = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            receiverPublicKey,
            exportedSessionKey
        );

        return {
            encryptedContent: this.bufferToBase64(encryptedContentBuffer),
            encryptedKeyForSender: this.bufferToBase64(encryptedKeyForSender),
            encryptedKeyForReceiver: this.bufferToBase64(encryptedKeyForReceiver),
            iv: this.bufferToBase64(iv),
        };
    }

    static async decryptMessage(
        encryptedContentBase64: string,
        encryptedSessionKeyBase64: string,
        ivBase64: string,
        privateKeyStr: string
    ): Promise<string> {
        const privateKey = await this.importPrivateKey(privateKeyStr);
        const encryptedSessionKey = this.base64ToBuffer(encryptedSessionKeyBase64);
        const iv = this.base64ToBuffer(ivBase64);
        const encryptedContent = this.base64ToBuffer(encryptedContentBase64);

        // 1. Decrypt AES Key using RSA Private Key
        const decryptedSessionKeyBuffer = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            encryptedSessionKey.buffer as ArrayBuffer
        );

        const sessionKey = await window.crypto.subtle.importKey(
            "raw",
            decryptedSessionKeyBuffer,
            "AES-GCM",
            true,
            ["decrypt"]
        );

        // 2. Decrypt Content using AES Session Key
        const decryptedContentBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
            sessionKey,
            encryptedContent.buffer as ArrayBuffer
        );

        return new TextDecoder().decode(decryptedContentBuffer);
    }

    private static async importPublicKey(keyStr: string): Promise<CryptoKey> {
        const binary = this.base64ToBuffer(keyStr);
        return window.crypto.subtle.importKey(
            "spki",
            binary.buffer as ArrayBuffer,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["encrypt"]
        );
    }

    private static async importPrivateKey(keyStr: string): Promise<CryptoKey> {
        const binary = this.base64ToBuffer(keyStr);
        return window.crypto.subtle.importKey(
            "pkcs8",
            binary.buffer as ArrayBuffer,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["decrypt"]
        );
    }

    private static bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        return btoa(String.fromCharCode(...bytes));
    }

    private static base64ToBuffer(base64: string): Uint8Array {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
}
