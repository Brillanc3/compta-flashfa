// frontend/src/utils/security.js

/**
 * Derives a key from a salt and browser-specific identifiers.
 * This makes it much harder to decrypt the data on a different browser/machine.
 */
async function deriveKey(salt) {
    const fingerprint = [
        navigator.userAgent,
        screen.width,
        screen.height,
        navigator.language,
        navigator.hardwareConcurrency || 4
    ].join('|');

    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(fingerprint),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: encoder.encode(salt),
            iterations: 100000,
            hash: "SHA-256",
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts an object.
 * @param {Object} data 
 * @returns {Promise<string>} Base64 encoded JSON string {iv, data}
 */
export async function encryptData(data) {
    try {
        const salt = "ClarityAccounting_Premium_Salt_2024"; // Application salt
        const key = await deriveKey(salt);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            encoder.encode(JSON.stringify(data))
        );

        return JSON.stringify({
            iv: btoa(String.fromCharCode(...iv)),
            data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
        });
    } catch (err) {
        console.error("Encryption failed:", err);
        return null;
    }
}

/**
 * Decrypts data.
 * @param {string} encryptedJsonString 
 * @returns {Promise<Object|null>}
 */
export async function decryptData(encryptedJsonString) {
    try {
        if (!encryptedJsonString) return null;
        
        const { iv, data } = JSON.parse(encryptedJsonString);
        const salt = "ClarityAccounting_Premium_Salt_2024";
        const key = await deriveKey(salt);
        
        const ivBuffer = new Uint8Array(atob(iv).split("").map(c => c.charCodeAt(0)));
        const dataBuffer = new Uint8Array(atob(data).split("").map(c => c.charCodeAt(0)));

        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: ivBuffer },
            key,
            dataBuffer
        );

        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decrypted));
    } catch (err) {
        // This can happen if the browser fingerprint changed or salt changed
        console.warn("Decryption failed or invalid data:", err);
        return null;
    }
}
