'use client';

import { useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import type { RoomHandle } from './yjs';
import { api } from './api';

const DEBOUNCE_MS = 1500;

interface TaskData {
  id: string;
  nodeId: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  status: 'open' | 'done';
}

/**
 * Watches every node's text content. After 1.5s of inactivity on a node,
 * calls /intent to classify it. If the classification is 'action-item' and
 * the node has no taskId yet, a task is pushed into the shared Y.js tasks
 * array so the Task Board updates live for all users.
 */
export function useIntentPipeline(room: RoomHandle | null, authorId: string, authorName: string) {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const processing = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!room) return;

    async function classifyNode(nodeId: string) {
      if (!room) return;
      if (processing.current.has(nodeId)) return;

      const node = room.nodes.get(nodeId);
      if (!node) return;

      const raw = node.get('content');
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (text.length < 3) return;

      processing.current.add(nodeId);
      try {
        const { label } = await api.classifyIntent(text);

        // Normalise label → NodeClassification value
        const classification =
          label === 'action item' ? 'action-item' :
          label === 'open question' ? 'open-question' :
          label as 'decision' | 'reference';

        room.doc.transact(() => {
          node.set('classification', classification);
        }, `node:${nodeId}:classify`);

        // Push a task only once per node (check taskId)
        if (classification === 'action-item' && !node.get('taskId')) {
          const taskId = nanoid();
          const task: TaskData = {
            id: taskId,
            nodeId,
            authorId,
            authorName,
            createdAt: Date.now(),
            status: 'open',
          };
          room.doc.transact(() => {
            node.set('taskId', taskId);
            room.tasks.push([task]);
          }, 'task_created');
        }
      } catch {
        // intent API unavailable — silently skip
      } finally {
        processing.current.delete(nodeId);
      }
    }

    function onNodesChange() {
      if (!room) return;
      room.nodes.forEach((node, nodeId) => {
        const type = node.get('type') as string;
        // Only classify text-bearing nodes (sticky + text block)
        if (type !== 'sticky' && type !== 'text') return;

        const existing = timers.current.get(nodeId);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          timers.current.delete(nodeId);
          void classifyNode(nodeId);
        }, DEBOUNCE_MS);
        timers.current.set(nodeId, t);
      });
    }

    room.nodes.observeDeep(onNodesChange);
    return () => {
      room.nodes.unobserveDeep(onNodesChange);
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, [room, authorId, authorName]);
}
