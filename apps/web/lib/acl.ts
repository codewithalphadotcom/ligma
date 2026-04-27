/**
 * Node-level ACL helpers (A9).
 *
 * Each node carries one of three lock levels:
 *   - 'all'           — anyone in the room (incl. Viewers) can edit
 *   - 'contributor+'  — Lead and Contributor can edit; Viewer is read-only
 *   - 'lead-only'     — only Lead can edit; everyone else read-only
 *
 * Comments work the other way around: per spec, even Viewers can comment on
 * locked nodes ("contributors can still comment").
 */

import type { NodeAcl, RoomRole } from './types';

/** Can the given user role edit a node with this ACL? */
export function canEditNode(role: RoomRole, acl: NodeAcl): boolean {
    if (acl === 'all') return true;
    if (acl === 'contributor+') return role === 'lead' || role === 'contributor';
    if (acl === 'lead-only') return role === 'lead';
    return false;
}

/**
 * Per spec, comments are open to everyone — including Viewers — on every
 * node, regardless of edit-lock state.
 */
export function canCommentOnNode(_role: RoomRole, _acl: NodeAcl): boolean {
    return true;
}

/** Human-readable label for an ACL value. Used in the role popover UI. */
export function aclLabel(acl: NodeAcl): string {
    switch (acl) {
        case 'all':
            return 'Open';
        case 'contributor+':
            return 'Contributors+';
        case 'lead-only':
            return 'Lead-only';
    }
}
