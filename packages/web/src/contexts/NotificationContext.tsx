import React, { createContext, useContext, useState, useCallback } from 'react';
import { Check, X, AlertCircle, Info } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  showNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const showNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36);
    const newNotification = { ...notification, id };
    
    setNotifications(prev => [...prev, newNotification]);
    
    // Auto-remove after duration (default 5 seconds)
    setTimeout(() => {
      removeNotification(id);
    }, notification.duration || 5000);
  }, [removeNotification]);

  const showSuccess = useCallback((title: string, message?: string) => {
    showNotification({ type: 'success', title, message });
  }, [showNotification]);

  const showError = useCallback((title: string, message?: string) => {
    showNotification({ type: 'error', title, message, duration: 7000 });
  }, [showNotification]);

  const showWarning = useCallback((title: string, message?: string) => {
    showNotification({ type: 'warning', title, message });
  }, [showNotification]);

  const showInfo = useCallback((title: string, message?: string) => {
    showNotification({ type: 'info', title, message });
  }, [showNotification]);

  return (
    <NotificationContext.Provider 
      value={{
        notifications,
        showNotification,
        removeNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo,
      }}
    >
      {children}
      <NotificationContainer 
        notifications={notifications} 
        removeNotification={removeNotification} 
      />
    </NotificationContext.Provider>
  );
}

function NotificationContainer({ 
  notifications, 
  removeNotification 
}: { 
  notifications: Notification[];
  removeNotification: (id: string) => void;
}) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm">
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

function NotificationItem({ 
  notification, 
  onClose 
}: { 
  notification: Notification;
  onClose: () => void;
}) {
  const getIcon = (iconColor: string) => {
    switch (notification.type) {
      case 'success':
        return <Check className={`h-5 w-5 ${iconColor}`} />;
      case 'error':
        return <AlertCircle className={`h-5 w-5 ${iconColor}`} />;
      case 'warning':
        return <AlertCircle className={`h-5 w-5 ${iconColor}`} />;
      case 'info':
        return <Info className={`h-5 w-5 ${iconColor}`} />;
      default:
        return <Info className={`h-5 w-5 ${iconColor}`} />;
    }
  };

  const getStyles = () => {
    switch (notification.type) {
      case 'success':
        return {
          bg: 'bg-gray-800 dark:bg-gray-750',
          border: 'border-green-500',
          text: 'text-green-400',
          icon: 'text-green-400'
        };
      case 'error':
        return {
          bg: 'bg-gray-800 dark:bg-gray-750',
          border: 'border-red-500',
          text: 'text-red-400',
          icon: 'text-red-400'
        };
      case 'warning':
        return {
          bg: 'bg-gray-800 dark:bg-gray-750',
          border: 'border-orange-500',
          text: 'text-orange-400',
          icon: 'text-orange-400'
        };
      case 'info':
        return {
          bg: 'bg-gray-800 dark:bg-gray-750',
          border: 'border-blue-500',
          text: 'text-blue-400',
          icon: 'text-blue-400'
        };
      default:
        return {
          bg: 'bg-gray-800 dark:bg-gray-750',
          border: 'border-gray-600',
          text: 'text-gray-300',
          icon: 'text-gray-400'
        };
    }
  };

  const styles = getStyles();
  
  return (
    <div className={`
      ${styles.bg} 
      ${styles.border} 
      border-2 rounded-2xl shadow-lg p-4 flex items-start space-x-3 
      animate-in slide-in-from-right-full duration-300 max-w-sm
    `}>
      {getIcon(styles.icon)}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${styles.text}`}>
          {notification.title}
        </p>
        {notification.message && (
          <p className={`text-sm text-gray-300 mt-1`}>
            {notification.message}
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-200 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}