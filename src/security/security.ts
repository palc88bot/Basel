// src/security/security.ts
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export class SecurityManager {
    private encryptionKey: Buffer;
    private algorithm = 'aes-256-gcm';
    private killSwitchTriggered = false;

    constructor() {
        const key = process.env.ENCRYPTION_KEY;
        if (!key || key.length < 32) {
            throw new Error('❌ ENCRYPTION_KEY must be at least 32 characters');
        }
        this.encryptionKey = crypto.createHash('sha256').update(key).digest();
    }

    encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = (cipher as any).getAuthTag();
        
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }

    decrypt(encryptedText: string): string {
        const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
        
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        
        const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
        (decipher as any).setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    saveCredentials(apiKey: string, apiSecret: string, filePath: string = './credentials/encrypted.json'): void {
        const credentials = {
            apiKey: this.encrypt(apiKey),
            apiSecret: this.encrypt(apiSecret),
            createdAt: Date.now()
        };
        
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        }
        
        fs.writeFileSync(filePath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
        console.log('✅ Credentials saved (encrypted)');
    }

    loadCredentials(filePath: string = './credentials/encrypted.json'): { apiKey: string; apiSecret: string } {
        if (!fs.existsSync(filePath)) {
            throw new Error('❌ Credentials file not found. Run setup first.');
        }
        
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        return {
            apiKey: this.decrypt(data.apiKey),
            apiSecret: this.decrypt(data.apiSecret)
        };
    }

    triggerKillSwitch(reason: string): void {
        this.killSwitchTriggered = true;
        console.error(`\n🚨 KILL SWITCH ACTIVATED: ${reason}`);
        console.error('🛑 All trading operations STOPPED\n');
        
        this.sendEmergencyAlert(reason);
    }

    isKillSwitchTriggered(): boolean {
        return this.killSwitchTriggered;
    }

    private sendEmergencyAlert(reason: string): void {
        const webhook = process.env.EMERGENCY_WEBHOOK;
        if (webhook) {
            fetch(webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `🚨 EMERGENCY: ${reason}\nTime: ${new Date().toISOString()}`
                })
            }).catch(err => console.error('Failed to send alert:', err));
        }
    }

    validateEnvironment(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        if (!process.env.ENCRYPTION_KEY) errors.push('ENCRYPTION_KEY missing');
        if (!process.env.EXCHANGE_API_KEY) errors.push('EXCHANGE_API_KEY missing');
        if (!process.env.EXCHANGE_API_SECRET) errors.push('EXCHANGE_API_SECRET missing');
        
        if (process.env.ENABLE_TELEGRAM === 'true') {
            if (!process.env.TELEGRAM_BOT_TOKEN) errors.push('TELEGRAM_BOT_TOKEN missing');
            if (!process.env.TELEGRAM_CHAT_ID) errors.push('TELEGRAM_CHAT_ID missing');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

export function signBinanceRequest(queryString: string, apiSecret: string): string {
    return crypto
        .createHmac('sha256', apiSecret)
        .update(queryString)
        .digest('hex');
}
