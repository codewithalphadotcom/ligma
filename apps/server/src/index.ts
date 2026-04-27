import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import authRoutes from '@/routes/auth.js';
import roomsRoutes from '@/routes/rooms.js';
import { handleConnection } from '@/services/yjs-server.js';
import type { AuthPayload } from '@/middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'ligma-server', ts: Date.now() });
});

app.use('/auth', authRoutes);
app.use('/rooms', roomsRoutes);

const PORT = Number(process.env.PORT ?? 8080);
const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    const match = url.pathname.match(/^\/room\/([^/]+)$/);

    if (!match) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
    }

    const roomId = match[1];
    const token = url.searchParams.get('token');

    if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }

    let payload: AuthPayload;
    try {
        payload = jwt.verify(token, JWT_SECRET as string) as AuthPayload;
    } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
        handleConnection(ws, roomId, payload.userId);
    });
});

server.listen(PORT, () => {
    console.log(`[ligma-server] listening on :${PORT}`);
});
