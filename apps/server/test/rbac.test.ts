import { describe, expect, test } from 'bun:test';
import { canMutate, canEditNode, type RoomRole, type NodeAcl } from '../src/services/rbac.js';

describe('canMutate()', () => {
    const matrix: Array<{ role: RoomRole | null; expected: boolean }> = [
        { role: 'lead', expected: true },
        { role: 'contributor', expected: true },
        { role: 'viewer', expected: false },
        { role: null, expected: false },
    ];

    for (const { role, expected } of matrix) {
        test(`role=${role ?? 'null'} -> ${expected}`, () => {
            expect(canMutate(role)).toBe(expected);
        });
    }
});

describe('canEditNode()', () => {
    const cases: Array<{ role: RoomRole; acl: NodeAcl; expected: boolean }> = [
        // 'all' — anyone in the room
        { role: 'lead', acl: 'all', expected: true },
        { role: 'contributor', acl: 'all', expected: true },
        { role: 'viewer', acl: 'all', expected: false },
        // 'contributor+' — Lead + Contributor only
        { role: 'lead', acl: 'contributor+', expected: true },
        { role: 'contributor', acl: 'contributor+', expected: true },
        { role: 'viewer', acl: 'contributor+', expected: false },
        // 'lead-only' — Lead only
        { role: 'lead', acl: 'lead-only', expected: true },
        { role: 'contributor', acl: 'lead-only', expected: false },
        { role: 'viewer', acl: 'lead-only', expected: false },
    ];

    for (const { role, acl, expected } of cases) {
        test(`role=${role}, acl=${acl} -> ${expected}`, () => {
            expect(canEditNode(role, acl)).toBe(expected);
        });
    }

    test('null role cannot edit any locked node', () => {
        expect(canEditNode(null, 'lead-only')).toBe(false);
        expect(canEditNode(null, 'contributor+')).toBe(false);
    });
});
