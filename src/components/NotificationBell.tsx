"use client"

import { useEffect, useState, useRef } from "react"
import { Bell, Loader2, CheckCircle2, Clock, XCircle, Mail, Package, ShoppingCart, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Notification {
    id: string
    type: string
    title: string
    message: string
    read: boolean
    readAt: string | null
    createdAt: string
    metadata?: any
}

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetchNotifications()
        
        // Poll for new notifications every 5 seconds
        const interval = setInterval(() => {
            fetchNotifications()
        }, 5000)
        
        return () => clearInterval(interval)
    }, [])

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside)
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isOpen])

    const fetchNotifications = async () => {
        try {
            const res = await fetch("/api/notifications?limit=10")
            if (!res.ok) throw new Error("Failed to fetch notifications")
            const data = await res.json()
            setNotifications(data.notifications || [])
            setUnreadCount(data.unreadCount || 0)
        } catch (error) {
            console.error("Error fetching notifications:", error)
        } finally {
            setLoading(false)
        }
    }

    const markAsRead = async (notificationId: string) => {
        try {
            await fetch(`/api/notifications/${notificationId}`, {
                method: "PUT"
            })
            fetchNotifications() // Refresh
        } catch (error) {
            console.error("Error marking notification as read:", error)
        }
    }

    const markAllAsRead = async () => {
        try {
            await fetch("/api/notifications", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ markAllAsRead: true })
            })
            fetchNotifications() // Refresh
        } catch (error) {
            console.error("Error marking all as read:", error)
        }
    }

    const deleteNotification = async (notificationId: string) => {
        try {
            await fetch(`/api/notifications/${notificationId}`, {
                method: "DELETE"
            })
            fetchNotifications() // Refresh
        } catch (error) {
            console.error("Error deleting notification:", error)
        }
    }

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case "INVITATION_ACCEPTED":
                return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            case "INVITATION_RECEIVED":
                return <Mail className="w-4 h-4 text-indigo-400" />
            case "CONNECTION_STATUS_CHANGED":
                return <Clock className="w-4 h-4 text-yellow-400" />
            case "ORDER_RECEIVED":
                return <ShoppingCart className="w-4 h-4 text-blue-400" />
            case "PRODUCT_UPDATED":
                return <Package className="w-4 h-4 text-purple-400" />
            default:
                return <Bell className="w-4 h-4 text-slate-400" />
        }
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
                <Bell className="w-5 h-5 text-slate-400" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-50 max-h-[600px] flex flex-col">
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <h3 className="font-bold text-white">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="overflow-y-auto flex-1">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <Bell className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-50" />
                                <p className="text-sm text-slate-400">No notifications yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/10">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`p-4 hover:bg-white/5 transition-colors ${
                                            !notification.read ? "bg-indigo-500/10" : ""
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 flex-shrink-0">
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-semibold text-white mb-1">
                                                            {notification.title}
                                                        </h4>
                                                        <p className="text-xs text-slate-300 mb-2">
                                                            {notification.message}
                                                        </p>
                                                        <p className="text-[10px] text-slate-500">
                                                            {formatDistanceToNow(new Date(notification.createdAt), {
                                                                addSuffix: true
                                                            })}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        {!notification.read && (
                                                            <button
                                                                onClick={() => markAsRead(notification.id)}
                                                                className="p-1 hover:bg-white/10 rounded transition-colors"
                                                                title="Mark as read"
                                                            >
                                                                <CheckCircle2 className="w-3 h-3 text-slate-400" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => deleteNotification(notification.id)}
                                                            className="p-1 hover:bg-white/10 rounded transition-colors"
                                                            title="Delete"
                                                        >
                                                            <X className="w-3 h-3 text-slate-400" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
