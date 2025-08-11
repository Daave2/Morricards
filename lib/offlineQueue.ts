
import { addCapture, listUnsynced, markSynced, type Capture } from './idb';

export async function queueCapture(c: Omit<Capture, 'id' | 'capturedAt' | 'synced'>) {
  const id = crypto.randomUUID();
  await addCapture({ id, capturedAt: Date.now(), synced: false, ...c });
  console.log('Queued capture:', id);
  return id;
}

export async function flushQueue() {
  const items = await listUnsynced();
  if (!items.length) {
    console.log('Sync flush: No items to sync.');
    return { synced: 0 };
  }
  
  console.log(`Sync flush: Attempting to sync ${items.length} items.`);
  
  // In a real app, this would POST to a server endpoint.
  // For this demo, we'll just simulate a successful sync.
  const res = await fetch('/api/health');

  if (!res.ok) {
    console.error('Sync flush: Health check failed, aborting sync.');
    throw new Error('sync-failed');
  }

  const acceptedIds = items.map(item => item.id);
  await markSynced(acceptedIds);
  console.log(`Sync flush: Successfully synced ${acceptedIds.length} items.`);
  
  return { synced: acceptedIds.length };
}
