import React, { useState, useMemo } from 'react';
import { Activity, Clock, User, MessageSquare, CheckCircle, Edit, Plus, AlertCircle } from 'lucide-react';

interface WorkItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priorityExec: number;
  priorityIndiv: number;
  priorityComm: number;
  priorityComp: number;
  dueDate?: string;
  tags?: string[];
  metadata?: string;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; name: string; username: string; };
  assignedTo?: { id: string; name: string; username: string; };
  graph?: { id: string; name: string; team?: { id: string; name: string; } };
  contributors?: Array<{ id: string; name: string; type: string; }>;
  dependencies?: Array<{ id: string; title: string; type: string; }>;
  dependents?: Array<{ id: string; title: string; type: string; }>;
}

interface ActivityFeedProps {
  filteredNodes: WorkItem[];
}

interface ActivityItem {
  id: string;
  type: 'created' | 'updated' | 'completed' | 'commented';
  title: string;
  description: string;
  timestamp: Date;
  user: string;
  nodeId: string;
  nodeTitle: string;
  icon: React.ReactNode;
  color: string;
}

const formatLabel = (label: string) => {
  return label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const getTimeAgo = (date: Date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({ filteredNodes }) => {
  const [filter, setFilter] = useState<'all' | 'created' | 'updated' | 'completed'>('all');
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('week');

  // Generate mock activity data from nodes
  const activities = useMemo(() => {
    const activityList: ActivityItem[] = [];
    
    filteredNodes.forEach(node => {
      // Creation activity
      activityList.push({
        id: `${node.id}-created`,
        type: 'created',
        title: 'Task Created',
        description: `Created "${node.title}"`,
        timestamp: new Date(node.createdAt),
        user: node.owner?.name || 'Unknown User',
        nodeId: node.id,
        nodeTitle: node.title,
        icon: <Plus className="h-4 w-4" />,
        color: 'text-green-400'
      });

      // Update activity (if updated date is different from created)
      if (node.updatedAt && new Date(node.updatedAt).getTime() !== new Date(node.createdAt).getTime()) {
        activityList.push({
          id: `${node.id}-updated`,
          type: 'updated',
          title: 'Task Updated',
          description: `Updated "${node.title}" status to ${formatLabel(node.status)}`,
          timestamp: new Date(node.updatedAt),
          user: node.assignedTo?.name || node.owner?.name || 'Unknown User',
          nodeId: node.id,
          nodeTitle: node.title,
          icon: <Edit className="h-4 w-4" />,
          color: 'text-blue-400'
        });
      }

      // Completion activity
      if (node.status === 'COMPLETED') {
        activityList.push({
          id: `${node.id}-completed`,
          type: 'completed',
          title: 'Task Completed',
          description: `Completed "${node.title}"`,
          timestamp: new Date(node.updatedAt),
          user: node.assignedTo?.name || 'Unknown User',
          nodeId: node.id,
          nodeTitle: node.title,
          icon: <CheckCircle className="h-4 w-4" />,
          color: 'text-green-400'
        });
      }

      // Mock comment activity for some nodes
      if (Math.random() > 0.7) {
        activityList.push({
          id: `${node.id}-commented`,
          type: 'commented',
          title: 'Comment Added',
          description: `Added a comment on "${node.title}"`,
          timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          user: node.assignedTo?.name || 'Team Member',
          nodeId: node.id,
          nodeTitle: node.title,
          icon: <MessageSquare className="h-4 w-4" />,
          color: 'text-purple-400'
        });
      }
    });

    return activityList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [filteredNodes]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    let filtered = activities;

    // Filter by type
    if (filter !== 'all') {
      filtered = filtered.filter(activity => activity.type === filter);
    }

    // Filter by time range
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (timeRange) {
      case 'today':
        cutoffDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case 'all':
        cutoffDate.setFullYear(2000); // Very old date
        break;
    }

    if (timeRange !== 'all') {
      filtered = filtered.filter(activity => activity.timestamp >= cutoffDate);
    }

    return filtered;
  }, [activities, filter, timeRange]);

  return (
    <div className="p-6 bg-gray-900 h-full overflow-auto">
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <Activity className="h-6 w-6 text-green-400" />
          <h2 className="text-2xl font-bold text-white">Activity Feed</h2>
        </div>
        <p className="text-gray-400">Recent updates, changes, and collaboration</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-300">Type:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Activities</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-300">Time:</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="today">Today</option>
            <option value="week">Past Week</option>
            <option value="month">Past Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Activity List */}
      <div className="space-y-4">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No activities found for the selected filters.</p>
          </div>
        ) : (
          filteredActivities.map((activity) => (
            <div key={activity.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
              <div className="flex items-start space-x-4">
                <div className={`p-2 rounded-lg bg-gray-700 ${activity.color}`}>
                  {activity.icon}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-medium text-white">{activity.title}</h3>
                    <span className="text-xs text-gray-400">{getTimeAgo(activity.timestamp)}</span>
                  </div>
                  
                  <p className="text-sm text-gray-300 mb-2">{activity.description}</p>
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-400">
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3" />
                      <span>{activity.user}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{activity.timestamp.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {filteredActivities.length > 0 && (
        <div className="mt-6 text-center">
          <button className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
            Load More Activities
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;