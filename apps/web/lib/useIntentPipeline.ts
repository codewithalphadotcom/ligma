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

      // Defence in depth: even if a non-author somehow reaches this path,
      // bail out so only the node owner writes classification + task data.
      const nodeAuthor = String(node.get('authorId') ?? '');
      if (nodeAuthor !== authorId) return;

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

        // Only the node's author drives classification + task creation.
        // Otherwise every connected client races to push its own task for
        // the same node — Y.js can't dedupe across clients before sync, so
        // the Task Board ends up with one duplicate per active member.
        // The author owns the node, so their client is the single source
        // of truth for the auto-generated action item.
        const nodeAuthor = String(node.get('authorId') ?? '');
        if (nodeAuthor !== authorId) return;

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

    // One-shot dedupe pass: collapse any duplicate tasks already present in
    // the shared array (left over from before the author-only fix). To
    // avoid every client racing to mutate the same array, only the author
    // of a node prunes duplicates for that node — keep the earliest task
    // and drop the rest.
    {
      const arr = room.tasks.toArray() as TaskData[];
      const byNode = new Map<string, TaskData[]>();
      for (const t of arr) {
        const list = byNode.get(t.nodeId);
        if (list) list.push(t);
        else byNode.set(t.nodeId, [t]);
      }
      const removeIds = new Set<string>();
      for (const [nodeId, list] of byNode) {
        if (list.length <= 1) continue;
        const node = room.nodes.get(nodeId);
        if (!node) continue;
        const nodeAuthor = String(node.get('authorId') ?? '');
        if (nodeAuthor !== authorId) continue; // not our node — leave it
        list.sort((a, b) => a.createdAt - b.createdAt);
        for (let i = 1; i < list.length; i++) removeIds.add(list[i]!.id);
      }
      if (removeIds.size > 0) {
        room.doc.transact(() => {
          // Walk the array from the end so indices stay valid as we delete.
          for (let i = room.tasks.length - 1; i >= 0; i--) {
            const t = room.tasks.get(i) as TaskData;
            if (removeIds.has(t.id)) room.tasks.delete(i, 1);
          }
        }, 'task-dedupe');
      }
    }

    room.nodes.observeDeep(onNodesChange);
    return () => {
      room.nodes.unobserveDeep(onNodesChange);
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, [room, authorId, authorName]);
}
