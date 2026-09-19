import crypto from 'node:crypto';
import path from 'node:path';
import { getEnv } from '../config/env.js';
import { readJson, writeJson } from '../lib/fs.js';

function deriveKey(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptJson(data, secret) {
  const iv = crypto.randomBytes(12);
  const key = deriveKey(secret);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64')
  };
}

function decryptJson(record, secret) {
  const key = deriveKey(secret);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, 'base64')),
    decipher.final()
  ]);
  return JSON.parse(plaintext.toString('utf8'));
}

export class PortalStore {
  constructor() {
    const env = getEnv();
    this.secret = env.secretKey;
    this.filePath = path.join(env.dataDir, 'secrets', 'portals.json');
  }

  assertReady() {
    if (!this.secret) {
      throw new Error('HAB_SECRET_KEY is required for encrypted portal credential storage.');
    }
  }

  async list() {
    const items = (await readJson(this.filePath, [])) || [];
    return items.map((item) => ({
      portalSlug: item.portalSlug,
      displayName: item.displayName,
      hubspotAccountId: item.hubspotAccountId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));
  }

  async get(portalSlug) {
    const items = await this._raw();
    const record = items.find((item) => item.portalSlug === portalSlug);
    if (!record) return null;
    return {
      portalSlug: record.portalSlug,
      displayName: record.displayName,
      hubspotAccountId: record.hubspotAccountId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  async getSecret(portalSlug) {
    this.assertReady();
    const items = await this._raw();
    const record = items.find((item) => item.portalSlug === portalSlug);
    if (!record) return null;
    return {
      portalSlug: record.portalSlug,
      hubspotAccountId: record.hubspotAccountId,
      personalAccessKey: decryptJson(record.secret, this.secret).personalAccessKey
    };
  }

  async upsert(portalSlug, { displayName, hubspotAccountId, personalAccessKey }) {
    this.assertReady();
    const items = await this._raw();
    const now = new Date().toISOString();
    const existingIndex = items.findIndex((item) => item.portalSlug === portalSlug);
    const record = {
      portalSlug,
      displayName,
      hubspotAccountId,
      createdAt: existingIndex >= 0 ? items[existingIndex].createdAt : now,
      updatedAt: now,
      secret: encryptJson({ personalAccessKey }, this.secret)
    };

    if (existingIndex >= 0) items[existingIndex] = record;
    else items.push(record);

    await writeJson(this.filePath, items);
    return await this.get(portalSlug);
  }

  async delete(portalSlug) {
    const items = await this._raw();
    const next = items.filter((item) => item.portalSlug !== portalSlug);
    if (next.length === items.length) return false;
    await writeJson(this.filePath, next);
    return true;
  }

  async _raw() {
    return (await readJson(this.filePath, [])) || [];
  }
}
