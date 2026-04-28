'use client';

/**
 * CanvasNodeLayer — dispatches each NodeSnapshot to its renderer component.
 * Lives inside the world-transform container so node positions are in world
 * coordinates.
 */

import * as Y from 'yjs';
import type { NodeSnapshot, RoomRole } from '@/lib/types';
import { StickyNote } from './StickyNote';
import { ShapeNode } from './ShapeNode';
import { TextBlockNode } from './TextBlockNode';
import { StrokeNode } from './StrokeNode';

interface CanvasNodeLayerProps {
    nodes: NodeSnapshot[];
    yNodes: Y.Map<Y.Map<unknown>>;
    zoom: number;
    roomRole: RoomRole;
}

export function CanvasNodeLayer({
    nodes,
    yNodes,
    zoom,
    roomRole,
}: CanvasNodeLayerProps) {
    return (
        <>
            {nodes.map((n) => {
                switch (n.type) {
                    case 'sticky':
                        return (
                            <StickyNote
                                key={n.id}
                                node={n}
                                yNodes={yNodes}
                                zoom={zoom}
                                roomRole={roomRole}
                            />
                        );
                    case 'rect':
                    case 'circle':
                    case 'triangle':
                    case 'diamond':
                    case 'hexagon':
                    case 'pentagon':
                    case 'star':
                    case 'parallelogram':
                    case 'line':
                    case 'arrow':
                        return (
                            <ShapeNode
                                key={n.id}
                                node={n}
                                yNodes={yNodes}
                                zoom={zoom}
                                roomRole={roomRole}
                            />
                        );
                    case 'text':
                        return (
                            <TextBlockNode
                                key={n.id}
                                node={n}
                                yNodes={yNodes}
                                zoom={zoom}
                                roomRole={roomRole}
                            />
                        );
                    case 'stroke':
                        return <StrokeNode key={n.id} node={n} roomRole={roomRole} />;
                    default:
                        return null;
                }
            })}
        </>
    );
}

