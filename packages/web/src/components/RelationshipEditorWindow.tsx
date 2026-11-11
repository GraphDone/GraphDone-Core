import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Minimize2, Maximize2, Move, Zap } from 'lucide-react';
import { WorkItemEdge, RelationshipType } from '../types/graph';
import { getRelationshipConfig, RELATIONSHIP_OPTIONS, getRelationshipIconElement } from '../constants/workItemConstants';
import { useApolloClient, useMutation } from '@apollo/client';
import { UPDATE_EDGE, CREATE_EDGE, DELETE_EDGE, GET_RELATIONSHIP } from '../lib/queries';
import { editorEdge, editorPlacement, flipRelationship, relationshipLine, savedRelationship, type ScreenBox } from '../lib/relationshipEdit';

interface RelationshipEditorWindowProps {
  /**
   * The relationship being edited; the window is shown only while there is
   * one. `position` is where it was pressed; `avoid` is the screen box of its
   * two items, which the window opens beside when there is room.
   */
  editingEdge: { edge: WorkItemEdge; position: { x: number; y: number }; avoid?: ScreenBox } | null;
  workItems: any[];
  onClose: () => void;
  /** The edited relationship as saved after a type change or a flip (a flip gives it a new id). */
  onEdgeChange: (edge: WorkItemEdge, previousId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  showSuccess: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
}

type Busy = 'type' | 'flip' | 'delete' | null;
const REFRESH = ['GetEdges', 'GetWorkItems'];
const sentence = (error: unknown, fallback: string) => {
  const text = (error instanceof Error ? error.message : '').trim();
  return text ? (/[.!?]$/.test(text) ? text : `${text}.`) : fallback;
};

export const RelationshipEditorWindow: React.FC<RelationshipEditorWindowProps> = ({
  editingEdge,
  workItems,
  onClose,
  onEdgeChange,
  onDeleteEdge,
  showSuccess,
  showError,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  // One change at a time: a second press while a save is in flight would race
  // it (two flips would each create a reversed copy).
  const [busy, setBusy] = useState<Busy>(null);
  const busyRef = useRef<Busy>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const client = useApolloClient();

  // Every change waits for the refreshed edge lists, so the canvas shows the
  // saved relationship before the editor accepts the next change.
  const [updateEdgeMutation] = useMutation(UPDATE_EDGE, { refetchQueries: REFRESH, awaitRefetchQueries: true });
  const [deleteEdgeMutation] = useMutation(DELETE_EDGE, { refetchQueries: REFRESH, awaitRefetchQueries: true });

  // Calculate content-based height
  const calculateContentHeight = () => {
    // Base header height
    let contentHeight = 50; // Header height
    
    if (isExpanded) {
      contentHeight += 16; // Padding top/bottom (p-4)
      contentHeight += 24; // Status indicator
      contentHeight += 16; // Spacing
      
      contentHeight += 20; // "Relationship Type" label
      contentHeight += 12; // margin bottom

      // Grid: 3 columns, calculate rows needed
      const rows = Math.ceil(RELATIONSHIP_OPTIONS.length / 3);
      contentHeight += rows * (80 + 8); // Each button ~80px height + 8px gap
      contentHeight -= 8; // Remove last gap

      // Actions
      contentHeight += 16; // Padding top for border
      contentHeight += 40; // Flip button
      contentHeight += 8;  // Gap
      contentHeight += 40; // Delete button

      // Add some extra padding for safety
      contentHeight += 16;
    }
    
    return contentHeight;
  };

  // Initialize position and auto-calculate height based on content
  useEffect(() => {
    // Fit the screen: on a phone the window spans the width (8px margins),
    // starts below any fixed top banner (the body is padded by its height)
    // and scrolls its content when taller than the screen.
    const narrow = window.innerWidth < 640;
    const margin = narrow ? 8 : 24;
    const width = Math.min(isExpanded ? 450 : 350, window.innerWidth - 2 * margin);
    const top = (parseFloat(getComputedStyle(document.body).paddingTop) || 0) + margin;
    const contentHeight = Math.min(calculateContentHeight(), window.innerHeight - top - margin);

    // Never obstruct the edge being edited: the window opens beside its two
    // items when there is room, else beside the pressed point.
    const click = editingEdge?.position;
    if (click) {
      setPosition(editorPlacement({
        click, avoid: editingEdge?.avoid, width, height: contentHeight,
        viewport: { width: window.innerWidth, height: window.innerHeight }, top, margin, narrow,
      }));
    } else {
      const sidebarWidth = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width') || '16rem';
      const sidebarPixels = sidebarWidth === '4rem' ? 64 : 256;
      setPosition(narrow ? { x: (window.innerWidth - width) / 2, y: top } : { x: sidebarPixels + 16, y: Math.max(top, 180) });
    }

    setSize({ width, height: contentHeight });
    // Place the window when it opens (a new click position), not after each
    // change to the relationship it edits.
    // eslint-disable-next-line
  }, [isExpanded, editingEdge?.position]);

  // Handle dragging
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      requestAnimationFrame(() => {
        setPosition({ x: Math.max(0, newX), y: Math.max(0, newY) });
      });
    }
    if (isResizing) {
      const minWidth = 350;
      const minHeight = calculateContentHeight(); // Use content-based minimum height
      const newWidth = Math.max(minWidth, resizeStart.width + (e.clientX - resizeStart.x));
      const newHeight = Math.max(minHeight, resizeStart.height + (e.clientY - resizeStart.y));
      requestAnimationFrame(() => {
        setSize({ width: newWidth, height: newHeight });
      });
    }
  }, [isDragging, isResizing, dragStart, resizeStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
  };

  const begin = (kind: Exclude<Busy, null>) => {
    if (busyRef.current) return false;
    busyRef.current = kind;
    setBusy(kind);
    return true;
  };
  const end = () => {
    busyRef.current = null;
    setBusy(null);
  };

  // Change the type, then show what was saved: the pressed type and the
  // canvas follow the saved relationship, never the one the editor opened on.
  const handleRelationshipTypeChange = async (newType: RelationshipType) => {
    if (!editingEdge || editingEdge.edge.type === newType || !begin('type')) return;
    const { edge } = editingEdge;
    try {
      const result = await updateEdgeMutation({ variables: { where: { id: edge.id }, update: { type: newType } } });
      const saved = savedRelationship(result.data?.updateEdges?.edges?.[0]);
      if (!saved || saved.type !== newType) throw new Error('This relationship no longer exists.');
      onEdgeChange(editorEdge(saved), edge.id);
      showSuccess('Relationship Updated', `Now ${getRelationshipConfig(newType).label}`);
    } catch (error) {
      showError('Update Failed', `${sentence(error, 'The change could not be saved.')} The relationship was not changed.`);
    } finally {
      end();
    }
  };

  // Flip from the saved relationship (its current type and weight), creating
  // the reversed one before removing the original, then keep editing it.
  const handleFlipDirection = async () => {
    if (!editingEdge || !begin('flip')) return;
    const { edge } = editingEdge;
    try {
      const { data } = await client.query({ query: GET_RELATIONSHIP, variables: { where: { id: edge.id } }, fetchPolicy: 'network-only' });
      const saved = savedRelationship(data?.edges?.[0]);
      if (!saved) {
        showError('Flip Failed', 'This relationship no longer exists. Close the editor to see the current graph.');
        return;
      }
      const outcome = await flipRelationship(saved, {
        create: async input => savedRelationship((await client.mutate({ mutation: CREATE_EDGE, variables: { input: [input] } })).data?.createEdges?.edges?.[0]),
        remove: async id => { await client.mutate({ mutation: DELETE_EDGE, variables: { where: { id } } }); },
      });
      await client.refetchQueries({ include: REFRESH }).catch(() => undefined);
      if (outcome.ok) {
        onEdgeChange(editorEdge(outcome.edge), edge.id);
        showSuccess('Direction Flipped', relationshipLine(editorEdge(outcome.edge), workItems));
      } else {
        showError('Flip Failed', outcome.message);
      }
    } catch (error) {
      showError('Flip Failed', `${sentence(error, 'The relationship could not be read.')} The relationship was not changed.`);
    } finally {
      end();
    }
  };

  // Handle edge delete
  const handleDeleteEdge = async () => {
    if (!editingEdge || !begin('delete')) return;
    const { edge } = editingEdge;
    try {
      await deleteEdgeMutation({ variables: { where: { id: edge.id } } });
      showSuccess('Relationship Deleted', 'Edge removed successfully');
      onDeleteEdge?.(edge.id);
      onClose();
    } catch (error) {
      showError('Delete Failed', `${sentence(error, 'Could not delete relationship.')} The relationship was not changed.`);
    } finally {
      end();
    }
  };

  if (!editingEdge) return null;

  return createPortal(
    <div 
      ref={windowRef}
      role="dialog"
      aria-label="Edit relationship"
      aria-busy={busy !== null}
      className="fixed flex flex-col bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-lg overflow-hidden z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        maxHeight: 'calc(100vh - 20px)',
        pointerEvents: 'all'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div 
        className="flex shrink-0 items-center justify-between p-3 bg-white/10 border-b border-white/10 cursor-move select-none"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center space-x-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <span className="text-white font-semibold text-sm">
            Edit Relationship
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse relationship editor' : 'Expand relationship editor'}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
          <button
            onClick={onClose}
            aria-label="Close relationship editor"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Status indicator */}
          <div className="text-center">
            <div className="text-blue-400 text-sm">
              Editing relationship: {relationshipLine(editingEdge.edge, workItems)}
            </div>
          </div>

          {/* Relationship type grid */}
          <div>
              <div className="text-white text-sm font-medium mb-3">Relationship Type</div>
              <div className="grid grid-cols-3 gap-2">
                {RELATIONSHIP_OPTIONS.map((option) => {
                  const isSelected = editingEdge.edge.type === option.type;
                  return (
                    <button
                      key={option.type}
                      aria-pressed={isSelected}
                      disabled={busy !== null}
                      onClick={() => handleRelationshipTypeChange(option.type)}
                      className={`
                        group relative p-3 rounded-lg border transition-all duration-200 disabled:cursor-wait
                        ${isSelected 
                          ? 'border-amber-400 bg-amber-400/10 text-amber-400' 
                          : 'border-white/20 bg-white/5 text-white hover:border-white/40 hover:bg-white/10'
                        }
                      `}
                      title={option.description}
                    >
                      <div className="flex flex-col items-center space-y-2">
                        <div className={`text-lg group-hover:scale-110 transition-transform`}>
                          {getRelationshipIconElement(option.type, "h-5 w-5")}
                        </div>
                        <span className="text-xs font-medium text-center leading-tight">
                          {option.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-white/10 space-y-2">
              <button
                onClick={handleFlipDirection}
                disabled={busy !== null}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-2 px-3 rounded-lg flex items-center justify-center space-x-2 font-medium transition-all duration-200 shadow-lg hover:shadow-blue-500/25 disabled:opacity-50"
              >
                <Move className="h-4 w-4" />
                <span>{busy === 'flip' ? 'Flipping...' : 'Flip Direction'}</span>
              </button>
              
              <button
                onClick={handleDeleteEdge}
                disabled={busy !== null}
                className="w-full disabled:opacity-50 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white py-2 px-3 rounded-lg flex items-center justify-center space-x-2 font-medium transition-all duration-200 shadow-lg hover:shadow-red-500/25"
              >
                <X className="h-4 w-4" />
                <span>Delete Relationship</span>
              </button>
          </div>
        </div>
      )}

      {/* Resize handle */}
      {isExpanded && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleResizeStart}
        >
          <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-white/40"></div>
        </div>
      )}
    </div>,
    document.body
  );
};
