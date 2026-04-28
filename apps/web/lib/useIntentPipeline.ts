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
  // Tracks the last text we classified per node so we don't re-call Groq
  // on every observeDeep tick (which fires when *we* write 'classification'
  // back to the node, otherwise causing an infinite reclassification loop).
  const lastClassifiedText = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!room) return;

    async function classifyNode(nodeId: string) {
      if (!room) return;
      if (processing.current.has(nodeId)) return;

      const node = room.nodes.get(nodeId);
      if (!node) return;

      const raw = node.get('content');
      // content is stored as Y.Text (CRDT), not a plain string
      const text = (raw && typeof (raw as { toString(): string }).toString === 'function'
        ? (raw as { toString(): string }).toString()
        : String(raw ?? '')
      ).trim();
      if (text.length < 3) return;

      // Skip if we already classified this exact text for this node
      if (lastClassifiedText.current.get(nodeId) === text) return;

      processing.current.add(nodeId);
      // Mark as classified BEFORE the API call so concurrent observeDeep
      // ticks (caused by our own writes) don't queue another request.
      lastClassifiedText.current.set(nodeId, text);
      console.log('[intent] classifying node', nodeId, '->', JSON.stringify(text.slice(0, 60)));
      try {
        const { label, confidence } = await api.classifyIntent(text);
        console.log('[intent] result', { label, confidence });

        // Skip low-confidence results so we don't spam the canvas with
        // dubious badges or false-positive tasks. The keyword fallback
        // returns 0.5–0.6, Groq typically returns >=0.7 on real text.
        if (typeof confidence === 'number' && confidence < 0.55) return;

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
      } catch (err) {
        console.error('[intent] classify failed for', nodeId, err);
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

        // Cheap pre-check: skip nodes whose text we already classified.
        // This avoids resetting the debounce timer on every observeDeep
        // tick triggered by our own classification/taskId writes.
        const raw = node.get('content');
        const text = (raw && typeof (raw as { toString(): string }).toString === 'function'
          ? (raw as { toString(): string }).toString()
          : String(raw ?? '')
        ).trim();
        if (text.length < 3) return;
        if (lastClassifiedText.current.get(nodeId) === text) return;

        const existing = timers.current.get(nodeId);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          timers.current.delete(nodeId);
          void classifyNode(nodeId);
        }, DEBOUNCE_MS);
        timers.current.set(nodeId, t);
      });
    }

    // Seed the cache on mount so existing classified nodes (e.g. from a
    // page reload of a populated room) don't trigger a fresh Groq call.
    room.nodes.forEach((node, nodeId) => {
      if (node.get('classification')) {
        const raw = node.get('content');
        const text = (raw && typeof (raw as { toString(): string }).toString === 'function'
          ? (raw as { toString(): string }).toString()
          : String(raw ?? '')
        ).trim();
        if (text) lastClassifiedText.current.set(nodeId, text);
      }
    });

    room.nodes.observeDeep(onNodesChange);
    return () => {
      room.nodes.unobserveDeep(onNodesChange);
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, [room, authorId, authorName]);
}
