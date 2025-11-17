import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Minimize2, Maximize2, Move, Zap } from 'lucide-react';
import { WorkItemEdge, RelationshipType } from '../types/graph';
import { getRelationshipConfig, RELATIONSHIP_OPTIONS, getRelationshipIconElement } from '../constants/workItemConstants';
import { useMutation } from '@apollo/client';
import { UPDATE_EDGE, CREATE_EDGE, DELETE_EDGE } from '../lib/queries';

interface RelationshipEditorWindowProps {
  isVisible: boolean;
  editingEdge: { edge: WorkItemEdge; position: { x: number; y: number } } | null;
  selectedNodes: Set<string>;
  workItems: any[];
  onClose: () => void;
  onFlipDirection?: () => void;
  onDeleteEdge?: (edgeId: string) => void;
  onCreateEdge?: (sourceId: string, targetId: string, type: RelationshipType) => void;
  showSuccess: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
  refetchEdges?: () => void;
  onClearSelection?: () => void;
}

export const RelationshipEditorWindow: React.FC<RelationshipEditorWindowProps> = ({
  isVisible,
  editingEdge,
  selectedNodes,
  workItems,
  onClose,
  onFlipDirection,
  onDeleteEdge,
  onCreateEdge,
  showSuccess,
  showError,
  refetchEdges,
  onClearSelection
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isFlippingEdge, setIsFlippingEdge] = useState(false);
  const [currentRelationType, setCurrentRelationType] = useState<RelationshipType | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  // GraphQL mutations
  const [updateEdgeMutation] = useMutation(UPDATE_EDGE);
  const [createEdgeMutation] = useMutation(CREATE_EDGE);
  const [deleteEdgeMutation] = useMutation(DELETE_EDGE);

  // Update current relationship type when editingEdge changes
  useEffect(() => {
    if (editingEdge?.edge.type) {
      setCurrentRelationType(editingEdge.edge.type as RelationshipType);
    }
  }, [editingEdge]);

  // Calculate content-based height
  const calculateContentHeight = () => {
    // Base header height
    let contentHeight = 50;

    if (isExpanded) {
      contentHeight += 16; // Padding top (pt-4)
      contentHeight += 65; // Status indicator box
      contentHeight += 16; // Spacing (space-y-4)

      contentHeight += 18; // "Relationship Type" label
      contentHeight += 12; // margin bottom (mb-3)

      // Grid: 4 columns, calculate rows needed
      const totalOptions = RELATIONSHIP_OPTIONS.length;
      const rows = Math.ceil(totalOptions / 4);
      contentHeight += rows * (72 + 10); // Each button 72px (h-[72px]) + 10px gap (gap-2.5)
      contentHeight -= 10; // Remove last gap

      contentHeight += 32; // Bottom padding (pb-8)
    }

    return contentHeight;
  };

  // Initialize position and auto-calculate height based on content
  useEffect(() => {
    const sidebarWidth = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width') || '16rem';
    const sidebarPixels = sidebarWidth === '4rem' ? 64 : 256;

    setPosition({
      x: sidebarPixels + 16,
      y: 180 // Position similar to the old fixed panel
    });

    const contentHeight = calculateContentHeight();
    setSize({
      width: isExpanded ? 450 : 350,
      height: contentHeight
    });
  }, [isExpanded, isVisible, editingEdge]);

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

  // Get selected node objects
  const selectedNodeObjects = workItems.filter(item => selectedNodes.has(item.id));

  // Handle relationship type change
  const handleRelationshipTypeChange = async (newType: RelationshipType) => {
    if (!editingEdge) return;

    // Optimistically update the UI
    const previousType = currentRelationType;
    setCurrentRelationType(newType);

    try {
      await updateEdgeMutation({
        variables: {
          where: { id: editingEdge.edge.id },
          update: { type: newType }
        }
      });
      showSuccess('Relationship Updated', 'Edge type changed successfully');
      refetchEdges?.();
    } catch (error: any) {
      // Revert on error
      setCurrentRelationType(previousType);
      showError('Update Failed', error.message || 'Could not update relationship');
    }
  };

  // Handle edge flip
  const handleFlipDirection = async () => {
    if (!editingEdge) return;
    
    setIsFlippingEdge(true);
    try {
      // Extract IDs safely - D3 force simulation converts string IDs to node objects
      const sourceId = typeof editingEdge.edge.source === 'string' 
        ? editingEdge.edge.source 
        : (editingEdge.edge.source as any)?.id;
      const targetId = typeof editingEdge.edge.target === 'string' 
        ? editingEdge.edge.target 
        : (editingEdge.edge.target as any)?.id;
      
      // Validate that we successfully extracted IDs
      if (!sourceId || !targetId) {
        showError('Flip Failed', 'Unable to extract node IDs from edge data');
        return;
      }
      
      // Delete current edge
      await deleteEdgeMutation({
        variables: { where: { id: editingEdge.edge.id } }
      });
      
      // Create new edge with flipped direction
      await createEdgeMutation({
        variables: {
          input: [{
            type: editingEdge.edge.type,
            source: { connect: { where: { node: { id: targetId } } } },
            target: { connect: { where: { node: { id: sourceId } } } },
            weight: 1.0
          }]
        }
      });
      
      showSuccess('Direction Flipped', 'Relationship direction updated successfully');
      refetchEdges?.();
      onFlipDirection?.();
    } catch (error: any) {
      showError('Flip Failed', error.message || 'Could not flip relationship direction');
    } finally {
      setIsFlippingEdge(false);
    }
  };

  // Handle edge delete
  const handleDeleteEdge = async () => {
    if (!editingEdge) return;
    
    try {
      await deleteEdgeMutation({
        variables: { where: { id: editingEdge.edge.id } }
      });
      showSuccess('Relationship Deleted', 'Edge removed successfully');
      refetchEdges?.();
      onDeleteEdge?.(editingEdge.edge.id);
      onClose();
    } catch (error: any) {
      showError('Delete Failed', error.message || 'Could not delete relationship');
    }
  };

  if (!isVisible || !editingEdge) return null;

  const canEdit = !!editingEdge;
  const isEditingMode = true;

  return createPortal(
    <div
      ref={windowRef}
      className="fixed bg-slate-950/95 backdrop-blur-md border border-slate-700/30 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden z-50"
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
        className="flex items-center justify-between px-5 py-3 bg-slate-900/60 backdrop-blur-sm border-b border-slate-700/30 cursor-move select-none"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-white font-semibold text-sm tracking-tight">
              Edit Relationship
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg text-slate-400 hover:text-teal-400 hover:bg-teal-500/10 border border-transparent hover:border-teal-500/30 transition-all duration-200 group"
          >
            {isExpanded ? <Minimize2 className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" strokeWidth={2} /> : <Maximize2 className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" strokeWidth={2} />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all duration-200 group"
          >
            <X className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="px-5 pt-4 pb-8 space-y-4">
          {/* Status indicator */}
          <div className="px-4 py-3 bg-slate-800/30 rounded-lg border border-slate-700/40">
            <div className="flex items-center space-x-2 mb-1.5">
              <div className="h-1.5 w-1.5 bg-teal-400 rounded-full"></div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Connection</span>
            </div>
            <div className="text-slate-100 text-sm font-medium tracking-tight">
              {(() => {
                const sourceId = typeof editingEdge?.edge.source === 'string'
                  ? editingEdge?.edge.source
                  : (editingEdge?.edge.source as any)?.id;
                const targetId = typeof editingEdge?.edge.target === 'string'
                  ? editingEdge?.edge.target
                  : (editingEdge?.edge.target as any)?.id;

                const sourceTitle = workItems.find(item => item.id === sourceId)?.title || 'Unknown';
                const targetTitle = workItems.find(item => item.id === targetId)?.title || 'Unknown';

                return `${sourceTitle} → ${targetTitle}`;
              })()}
            </div>
          </div>

          {/* Relationship type grid */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Relationship Type</h4>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {RELATIONSHIP_OPTIONS.map((option, index) => {
                const isSelected = currentRelationType === option.type;

                // Calculate tooltip position based on column
                const columnIndex = index % 4;
                const isFirstColumn = columnIndex === 0;
                const isLastColumn = columnIndex === 3;
                const tooltipPositionClass = isFirstColumn ? 'left-0' : isLastColumn ? 'right-0' : 'left-1/2 -translate-x-1/2';
                const arrowPositionClass = isFirstColumn ? 'left-4' : isLastColumn ? 'right-4' : 'left-1/2 -translate-x-1/2';

                const getTypeColor = (type: string) => {
                  const colors: Record<string, { iconColor: string; border: string; hoverBorder: string; selectedBg: string; selectedBorder: string; checkmarkBg: string }> = {
                    'DEFAULT_EDGE': { iconColor: 'text-gray-400', border: 'border-gray-400/40', hoverBorder: 'hover:border-gray-400/80', selectedBg: 'bg-gray-500/20', selectedBorder: 'border-gray-400', checkmarkBg: 'bg-gray-500' },
                    'DEPENDS_ON': { iconColor: 'text-emerald-400', border: 'border-emerald-400/40', hoverBorder: 'hover:border-emerald-400/80', selectedBg: 'bg-emerald-500/20', selectedBorder: 'border-emerald-400', checkmarkBg: 'bg-emerald-500' },
                    'BLOCKS': { iconColor: 'text-rose-400', border: 'border-rose-400/40', hoverBorder: 'hover:border-rose-400/80', selectedBg: 'bg-rose-500/20', selectedBorder: 'border-rose-400', checkmarkBg: 'bg-rose-500' },
                    'ENABLES': { iconColor: 'text-green-400', border: 'border-green-400/40', hoverBorder: 'hover:border-green-400/80', selectedBg: 'bg-green-500/20', selectedBorder: 'border-green-400', checkmarkBg: 'bg-green-500' },
                    'RELATES_TO': { iconColor: 'text-purple-400', border: 'border-purple-400/40', hoverBorder: 'hover:border-purple-400/80', selectedBg: 'bg-purple-500/20', selectedBorder: 'border-purple-400', checkmarkBg: 'bg-purple-500' },
                    'IS_PART_OF': { iconColor: 'text-orange-400', border: 'border-orange-400/40', hoverBorder: 'hover:border-orange-400/80', selectedBg: 'bg-orange-500/20', selectedBorder: 'border-orange-400', checkmarkBg: 'bg-orange-500' },
                    'FOLLOWS': { iconColor: 'text-indigo-400', border: 'border-indigo-400/40', hoverBorder: 'hover:border-indigo-400/80', selectedBg: 'bg-indigo-500/20', selectedBorder: 'border-indigo-400', checkmarkBg: 'bg-indigo-500' },
                    'PARALLEL_WITH': { iconColor: 'text-teal-400', border: 'border-teal-400/40', hoverBorder: 'hover:border-teal-400/80', selectedBg: 'bg-teal-500/20', selectedBorder: 'border-teal-400', checkmarkBg: 'bg-teal-500' },
                    'DUPLICATES': { iconColor: 'text-yellow-400', border: 'border-yellow-400/40', hoverBorder: 'hover:border-yellow-400/80', selectedBg: 'bg-yellow-500/20', selectedBorder: 'border-yellow-400', checkmarkBg: 'bg-yellow-500' },
                    'CONFLICTS_WITH': { iconColor: 'text-red-500', border: 'border-red-500/40', hoverBorder: 'hover:border-red-500/80', selectedBg: 'bg-red-500/20', selectedBorder: 'border-red-500', checkmarkBg: 'bg-red-500' },
                    'VALIDATES': { iconColor: 'text-lime-400', border: 'border-lime-400/40', hoverBorder: 'hover:border-lime-400/80', selectedBg: 'bg-lime-500/20', selectedBorder: 'border-lime-400', checkmarkBg: 'bg-lime-500' },
                    'REFERENCES': { iconColor: 'text-fuchsia-400', border: 'border-fuchsia-400/40', hoverBorder: 'hover:border-fuchsia-400/80', selectedBg: 'bg-fuchsia-500/20', selectedBorder: 'border-fuchsia-400', checkmarkBg: 'bg-fuchsia-500' },
                    'CONTAINS': { iconColor: 'text-blue-400', border: 'border-blue-400/40', hoverBorder: 'hover:border-blue-400/80', selectedBg: 'bg-blue-500/20', selectedBorder: 'border-blue-400', checkmarkBg: 'bg-blue-500' },
                    'SUPERSEDES': { iconColor: 'text-cyan-400', border: 'border-cyan-400/40', hoverBorder: 'hover:border-cyan-400/80', selectedBg: 'bg-cyan-500/20', selectedBorder: 'border-cyan-400', checkmarkBg: 'bg-cyan-500' },
                    'EXTENDS': { iconColor: 'text-pink-400', border: 'border-pink-400/40', hoverBorder: 'hover:border-pink-400/80', selectedBg: 'bg-pink-500/20', selectedBorder: 'border-pink-400', checkmarkBg: 'bg-pink-500' },
                    'TRIGGERS': { iconColor: 'text-sky-300', border: 'border-sky-300/40', hoverBorder: 'hover:border-sky-300/80', selectedBg: 'bg-sky-300/20', selectedBorder: 'border-sky-300', checkmarkBg: 'bg-sky-300' },
                  };
                  return colors[type] || { iconColor: 'text-gray-400', border: 'border-gray-400/40', hoverBorder: 'hover:border-gray-400/80', selectedBg: 'bg-gray-500/20', selectedBorder: 'border-gray-400', checkmarkBg: 'bg-gray-500' };
                };

                const typeColor = getTypeColor(option.type);

                return (
                  <div key={option.type} className="relative group/tooltip">
                    <button
                      onClick={() => handleRelationshipTypeChange(option.type)}
                      className={`
                        w-full group relative px-3 pt-3 pb-5 rounded-xl transition-all duration-200 border-2 h-[72px] overflow-hidden
                        ${isSelected
                          ? `${typeColor.selectedBorder} ${typeColor.selectedBg} shadow-lg`
                          : `${typeColor.border} bg-slate-800/30 ${typeColor.hoverBorder} active:scale-[0.97]`
                        }
                      `}
                    >
                      <div className="flex flex-col items-center justify-center gap-4 h-full">
                        <div className={`${typeColor.iconColor} transition-all duration-200 ${isSelected ? '' : 'group-hover:scale-110'}`}>
                          {getRelationshipIconElement(option.type, "h-5 w-5")}
                        </div>
                        <span className={`font-semibold text-[10px] text-center leading-tight transition-colors duration-300 ${isSelected ? typeColor.iconColor : 'text-gray-300 group-hover:text-white'}`}>
                          {option.label}
                        </span>
                      </div>
                      {isSelected && (
                        <div
                          className={`absolute top-1 right-1 w-4 h-4 ${typeColor.checkmarkBg} text-white rounded-full flex items-center justify-center text-[8px] shadow-lg animate-in zoom-in duration-200`}
                        >
                          ✓
                        </div>
                      )}
                    </button>

                    {/* Premium Tooltip on Hover */}
                    <div className={`absolute bottom-full ${tooltipPositionClass} mb-2 px-3 py-2 bg-gradient-to-br from-gray-900/98 to-black/98 backdrop-blur-xl rounded-lg border border-gray-600/50 shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-300 pointer-events-none z-50 whitespace-nowrap`}>
                      <div className="text-xs text-gray-300 leading-relaxed">
                        {option.description}
                      </div>
                      <div className={`absolute top-full ${arrowPositionClass} -mt-px`}>
                        <div className="border-4 border-transparent border-t-gray-900/98"></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* Resize handle */}
      {isExpanded && (
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize group"
          onMouseDown={handleResizeStart}
        >
          <div className="absolute bottom-2 right-2 w-2.5 h-2.5 border-r-2 border-b-2 border-slate-600/50 group-hover:border-teal-400/60 transition-colors duration-150"></div>
        </div>
      )}
    </div>,
    document.body
  );
};