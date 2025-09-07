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
  const windowRef = useRef<HTMLDivElement>(null);

  // GraphQL mutations
  const [updateEdgeMutation] = useMutation(UPDATE_EDGE);
  const [createEdgeMutation] = useMutation(CREATE_EDGE);
  const [deleteEdgeMutation] = useMutation(DELETE_EDGE);

  // Calculate content-based height
  const calculateContentHeight = () => {
    // Base header height
    let contentHeight = 50; // Header height
    
    if (isExpanded) {
      contentHeight += 16; // Padding top/bottom (p-4)
      contentHeight += 24; // Status indicator
      contentHeight += 16; // Spacing
      
      const canEdit = editingEdge || selectedNodes.size === 2;
      if (canEdit) {
        contentHeight += 20; // "Relationship Type" label
        contentHeight += 12; // margin bottom
        
        // Grid: 3 columns, calculate rows needed
        const totalOptions = RELATIONSHIP_OPTIONS.length;
        const rows = Math.ceil(totalOptions / 3);
        contentHeight += rows * (80 + 8); // Each button ~80px height + 8px gap
        contentHeight -= 8; // Remove last gap
      }
      
      // Actions section for editing mode
      if (editingEdge) {
        contentHeight += 16; // Padding top for border
        contentHeight += 40; // Flip button
        contentHeight += 8;  // Gap
        contentHeight += 40; // Delete button
      }
      
      // Actions section for create mode
      if (!editingEdge && canEdit) {
        contentHeight += 16; // Padding top for border
        contentHeight += 40; // Clear selection button
      }
      
      // Add some extra padding for safety
      contentHeight += 16;
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
  }, [isExpanded, isVisible, editingEdge, selectedNodes.size]);

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
    if (editingEdge) {
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
        showError('Update Failed', error.message || 'Could not update relationship');
      }
    } else if (selectedNodeObjects.length === 2) {
      // Create new edge
      const [sourceNode, targetNode] = selectedNodeObjects;
      try {
        await createEdgeMutation({
          variables: {
            input: [{
              type: newType,
              source: { connect: { where: { node: { id: sourceNode.id } } } },
              target: { connect: { where: { node: { id: targetNode.id } } } },
              weight: 1.0
            }]
          }
        });
        showSuccess('Relationship Created', 'New relationship added successfully');
        refetchEdges?.();
        onCreateEdge?.(sourceNode.id, targetNode.id, newType);
      } catch (error: any) {
        showError('Creation Failed', error.message || 'Could not create relationship');
      }
    }
  };

  // Handle edge flip
  const handleFlipDirection = async () => {
    if (!editingEdge) return;
    
    setIsFlippingEdge(true);
    try {
      // Delete current edge
      await deleteEdgeMutation({
        variables: { where: { id: editingEdge.edge.id } }
      });
      
      // Create new edge with flipped direction
      await createEdgeMutation({
        variables: {
          input: [{
            type: editingEdge.edge.type,
            source: { connect: { where: { node: { id: editingEdge.edge.target } } } },
            target: { connect: { where: { node: { id: editingEdge.edge.source } } } },
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

  if (!isVisible) return null;

  const canEdit = editingEdge || selectedNodeObjects.length === 2;
  const isEditingMode = !!editingEdge;

  return createPortal(
    <div 
      ref={windowRef}
      className="fixed bg-white/5 backdrop-blur-xl border border-white/20 rounded-xl shadow-lg overflow-hidden z-50"
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
        className="flex items-center justify-between p-3 bg-white/10 border-b border-white/10 cursor-move select-none"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center space-x-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <span className="text-white font-semibold text-sm">
            {isEditingMode ? 'Edit Relationship' : 'Create Relationship'}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Status indicator */}
          <div className="text-center">
            {!canEdit && (
              <div className="text-gray-400 text-sm">
                Select two nodes or click on an edge to edit relationships
              </div>
            )}
            {canEdit && !isEditingMode && (
              <div className="text-green-400 text-sm">
                Ready to create relationship between {selectedNodeObjects.length} selected nodes
              </div>
            )}
            {isEditingMode && (
              <div className="text-blue-400 text-sm">
                Editing relationship: {workItems.find(item => item.id === editingEdge?.edge.source)?.title || 'Unknown'} → {workItems.find(item => item.id === editingEdge?.edge.target)?.title || 'Unknown'}
              </div>
            )}
          </div>

          {/* Relationship type grid */}
          {canEdit && (
            <div>
              <div className="text-white text-sm font-medium mb-3">Relationship Type</div>
              <div className="grid grid-cols-3 gap-2">
                {RELATIONSHIP_OPTIONS.map((option) => {
                  const isSelected = isEditingMode ? editingEdge?.edge.type === option.type : false;
                  return (
                    <button
                      key={option.type}
                      onClick={() => handleRelationshipTypeChange(option.type)}
                      className={`
                        group relative p-3 rounded-lg border transition-all duration-200
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
          )}

          {/* Actions */}
          {isEditingMode && (
            <div className="pt-2 border-t border-white/10 space-y-2">
              <button
                onClick={handleFlipDirection}
                disabled={isFlippingEdge}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-2 px-3 rounded-lg flex items-center justify-center space-x-2 font-medium transition-all duration-200 shadow-lg hover:shadow-blue-500/25 disabled:opacity-50"
              >
                <Move className="h-4 w-4" />
                <span>{isFlippingEdge ? 'Flipping...' : 'Flip Direction'}</span>
              </button>
              
              <button
                onClick={handleDeleteEdge}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white py-2 px-3 rounded-lg flex items-center justify-center space-x-2 font-medium transition-all duration-200 shadow-lg hover:shadow-red-500/25"
              >
                <X className="h-4 w-4" />
                <span>Delete Relationship</span>
              </button>
            </div>
          )}

          {/* Create mode actions */}
          {!isEditingMode && canEdit && (
            <div className="pt-2 border-t border-white/10 space-y-2">
              <button
                onClick={() => onClearSelection?.()}
                className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white py-2 px-3 rounded-lg flex items-center justify-center space-x-2 font-medium transition-all duration-200 shadow-lg hover:shadow-gray-500/25"
              >
                <X className="h-4 w-4" />
                <span>Clear Selection</span>
              </button>
            </div>
          )}
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