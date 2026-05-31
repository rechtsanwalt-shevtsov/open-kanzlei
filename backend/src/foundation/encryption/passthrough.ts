import type { EncryptionService } from './types.js';

/** MVP passthrough — no real encryption (Konzept.txt §9). */
export class PassthroughEncryptionService implements EncryptionService {
  async encrypt(plaintext: string): Promise<string> {
    return plaintext;
  }

  async decrypt(ciphertext: string): Promise<string> {
    return ciphertext;
  }
}

let instance: EncryptionService | undefined;

export function getEncryptionService(): EncryptionService {
  if (!instance) {
    instance = new PassthroughEncryptionService();
  }
  return instance;
}
