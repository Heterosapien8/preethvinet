import { useNotifications } from '../../contexts/NotificationContext'
import { formatDistanceToNow } from 'date-fns'
import { X, AlertTriangle, Bell, FileWarning, Clock } from 'lucide-react'
import { useEffect, useRef } from 'react'
import clsx from 'clsx'

const TYPE_CONFIG = {
  violation:        { icon: AlertTriangle, color: 'text-white', bg: 'bg-red-600', body: 'text-red-50', meta: 'text-red-100/80' },
  missingReport:    { icon: FileWarning, color: 'text-white', bg: 'bg-orange-500', body: 'text-orange-50', meta: 'text-orange-100/80' },
  reportReminder:   { icon: Clock, color: 'text-white', bg: 'bg-amber-500', body: 'text-amber-50', meta: 'text-amber-100/80' },
  escalationUpdate: { icon: Bell, color: 'text-white', bg: 'bg-primary-700', body: 'text-blue-50', meta: 'text-blue-100/80' },
  reportLocked:     { icon: FileWarning, color: 'text-white', bg: 'bg-red-700', body: 'text-red-50', meta: 'text-red-100/80' },
  system:           { icon: Bell, color: 'text-white', bg: 'bg-gray-700', body: 'text-gray-100', meta: 'text-gray-200/80' },
}

export default function NotificationPanel({ onClose }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const panelRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl
                 border border-gray-200 z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <p className="text-sm font-semibold text-gray-800">Notifications</p>
          {unreadCount > 0 && (
            <p className="text-xs text-gray-400">{unreadCount} unread</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-primary-600 hover:underline"
            >
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No notifications</p>
          </div>
        ) : (
          notifications.map(notif => {
            const config = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.system
            const Icon = config.icon
            const ts = notif.createdAt?.toDate?.()

            return (
              <div
                key={notif.id}
                onClick={() => markAsRead(notif.id)}
                className={clsx(
                  'flex gap-3 px-4 py-3 cursor-pointer transition-colors',
                  notif.isRead ? 'bg-white hover:bg-gray-50' : `${config.bg} hover:brightness-95`
                )}
              >
                <div className={clsx('flex-shrink-0 mt-0.5', config.color)}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={clsx(
                    'text-sm font-medium leading-snug',
                    notif.isRead ? 'text-gray-800' : 'text-white'
                  )}>
                    {notif.title}
                  </p>
                  <p className={clsx(
                    'text-xs mt-0.5 leading-snug line-clamp-2',
                    notif.isRead ? 'text-gray-500' : config.body
                  )}>
                    {notif.body}
                  </p>
                  {ts && (
                    <p className={clsx(
                      'text-[10px] mt-1',
                      notif.isRead ? 'text-gray-400' : config.meta
                    )}>
                      {formatDistanceToNow(ts, { addSuffix: true })}
                    </p>
                  )}
                </div>
                {!notif.isRead && (
                  <div className="flex-shrink-0 w-2 h-2 bg-white rounded-full mt-1.5" />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
