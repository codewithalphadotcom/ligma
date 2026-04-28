/**
 * Integration tests for `validateAcls()` — the per-node ACL gate the
 * WebSocket handler runs against every incoming Yjs update before applying
 * it to the canonical room doc.
 *
 * These tests model the threat scenario from the LIGMA judging rubric:
 *   "judges will test by sending a raw WebSocket request"
 * — a Contributor crafting a binary Y.js update that targets a `lead-only`
 * node MUST be dropped server-side, not just blocked in the UI.
 */
import { describe, expect, test } from 'bun:test';
import * as Y from 'yjs';
import { validateAcls } from '../src/services/yjs-server.js';

function buildRoom(seed: (nodes: Y.Map<Y.Map<unknown>>) => void): Y.Doc {
    const doc = new Y.Doc();
    const nodes = doc.getMap<Y.Map<unknown>>('nodes');
    doc.transact(() => seed(nodes), 'seed');
    return doc;
}

function diffUpdate(server: Y.Doc, mutate: (clone: Y.Doc) => void): Uint8Array {
    const clone = new Y.Doc();
    Y.applyUpdate(clone, Y.encodeStateAsUpdate(server));
    const sv = Y.encodeStateVector(server);
    mutate(clone);
    return Y.encodeStateAsUpdate(clone, sv);
}

function makeNode(opts: {
    id: string;
    acl: 'all' | 'contributor+' | 'lead-only';
    authorId: string;
    x?: number;
    y?: number;
    content?: string;
}): Y.Map<unknown> {
    const m = new Y.Map<unknown>();
    m.set('id', opts.id);
    m.set('type', 'sticky');
    m.set('x', opts.x ?? 0);
    m.set('y', opts.y ?? 0);
    m.set('w', 200);
    m.set('h', 100);
    m.set('color', '#fff');
    m.set('authorId', opts.authorId);
    m.set('acl', opts.acl);
    m.set('classification', null);
    m.set('taskId', null);
    m.set('comments', new Y.Array());
    m.set('createdAt', 0);
    m.set('updatedAt', 0);
    m.set('fontSize', 14);
    m.set('fill', 'solid');
    const text = new Y.Text();
    if (opts.content) text.insert(0, opts.content);
    m.set('content', text);
    return m;
}

describe('validateAcls()', () => {
    test('contributor can mutate an "all" node', () => {
        const server = buildRoom((nodes) => {
            nodes.set('a', makeNode({ id: 'a', acl: 'all', authorId: 'u1' }));
        });
        const update = diffUpdate(server, (clone) => {
            const nodes = clone.getMap<Y.Map<unknown>>('nodes');
            const n = nodes.get('a')!;
            n.set('x', 999);
            n.set('updatedAt', Date.now());
        });
        const r = validateAcls(server, update, 'contributor');
        expect(r.ok).toBe(true);
    });

    test('contributor mutating a lead-only node is REJECTED', () => {
        const server = buildRoom((nodes) => {
            nodes.set('a', makeNode({ id: 'a', acl: 'lead-only', authorId: 'lead1' }));
        });
        const update = diffUpdate(server, (clone) => {
            const n = clone.getMap<Y.Map<unknown>>('nodes').get('a')!;
            n.set('x', 999);
        });
        const r = validateAcls(server, update, 'contributor');
        expect(r.ok).toBe(false);
    });

    test('lead can mutate a lead-only node', () => {
        const server = buildRoom((nodes) => {
            nodes.set('a', makeNode({ id: 'a', acl: 'lead-only', authorId: 'lead1' }));
        });
        const update = diffUpdate(server, (clone) => {
            const n = clone.getMap<Y.Map<unknown>>('nodes').get('a')!;
            n.set('x', 42);
        });
        const r = validateAcls(server, update, 'lead');
        expect(r.ok).toBe(true);
    });

    test('contributor changing ACL field is REJECTED (privilege escalation)', () => {
        const server = buildRoom((nodes) => {
            nodes.set('a', makeNode({ id: 'a', acl: 'all', authorId: 'u1' }));
        });
        const update = diffUpdate(server, (clone) => {
            const n = clone.getMap<Y.Map<unknown>>('nodes').get('a')!;
            n.set('acl', 'lead-only');
        });
        const r = validateAcls(server, update, 'contributor');
        expect(r.ok).toBe(false);
    });

    test('lead can change ACL field', () => {
        const server = buildRoom((nodes) => {
            nodes.set('a', makeNode({ id: 'a', acl: 'all', authorId: 'lead1' }));
        });
        const update = diffUpdate(server, (clone) => {
            const n = clone.getMap<Y.Map<unknown>>('nodes').get('a')!;
            n.set('acl', 'lead-only');
        });
        const r = validateAcls(server, update, 'lead');
        expect(r.ok).toBe(true);
    });

    test('contributor commenting on a lead-only node is ALLOWED', () => {
        // Per spec: "Even Viewers can still comment on locked nodes."
        const server = buildRoom((nodes) => {
            nodes.set('a', makeNode({ id: 'a', acl: 'lead-only', authorId: 'lead1' }));
        });
        const update = diffUpdate(server, (clone) => {
            const n = clone.getMap<Y.Map<unknown>>('nodes').get('a')!;
            const comments = n.get('comments') as Y.Array<unknown>;
            comments.push([
                {
                    id: 'c1',
                    authorId: 'u2',
                    authorName: 'Bob',
                    color: '#fff',
                    text: 'looks good',
                    createdAt: Date.now(),
                },
            ]);
        });
        const r = validateAcls(server, update, 'contributor');
        expect(r.ok).toBe(true);
    });

    test('contributor deleting a lead-only node is REJECTED', () => {
        const server = buildRoom((nodes) => {
            nodes.set('a', makeNode({ id: 'a', acl: 'lead-only', authorId: 'lead1' }));
        });
        const update = diffUpdate(server, (clone) => {
            clone.getMap<Y.Map<unknown>>('nodes').delete('a');
        });
        const r = validateAcls(server, update, 'contributor');
        expect(r.ok).toBe(false);
    });

    test('contributor creating a new node is ALLOWED', () => {
        const server = buildRoom(() => {
            // empty room
        });
        const update = diffUpdate(server, (clone) => {
            const nodes = clone.getMap<Y.Map<unknown>>('nodes');
            nodes.set('b', makeNode({ id: 'b', acl: 'all', authorId: 'contrib1' }));
        });
        const r = validateAcls(server, update, 'contributor');
        expect(r.ok).toBe(true);
    });

    test('contributor editing text content of lead-only node is REJECTED', () => {
        const server = buildRoom((nodes) => {
            nodes.set(
                'a',
                makeNode({ id: 'a', acl: 'lead-only', authorId: 'lead1', content: 'hello' }),
            );
        });
        const update = diffUpdate(server, (clone) => {
            const n = clone.getMap<Y.Map<unknown>>('nodes').get('a')!;
            const text = n.get('content') as Y.Text;
            text.insert(text.length, ' world');
        });
        const r = validateAcls(server, update, 'contributor');
        expect(r.ok).toBe(false);
    });

    test('mixed batch: one allowed + one forbidden node mutation is REJECTED whole', () => {
        const server = buildRoom((nodes) => {
            nodes.set('a', makeNode({ id: 'a', acl: 'all', authorId: 'u1' }));
            nodes.set('b', makeNode({ id: 'b', acl: 'lead-only', authorId: 'lead1' }));
        });
        const update = diffUpdate(server, (clone) => {
            const nodes = clone.getMap<Y.Map<unknown>>('nodes');
            (nodes.get('a') as Y.Map<unknown>).set('x', 1);
            (nodes.get('b') as Y.Map<unknown>).set('x', 2);
        });
        const r = validateAcls(server, update, 'contributor');
        expect(r.ok).toBe(false);
    });

    test('malformed update is REJECTED gracefully', () => {
        const server = buildRoom(() => { });
        const garbage = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
        const r = validateAcls(server, garbage, 'contributor');
        expect(r.ok).toBe(false);
    });
});
