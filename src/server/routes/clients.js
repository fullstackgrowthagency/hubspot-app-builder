import express from 'express';
import { addPortal, listPortals, removePortal } from '../../portals/service.js';

export const clientsRouter = express.Router();

clientsRouter.get('/', async (req, res) => {
  res.json(await listPortals());
});

clientsRouter.post('/', async (req, res) => {
  try {
    const { displayName, hubspotAccountId, personalAccessKey } = req.body;
    const portal = await addPortal({ displayName, hubspotAccountId, personalAccessKey });
    res.status(201).json(portal);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

clientsRouter.delete('/:portalSlug', async (req, res) => {
  const removed = await removePortal(req.params.portalSlug);
  if (!removed) return res.status(404).json({ error: 'Unknown client portal.' });
  res.status(204).end();
});
