import { PortalStore } from './store.js';
import { slugify } from '../lib/slug.js';

const store = new PortalStore();

export async function listPortals() {
  return store.list();
}

export async function getPortal(portalSlug) {
  return store.get(portalSlug);
}

export async function getPortalCredentials(portalSlug) {
  const secret = await store.getSecret(portalSlug);
  if (!secret) throw new Error(`Unknown client portal: ${portalSlug}`);
  return secret;
}

export async function addPortal({ displayName, hubspotAccountId, personalAccessKey }) {
  if (!displayName || !hubspotAccountId || !personalAccessKey) {
    throw new Error('displayName, hubspotAccountId, and personalAccessKey are all required.');
  }
  const portalSlug = slugify(displayName);
  if (!portalSlug) throw new Error('displayName must contain at least one alphanumeric character.');
  return store.upsert(portalSlug, { displayName, hubspotAccountId, personalAccessKey });
}

export async function removePortal(portalSlug) {
  return store.delete(portalSlug);
}
