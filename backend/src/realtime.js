const clients = new Map();
let nextClientId = 1;

function addClient(res, user) {
  const id = nextClientId++;
  clients.set(id, { res, userId: user.id, role: user.role });
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, at: new Date().toISOString() })}\n\n`);
  return () => clients.delete(id);
}

function publishUpdate(update) {
  const message = `event: update\ndata: ${JSON.stringify({ ...update, at: new Date().toISOString() })}\n\n`;
  for (const [id, client] of clients) {
    try { client.res.write(message); }
    catch { clients.delete(id); }
  }
}

const heartbeat = setInterval(() => {
  for (const [id, client] of clients) {
    try { client.res.write(`: heartbeat ${Date.now()}\n\n`); }
    catch { clients.delete(id); }
  }
}, 25000);
heartbeat.unref?.();

module.exports = { addClient, publishUpdate };
