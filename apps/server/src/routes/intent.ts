import { Router, Request, Response } from 'express';
import { classifyIntent } from '@/services/ai-intent.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { text } = req.body as { text?: unknown };
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  const result = await classifyIntent(text.trim());
  res.json(result);
});

export default router;
