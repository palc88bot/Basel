import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface VaultMetadata {
  version: number;
  cipher: 'aes-256-gcm';
  iterations: number;
  saltHex: string;
  ivHex: string;
  tagHex: string;
  ciphertextHex: string;
  updatedAt: string;
}

export interface VaultSecrets {
  ACTIVE_EXCHANGE?: 'BYBIT' | 'BINANCE';
  BYBIT_API_KEY?: string;
  BYBIT_API_SECRET?: string;
  BYBIT_TESTNET?: string; // "true" | "false"
  BINANCE_API_KEY?: string;
  BINANCE_API_SECRET?: string;
  BINANCE_TESTNET?: string; // "true" | "false"
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  [key: string]: string | undefined;
}

export interface VaultPublicStatus {
  isInitialized: boolean;
  isUnlocked: boolean;
  cipher: string;
  storageLocation: string;
  storedKeys: string[];
  maskedPreview: Record<string, string>;
  lastUpdated: string | null;
}

export class ServerSecretVault {
  private vaultFilePath: string;
  private inMemorySecrets: VaultSecrets | null = null;
  private currentMasterPassphrase: string | null = null;
  private listeners: Array<(secrets: VaultSecrets) => void> = [];

  constructor(customPath?: string) {
    const vaultDir = path.resolve(process.cwd(), 'data', '.vault');
    if (!fs.existsSync(vaultDir)) {
      try {
        fs.mkdirSync(vaultDir, { recursive: true });
      } catch (err) {
        console.error('[ServerSecretVault] Failed to create vault directory:', err);
      }
    }
    this.vaultFilePath = customPath || path.join(vaultDir, 'omega_secrets.vault.enc');

    // Auto-unlock if VAULT_PASSPHRASE or MASTER_KEY is passed in server environment
    const envPass = process.env.VAULT_PASSPHRASE || process.env.VAULT_MASTER_KEY;
    if (envPass && this.isInitialized()) {
      this.unlock(envPass).catch(err => {
        console.warn('[ServerSecretVault] Auto-unlock via env failed:', err.message);
      });
    } else if (envPass && !this.isInitialized() && (process.env.BYBIT_API_KEY || process.env.BINANCE_API_KEY)) {
      // Auto-bootstrap vault ONLY if explicit VAULT_PASSPHRASE is provided in environment
      this.initialize(envPass, {
        BYBIT_API_KEY: process.env.BYBIT_API_KEY || '',
        BYBIT_API_SECRET: process.env.BYBIT_API_SECRET || '',
        BYBIT_TESTNET: process.env.BYBIT_TESTNET || 'false',
        BINANCE_API_KEY: process.env.BINANCE_API_KEY || '',
        BINANCE_API_SECRET: process.env.BINANCE_API_SECRET || '',
        BINANCE_TESTNET: process.env.BINANCE_TESTNET || 'false',
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
        TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || ''
      }).catch(err => {
        console.error('[ServerSecretVault] Auto-bootstrap failed:', err);
      });
    } else if (!this.isInitialized()) {
      console.log('[ServerSecretVault] 🔒 Vault uninitialized. Please set VAULT_PASSPHRASE in .env or initialize via UI/API.');
    }
  }

  public isInitialized(): boolean {
    return fs.existsSync(this.vaultFilePath);
  }

  public isUnlocked(): boolean {
    return this.inMemorySecrets !== null;
  }

  public onUnlock(listener: (secrets: VaultSecrets) => void): void {
    this.listeners.push(listener);
    if (this.inMemorySecrets) {
      listener(this.inMemorySecrets);
    }
  }

  /**
   * Derive 256-bit AES key from passphrase using PBKDF2-HMAC-SHA512
   */
  private deriveKey(passphrase: string, salt: Buffer, iterations: number): Buffer {
    return crypto.pbkdf2Sync(passphrase, salt, iterations, 32, 'sha512');
  }

  /**
   * Encrypt raw secrets using AES-256-GCM
   */
  private encryptData(passphrase: string, secrets: VaultSecrets): VaultMetadata {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12); // 96-bit standard for GCM
    const iterations = 100000;

    const key = this.deriveKey(passphrase, salt, iterations);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const plaintext = Buffer.from(JSON.stringify(secrets), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      version: 1,
      cipher: 'aes-256-gcm',
      iterations,
      saltHex: salt.toString('hex'),
      ivHex: iv.toString('hex'),
      tagHex: tag.toString('hex'),
      ciphertextHex: encrypted.toString('hex'),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Decrypt vault payload using AES-256-GCM and verify auth tag
   */
  private decryptData(passphrase: string, metadata: VaultMetadata): VaultSecrets {
    const salt = Buffer.from(metadata.saltHex, 'hex');
    const iv = Buffer.from(metadata.ivHex, 'hex');
    const tag = Buffer.from(metadata.tagHex, 'hex');
    const ciphertext = Buffer.from(metadata.ciphertextHex, 'hex');

    const key = this.deriveKey(passphrase, salt, metadata.iterations || 100000);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  }

  /**
   * Initialize a fresh encrypted vault with initial secrets and passphrase
   */
  public async initialize(passphrase: string, initialSecrets: VaultSecrets = {}): Promise<void> {
    if (!passphrase || passphrase.trim().length < 6) {
      throw new Error('كلمة المرور الرئيسية للخزنة يجب أن تكون 6 أحرف على الأقل.');
    }

    const metadata = this.encryptData(passphrase.trim(), initialSecrets);
    fs.writeFileSync(this.vaultFilePath, JSON.stringify(metadata, null, 2), { mode: 0o600 });
    this.inMemorySecrets = initialSecrets;
    this.currentMasterPassphrase = passphrase.trim();

    this.notifyListeners();
    console.log('[ServerSecretVault] 🔒 Successfully initialized and encrypted vault at:', this.vaultFilePath);
  }

  /**
   * Unlock vault into protected server memory (auto-initializes if vault file does not exist yet)
   */
  public async unlock(passphrase: string): Promise<boolean> {
    if (!passphrase || passphrase.trim().length < 6) {
      throw new Error('كلمة المرور الرئيسية يجب أن تتكون من 6 خانات على الأقل.');
    }

    if (!this.isInitialized()) {
      await this.initialize(passphrase.trim(), {});
      console.log('[ServerSecretVault] 🔓 Vault auto-initialized on first unlock.');
      return true;
    }

    const raw = fs.readFileSync(this.vaultFilePath, 'utf8');
    const metadata: VaultMetadata = JSON.parse(raw);

    try {
      const secrets = this.decryptData(passphrase.trim(), metadata);
      this.inMemorySecrets = secrets;
      this.currentMasterPassphrase = passphrase.trim();
      this.notifyListeners();
      console.log('[ServerSecretVault] 🔓 Successfully unlocked secret vault in server memory.');
      return true;
    } catch (err: any) {
      throw new Error('فشل فك التشفير: كلمة المرور الرئيسية غير صحيحة أو تم العبث بملف الخزنة.');
    }
  }

  /**
   * Lock the vault and immediately zero memory
   */
  public lock(): void {
    if (this.inMemorySecrets) {
      for (const key of Object.keys(this.inMemorySecrets)) {
        this.inMemorySecrets[key] = undefined;
      }
    }
    this.inMemorySecrets = null;
    this.currentMasterPassphrase = null;
    console.log('[ServerSecretVault] 🔒 Vault locked. In-memory keys cleared.');
  }

  /**
   * Save or update secrets inside the encrypted vault
   */
  public async saveSecrets(newSecrets: Partial<VaultSecrets>, masterPassphrase?: string): Promise<void> {
    const passphrase = masterPassphrase || this.currentMasterPassphrase;
    if (!passphrase) {
      throw new Error('يجب تقديم كلمة المرور الرئيسية لتشفير وحفظ البيانات في الخزنة.');
    }

    if (!this.isInitialized()) {
      await this.initialize(passphrase, newSecrets as VaultSecrets);
      return;
    }

    const current = this.inMemorySecrets || {};
    const merged: VaultSecrets = {
      ...current,
      ...newSecrets
    };

    // Filter empty keys
    for (const key of Object.keys(merged)) {
      if (merged[key] === undefined || merged[key] === '') {
        delete merged[key];
      }
    }

    const metadata = this.encryptData(passphrase.trim(), merged);
    fs.writeFileSync(this.vaultFilePath, JSON.stringify(metadata, null, 2), { mode: 0o600 });
    this.inMemorySecrets = merged;
    this.currentMasterPassphrase = passphrase.trim();

    this.notifyListeners();
    console.log('[ServerSecretVault] 💾 Secrets successfully encrypted and persisted to disk.');
  }

  public getSecret(key: string): string | undefined {
    return this.inMemorySecrets?.[key];
  }

  public getAllSecrets(): VaultSecrets | null {
    return this.inMemorySecrets;
  }

  /**
   * Returns non-sensitive status for monitoring
   */
  public getStatus(): VaultPublicStatus {
    const isInit = this.isInitialized();
    const isUnl = this.isUnlocked();

    let storedKeys: string[] = [];
    let lastUpdated: string | null = null;

    if (isInit) {
      try {
        const raw = fs.readFileSync(this.vaultFilePath, 'utf8');
        const meta: VaultMetadata = JSON.parse(raw);
        lastUpdated = meta.updatedAt;
      } catch {
        // silent
      }
    }

    const maskedPreview: Record<string, string> = {};

    if (isUnl && this.inMemorySecrets) {
      storedKeys = Object.keys(this.inMemorySecrets).filter(k => Boolean(this.inMemorySecrets![k]));
      for (const k of storedKeys) {
        const val = this.inMemorySecrets[k] || '';
        if (val.length <= 6) {
          maskedPreview[k] = '••••••';
        } else {
          maskedPreview[k] = `${val.slice(0, 3)}••••••••${val.slice(-3)}`;
        }
      }
    }

    return {
      isInitialized: isInit,
      isUnlocked: isUnl,
      cipher: 'AES-256-GCM (PBKDF2 100,000 iter)',
      storageLocation: 'server://data/.vault/omega_secrets.vault.enc (mode 0600)',
      storedKeys,
      maskedPreview,
      lastUpdated
    };
  }

  private notifyListeners(): void {
    if (this.inMemorySecrets) {
      for (const listener of this.listeners) {
        try {
          listener(this.inMemorySecrets);
        } catch (err) {
          console.error('[ServerSecretVault] Listener callback error:', err);
        }
      }
    }
  }
}

// Global Singleton for the server instance
export const serverVault = new ServerSecretVault();
