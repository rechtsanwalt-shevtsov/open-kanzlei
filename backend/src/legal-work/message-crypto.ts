import { getEncryptionService } from '../foundation/encryption/passthrough.js';

export async function sealText(value: string | null | undefined): Promise<Buffer | null> {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const encrypted = await getEncryptionService().encrypt(trimmed);
  return Buffer.from(encrypted, 'utf8');
}

export async function openText(buffer: Buffer | null): Promise<string | null> {
  if (!buffer || buffer.length === 0) return null;
  return getEncryptionService().decrypt(buffer.toString('utf8'));
}

export async function sealBinary(data: Buffer): Promise<Buffer> {
  const encrypted = await getEncryptionService().encrypt(data.toString('base64'));
  return Buffer.from(encrypted, 'utf8');
}

export async function openBinary(buffer: Buffer): Promise<Buffer> {
  const decrypted = await getEncryptionService().decrypt(buffer.toString('utf8'));
  return Buffer.from(decrypted, 'base64');
}
