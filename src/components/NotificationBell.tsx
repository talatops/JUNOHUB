"use client"

import { useEffect, useState, useRef } from "react"
import { Bell, Loader2, CheckCircle2, Clock, XCircle, Mail, Package, ShoppingCart, X, AlertTriangle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "@/components/ThemeProvider"

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
    const { theme } = useTheme()
    const isLight = theme === "light"

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
            case "SHOPIFY_LOW_STOCK":
                return <AlertTriangle className="w-4 h-4 text-amber-400" />
            default:
                return <Bell className="w-4 h-4 text-slate-400" />
        }
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 rounded-lg transition-colors ${isLight ? "hover:bg-slate-100" : "hover:bg-white/10"
                    }`}
            >
                <Bell
                    className={`w-5 h-5 ${isLight ? "text-slate-600" : "text-slate-400"
                        }`}
                />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className={`absolute right-[-3.5rem] sm:right-0 top-full z-50 mt-2 flex max-h-[600px] w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] flex-col rounded-xl border shadow-xl ${isLight
                            ? "bg-white border-slate-200"
                            : "bg-slate-800 border-white/10"
                            }`}
                    >
                        <div
                            className={`flex items-center justify-between border-b p-4 ${isLight ? "border-slate-200" : "border-white/10"
                                }`}
                        >
                            <h3
                                className={`font-bold ${isLight ? "text-slate-900" : "text-white"
                                    }`}
                            >
                                Notifications
                            </h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className={`text-xs font-medium ${isLight
                                        ? "text-indigo-600 hover:text-indigo-500"
                                        : "text-indigo-400 hover:text-indigo-300"
                                        }`}
                                >
                                    Mark all as read
                                </button>
                            )}
                        </div>

                        <div className="overflow-y-auto flex-1">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2
                                        className={`h-6 w-6 animate-spin ${isLight
                                            ? "text-indigo-600"
                                            : "text-indigo-400"
                                            }`}
                                    />
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Bell
                                        className={`mx-auto mb-3 h-12 w-12 opacity-50 ${isLight
                                            ? "text-slate-400"
                                            : "text-slate-400"
                                            }`}
                                    />
                                    <p
                                        className={`text-sm ${isLight
                                            ? "text-slate-500"
                                            : "text-slate-400"
                                            }`}
                                    >
                                        No notifications yet
                                    </p>
                                </div>
                            ) : (
                                <div
                                    className={`divide-y ${isLight
                                        ? "divide-slate-100"
                                        : "divide-white/10"
                                        }`}
                                >
                                    {notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            className={`p-4 transition-colors ${isLight
                                                ? "hover:bg-slate-50"
                                                : "hover:bg-white/5"
                                                } ${!notification.read
                                                    ? isLight
                                                        ? "bg-indigo-50"
                                                        : "bg-indigo-500/10"
                                                    : ""
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 flex-shrink-0">
                                                    {getNotificationIcon(notification.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <h4
                                                                className={`mb-1 text-sm font-semibold ${isLight
                                                                    ? "text-slate-900"
                                                                    : "text-white"
                                                                    }`}
                                                            >
                                                                {notification.title}
                                                            </h4>
                                                            <p
                                                                className={`mb-2 text-xs ${isLight
                                                                    ? "text-slate-600"
                                                                    : "text-slate-300"
                                                                    }`}
                                                            >
                                                                {notification.message}
                                                            </p>
                                                            <p
                                                                className={`text-[10px] ${isLight
                                                                    ? "text-slate-400"
                                                                    : "text-slate-500"
                                                                    }`}
                                                            >
                                                                {formatDistanceToNow(new Date(notification.createdAt), {
                                                                    addSuffix: true
                                                                })}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            {!notification.read && (
                                                                <button
                                                                    onClick={() => markAsRead(notification.id)}
                                                                    className={`rounded p-1 transition-colors ${isLight
                                                                        ? "hover:bg-slate-100"
                                                                        : "hover:bg-white/10"
                                                                        }`}
                                                                    title="Mark as read"
                                                                >
                                                                    <CheckCircle2
                                                                        className={`h-3 w-3 ${isLight
                                                                            ? "text-slate-400"
                                                                            : "text-slate-400"
                                                                            }`}
                                                                    />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => deleteNotification(notification.id)}
                                                                className={`rounded p-1 transition-colors ${isLight
                                                                    ? "hover:bg-slate-100"
                                                                    : "hover:bg-white/10"
                                                                    }`}
                                                                title="Delete"
                                                            >
                                                                <X
                                                                    className={`h-3 w-3 ${isLight
                                                                        ? "text-slate-400"
                                                                        : "text-slate-400"
                                                                        }`}
                                                                />
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
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
