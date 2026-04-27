import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { WebSocketServer } from 'ws';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'ligma-server', ts: Date.now() });
});

// TODO: mount routes
// app.use('/auth', authRoutes);
// app.use('/rooms', roomsRoutes);
// app.use('/intent', intentRoutes);

const PORT = Number(process.env.PORT ?? 8080);
const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
    // TODO: validate JWT token from query, route to room handler
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});

wss.on('connection', (ws) => {
    // TODO: y-websocket setupWSConnection per room, RBAC enforcement, event log writes
    ws.on('message', () => { /* placeholder */ });
});

server.listen(PORT, () => {
    console.log(`[ligma-server] listening on :${PORT}`);
});
