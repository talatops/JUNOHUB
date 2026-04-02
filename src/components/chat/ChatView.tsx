"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTheme } from "@/components/ThemeProvider"
import {
    Send,
    Search,
    ShieldCheck,
    Loader2,
    Plus,
    MessageSquare,
    CheckCheck,
    Package,
    ShoppingCart,
    X,
    Settings
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface Contact {
    id: string
    name: string
    email: string
    image: string | null
    role: string
}

interface Message {
    id: string
    senderId: string
    receiverId: string
    content: string
    kind?: "TEXT" | "PRODUCT" | "ORDER" | string | null
    attachment?: any
    createdAt: string
}

function AlertCircle(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    )
}

type AttachOrder = {
    id: number
    name: string
    orderNumber?: string
    total_price: string
    currency?: string
    storeId?: string
    storeName?: string
    customerName?: string | null
    primaryImageUrl?: string | null
}
type AttachProduct = {
    id: number | string
    title: string
    storeId?: string
    storeName?: string
    imageUrl?: string | null
    description?: string | null
}

export function ChatView() {
    const pathname = usePathname()
    const isSupplier = pathname.startsWith("/supplier")
    const { theme } = useTheme()
    const isLight = theme === "light"
    const { data: session } = useSession()
    const userId = (session?.user as { id?: string })?.id
    const [contacts, setContacts] = useState<Contact[]>([])
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState("")
    const [draftKind, setDraftKind] = useState<"PRODUCT" | "ORDER" | null>(null)
    const [draftAttachment, setDraftAttachment] = useState<any>(null)

    const [attachmentModalOpen, setAttachmentModalOpen] = useState(false)
    const [activeAttachmentKind, setActiveAttachmentKind] = useState<"PRODUCT" | "ORDER" | null>(null)
    const [activeAttachment, setActiveAttachment] = useState<any>(null)
    const [loadingContacts, setLoadingContacts] = useState(true)
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [sending, setSending] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [contactsError, setContactsError] = useState<string | null>(null)
    const [messagesError, setMessagesError] = useState<string | null>(null)
    const [sendError, setSendError] = useState<string | null>(null)

    const [attachOpen, setAttachOpen] = useState(false)
    const [attachLoading, setAttachLoading] = useState(false)
    const [attachOrders, setAttachOrders] = useState<AttachOrder[]>([])
    const [attachProducts, setAttachProducts] = useState<AttachProduct[]>([])
    const attachRef = useRef<HTMLDivElement>(null)

    const messagesEndRef = useRef<HTMLDivElement>(null)

    const fetchContacts = async () => {
        try {
            setLoadingContacts(true)
            setContactsError(null)
            const res = await fetch("/api/chat/contacts")
            if (res.ok) {
                const data = await res.json()
                setContacts(data.contacts)
            } else {
                setContactsError("Failed to load contacts. Please try again.")
            }
        } catch (error) {
            console.error("Fetch contacts error", error)
            setContactsError("Failed to load contacts. Please try again.")
        } finally {
            setLoadingContacts(false)
        }
    }

    const fetchMessages = async (contact: Contact, silent = false) => {
        try {
            if (!silent) {
                setLoadingMessages(true)
                setMessagesError(null)
            }
            const res = await fetch(`/api/chat/messages?contactId=${contact.id}`)
            if (res.ok) {
                const data = await res.json()
                const typedMessages = data.messages.map((m: any) => ({
                    id: m.id,
                    senderId: m.senderId,
                    receiverId: m.receiverId,
                    content: m.content ?? "",
                    kind: m.kind ?? "TEXT",
                    attachment: m.attachment ?? null,
                    createdAt: m.createdAt
                }))
                setMessages(typedMessages)
            } else if (!silent) {
                setMessagesError("Failed to load messages. Please try again.")
            }
        } catch (error) {
            console.error("Fetch messages error", error)
            if (!silent) setMessagesError("Failed to load messages. Please try again.")
        } finally {
            if (!silent) setLoadingMessages(false)
        }
    }

    useEffect(() => {
        fetchContacts()
    }, [])

    useEffect(() => {
        if (selectedContact) {
            fetchMessages(selectedContact)
        } else {
            setMessages([])
        }
    }, [selectedContact])

    // Poll for new messages when a contact is selected
    const POLL_INTERVAL_MS = 8000
    useEffect(() => {
        if (!selectedContact) return
        const interval = setInterval(() => {
            fetchMessages(selectedContact, true)
        }, POLL_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [selectedContact?.id])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (attachRef.current && !attachRef.current.contains(e.target as Node)) {
                setAttachOpen(false)
            }
        }
        if (attachOpen) {
            document.addEventListener("mousedown", handleClickOutside)
            return () => document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [attachOpen])

    const openAttach = async () => {
        setAttachOpen(true)
        setAttachLoading(true)
        setAttachOrders([])
        setAttachProducts([])
        try {
            if (isSupplier) {
                const res = await fetch("/api/supplier/products")
                if (res.ok) {
                    const data = await res.json()
                    const list = (data.products || []).map((p: any) => ({
                        id: p.id,
                        title: p.title || p.shopifyProductTitle || "Product",
                        imageUrl: p.imageUrl ?? p.image_url ?? null,
                        description: p.description ?? null,
                        storeName: p.vendor?.businessName ?? null
                    }))
                    setAttachProducts(list)
                }
            } else {
                const [ordersRes, productsRes] = await Promise.all([
                    fetch("/api/chat/attach-orders"),
                    fetch("/api/chat/attach-products")
                ])
                if (ordersRes.ok) {
                    const ordersData = await ordersRes.json()
                    setAttachOrders(ordersData.orders || [])
                }
                if (productsRes.ok) {
                    const productsData = await productsRes.json()
                    setAttachProducts(productsData.products || [])
                }
            }
        } catch {
            // Silent fail
        } finally {
            setAttachLoading(false)
        }
    }

    const insertOrder = (order: AttachOrder) => {
        setDraftKind("ORDER")
        setDraftAttachment({
            orderNumber: order.orderNumber ?? order.name,
            customerName: order.customerName ?? null,
            primaryImageUrl: order.primaryImageUrl ?? null,
            total_price: order.total_price,
            currency: order.currency ?? null,
            storeName: order.storeName ?? null,
            shopifyOrderId: order.id
        })
        const summary = `Order ${order.orderNumber ?? order.name}${order.customerName ? ` - ${order.customerName}` : ""}${order.storeName ? ` · ${order.storeName}` : ""}`
        setNewMessage(prev => (prev.trim() ? `${prev.trim()}\n${summary}` : summary))
        setAttachOpen(false)
    }

    const insertProduct = (product: AttachProduct) => {
        setDraftKind("PRODUCT")
        setDraftAttachment({
            title: product.title,
            description: product.description ?? null,
            imageUrl: product.imageUrl ?? null,
            storeName: product.storeName ?? null,
            productId: product.id
        })
        const summary = `Product: ${product.title}${product.storeName ? ` · ${product.storeName}` : ""}`
        setNewMessage(prev => (prev.trim() ? `${prev.trim()}\n${summary}` : summary))
        setAttachOpen(false)
    }

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedContact) return
        const hasText = !!newMessage.trim()
        const hasAttachment = !!draftKind && !!draftAttachment
        if (!hasText && !hasAttachment) return

        try {
            setSending(true)
            setSendError(null)
            const payload: any = {
                receiverId: selectedContact.id,
                content: newMessage
            }
            if (hasAttachment) {
                payload.kind = draftKind
                payload.attachment = draftAttachment
            }
            const res = await fetch("/api/chat/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                const msg = await res.json()
                const optimiticMsg: Message = {
                    id: msg.id,
                    senderId: msg.senderId,
                    receiverId: msg.receiverId,
                    content: newMessage,
                    kind: msg.kind ?? "TEXT",
                    attachment: msg.attachment ?? null,
                    createdAt: msg.createdAt
                }
                setMessages(prev => [...prev, optimiticMsg])
                setNewMessage("")
                setDraftKind(null)
                setDraftAttachment(null)
            } else {
                setSendError("Failed to send message. Please try again.")
            }
        } catch (error) {
            console.error("Send message error", error)
            setSendError("Failed to send message. Please try again.")
        } finally {
            setSending(false)
        }
    }

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className={cn(
            "h-full flex flex-col md:flex-row overflow-hidden min-h-0",
            isLight ? "bg-slate-50" : "bg-white/5 md:bg-transparent"
        )}>
            {/* Sidebar - Contacts (fixed; only inner list scrolls) */}
            <div className={cn(
                "w-full md:w-80 flex flex-col flex-shrink-0 min-h-0 border-r backdrop-blur-xl transition-all",
                selectedContact ? "hidden md:flex" : "flex",
                isLight ? "bg-white border-slate-200 shadow-sm" : "border-white/10 glass-panel bg-black/20"
            )}>
                <div className={cn(
                    "p-6 border-b flex items-center justify-between flex-shrink-0",
                    isLight ? "border-slate-200" : "border-white/10"
                )}>
                    <h2 className={cn("text-xl font-black tracking-tighter", isLight ? "text-slate-900" : "text-white")}>JUNO CHAT</h2>
                    <div className="flex gap-2">
                        <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            isLight ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-green-500/20 border border-green-500/30"
                        )}>
                            <ShieldCheck className={cn("w-4 h-4", isLight ? "text-emerald-600" : "text-green-400")} />
                        </div>
                    </div>
                </div>

                <div className="p-4 flex-shrink-0">
                    <div className="relative group">
                        <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors", isLight ? "text-slate-400 group-focus-within:text-indigo-600" : "text-slate-500 group-focus-within:text-indigo-400")} />
                        <input
                            type="text"
                            placeholder="Find connections..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={cn(
                                "w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium",
                                isLight ? "bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400" : "bg-white/5 border border-white/10 text-white placeholder:text-slate-600"
                            )}
                        />
                    </div>
                    {contactsError && (
                        <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-medium flex items-center justify-between gap-2">
                            <span>{contactsError}</span>
                            <button type="button" onClick={() => setContactsError(null)} className="shrink-0 text-red-500 hover:text-red-700" aria-label="Dismiss">×</button>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    {loadingContacts ? (
                        <div className={cn("p-10 flex flex-col items-center gap-2", isLight ? "text-slate-500" : "text-slate-500")}>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            <span className="text-xs font-bold uppercase tracking-widest">Loading...</span>
                        </div>
                    ) : filteredContacts.length === 0 ? (
                        <div className="p-10 text-center opacity-50">
                            <MessageSquare className={cn("w-10 h-10 mx-auto mb-3", isLight ? "text-slate-400" : "text-slate-600")} />
                            <p className={cn("text-sm font-bold uppercase tracking-widest", isLight ? "text-slate-500" : "text-slate-500")}>No Contacts</p>
                        </div>
                    ) : (
                        <div className="px-2 space-y-1">
                            {filteredContacts.map(contact => (
                                <button
                                    key={contact.id}
                                    onClick={() => setSelectedContact(contact)}
                                    className={cn(
                                        "w-full flex items-center gap-3 p-4 rounded-2xl transition-all group relative",
                                        selectedContact?.id === contact.id
                                            ? isLight ? "bg-indigo-600 shadow-lg text-white" : "bg-indigo-600 shadow-lg shadow-indigo-600/20"
                                            : isLight ? "hover:bg-slate-100" : "hover:bg-white/5"
                                    )}
                                >
                                    <div className="relative">
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center font-black transition-all",
                                            selectedContact?.id === contact.id
                                                ? "bg-white text-indigo-600"
                                                : isLight ? "bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600" : "bg-white/10 text-slate-300 group-hover:bg-indigo-500/20 group-hover:text-indigo-400"
                                        )}>
                                            {contact.name?.[0].toUpperCase() || "?"}
                                        </div>
                                        <div className={cn("absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 bg-green-500", isLight ? "border-white" : "border-slate-900")} />
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <h4 className={cn(
                                            "text-sm font-black truncate tracking-tight",
                                            selectedContact?.id === contact.id ? "text-white" : isLight ? "text-slate-900" : "text-slate-200"
                                        )}>
                                            {contact.name}
                                        </h4>
                                        <p className={cn(
                                            "text-[10px] uppercase font-black tracking-widest mt-0.5",
                                            selectedContact?.id === contact.id ? "text-indigo-100/70" : isLight ? "text-slate-500" : "text-slate-500"
                                        )}>
                                            {contact.role}
                                        </p>
                                    </div>
                                    <div className="w-2 h-2 rounded-full bg-green-500/50" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className={cn(
                    "p-6 border-t flex-shrink-0",
                    isLight ? "border-slate-200 bg-slate-50" : "border-white/10 bg-black/40"
                )}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm">
                            Y
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={cn("text-xs font-black truncate", isLight ? "text-slate-900" : "text-white")}>YOU</p>
                            <p className={cn("text-[10px] font-bold flex items-center gap-1.5 uppercase tracking-tighter", isLight ? "text-emerald-600" : "text-green-400")}>
                                <ShieldCheck className="w-3 h-3" /> Ready
                            </p>
                        </div>
                        <Settings className={cn("w-4 h-4 cursor-pointer transition-colors", isLight ? "text-slate-500 hover:text-slate-700" : "text-slate-600 hover:text-white")} />
                    </div>
                </div>
            </div>

            {/* Chat Area - fixed header and input; only messages scroll */}
            <div className={cn(
                "flex-1 flex flex-col min-h-0 overflow-hidden",
                isLight ? "bg-slate-100" : "bg-slate-950/20",
                !selectedContact ? "hidden md:flex items-center justify-center" : "flex"
            )}>
                {selectedContact ? (
                    <>
                        <div className={cn(
                            "p-4 md:p-6 border-b flex items-center justify-between flex-shrink-0 z-10",
                            isLight ? "bg-white border-slate-200 shadow-sm" : "border-white/10 glass-panel backdrop-blur-md"
                        )}>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setSelectedContact(null)}
                                    className={cn("md:hidden w-10 h-10 rounded-xl border flex items-center justify-center", isLight ? "border-slate-200 text-slate-600" : "border-white/10 text-slate-400")}
                                >
                                    <Plus className="w-5 h-5 rotate-45" />
                                </button>
                                <div className={cn(
                                    "w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center font-black",
                                    isLight ? "bg-indigo-100 border border-indigo-200 text-indigo-600" : "bg-indigo-500/20 border border-indigo-500/30 text-indigo-400"
                                )}>
                                    {selectedContact.name[0].toUpperCase()}
                                </div>
                                <div>
                                    <h3 className={cn("font-black text-sm md:text-lg tracking-tight leading-none mb-1", isLight ? "text-slate-900" : "text-white")}>
                                        {selectedContact.name}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                        <span className={cn("text-[10px] font-black uppercase tracking-widest", isLight ? "text-slate-500" : "text-slate-500")}>Active Now</span>
                                        <div className={cn("h-3 w-[1px] mx-1", isLight ? "bg-slate-200" : "bg-white/10")} />
                                        <span className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1", isLight ? "text-indigo-600" : "text-indigo-400")}>
                                            Chat
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar scroll-smooth">
                            {messagesError && (
                                <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium flex items-center justify-between gap-2">
                                    <span>{messagesError}</span>
                                    <button type="button" onClick={() => setMessagesError(null)} className="shrink-0 text-red-400 hover:text-red-300" aria-label="Dismiss">×</button>
                                </div>
                            )}
                            {loadingMessages ? (
                                <div className="h-full flex flex-col items-center justify-center gap-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-600">Syncing History...</p>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center max-w-xs mx-auto opacity-80">
                                    <ShieldCheck className={cn("w-16 h-16 mb-4", isLight ? "text-indigo-500" : "text-indigo-500")} />
                                    <h4 className={cn("text-lg font-black mb-2", isLight ? "text-slate-900" : "text-white")}>Conversation Started</h4>
                                    <p className={cn("text-sm font-medium", isLight ? "text-slate-500" : "text-slate-400")}>Start chatting with your connection.</p>
                                </div>
                            ) : (
                                messages.map((msg, idx) => {
                                    const isMe = msg.senderId !== selectedContact.id
                                    const prevMsg = idx > 0 ? messages[idx - 1] : null
                                    const showTime = !prevMsg || format(new Date(msg.createdAt), "HH:mm") !== format(new Date(prevMsg.createdAt), "HH:mm")

                                    return (
                                        <div
                                            key={msg.id}
                                            className={cn(
                                                "flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500",
                                                isMe ? "items-end" : "items-start"
                                            )}
                                        >
                                            <div className={cn(
                                                "max-w-[85%] md:max-w-[70%] px-5 py-4 rounded-2xl text-sm font-medium relative group",
                                                isMe
                                                    ? "bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/10"
                                                    : isLight
                                                        ? "bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-md"
                                                        : "bg-white/5 border border-white/10 text-slate-200 rounded-tl-none backdrop-blur-sm shadow-xl"
                                            )}>
                                                {msg.kind === "PRODUCT" && msg.attachment ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveAttachmentKind("PRODUCT")
                                                            setActiveAttachment(msg.attachment)
                                                            setAttachmentModalOpen(true)
                                                        }}
                                                        className={cn("w-full text-left bg-transparent border-0 p-0 m-0")}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/10 border border-white/10 flex-shrink-0 flex items-center justify-center">
                                                                {msg.attachment.imageUrl ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={msg.attachment.imageUrl} alt={msg.attachment.title || "Product"} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="flex flex-col items-center justify-center px-1">
                                                                        <Package className="w-5 h-5 text-indigo-400" />
                                                                        <div className="text-[10px] font-black mt-1 leading-none text-indigo-200">
                                                                            {msg.attachment.title ? msg.attachment.title : ""}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-black truncate">
                                                                    {msg.attachment.title || msg.content}
                                                                </div>
                                                                {msg.attachment.description ? (
                                                                    <div className={cn("text-xs opacity-90 mt-1 line-clamp-2")}>
                                                                        {msg.attachment.description}
                                                                    </div>
                                                                ) : null}
                                                                {msg.attachment.storeName ? (
                                                                    <div className={cn("text-[10px] font-black uppercase tracking-widest mt-1 opacity-80")}>
                                                                        {msg.attachment.storeName}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </button>
                                                ) : msg.kind === "ORDER" && msg.attachment ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveAttachmentKind("ORDER")
                                                            setActiveAttachment(msg.attachment)
                                                            setAttachmentModalOpen(true)
                                                        }}
                                                        className={cn("w-full text-left")}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/10 border border-white/10 flex-shrink-0 flex items-center justify-center">
                                                                {msg.attachment.primaryImageUrl ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={msg.attachment.primaryImageUrl} alt="Order item" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="flex flex-col items-center justify-center px-1">
                                                                        <ShoppingCart className="w-5 h-5 text-indigo-400" />
                                                                        <div className="text-[10px] font-black mt-1 leading-none text-indigo-200">
                                                                            {msg.attachment.orderNumber || "#"}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-black truncate">
                                                                    Order {msg.attachment.orderNumber || msg.content}
                                                                </div>
                                                                {msg.attachment.customerName ? (
                                                                    <div className={cn("text-xs opacity-90 mt-1 line-clamp-1")}>
                                                                        {msg.attachment.customerName}
                                                                    </div>
                                                                ) : null}
                                                                {msg.attachment.total_price ? (
                                                                    <div className={cn("text-[10px] font-black uppercase tracking-widest mt-1 opacity-80")}>
                                                                        {msg.attachment.currency ? `${msg.attachment.currency} ` : ""}{msg.attachment.total_price}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </button>
                                                ) : (
                                                    msg.content
                                                )}
                                                <div className={cn(
                                                    "absolute bottom-2 -right-6 flex items-center gap-1 transition-opacity opacity-0 group-hover:opacity-100",
                                                    isMe ? "-left-8 right-auto flex-row-reverse" : ""
                                                )}>
                                                    {isMe && <CheckCheck className={cn("w-3.5 h-3.5", isLight ? "text-indigo-300" : "text-indigo-400")} />}
                                                </div>
                                            </div>
                                            {showTime && (
                                                <span className={cn("text-[10px] font-black mt-2 uppercase tracking-widest px-1", isLight ? "text-slate-500" : "text-slate-600")}>
                                                    {format(new Date(msg.createdAt), "HH:mm")}
                                                </span>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                            <div ref={messagesEndRef} />
                            {attachmentModalOpen && activeAttachmentKind && activeAttachment && typeof document !== "undefined"
                                ? createPortal(
                                <div
                                    className="fixed inset-0 z-[99999] bg-transparent"
                                    onClick={() => setAttachmentModalOpen(false)}
                                >
                                    <div className="min-h-screen flex items-center justify-center p-4 py-10">
                                        <div
                                            className={cn(
                                                "w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden",
                                                isLight ? "bg-white border-slate-200" : "bg-slate-900/95 border-white/10"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "flex items-center justify-between p-4 md:p-5 border-b flex-shrink-0",
                                                    isLight ? "border-slate-200 bg-white" : "border-white/10 bg-slate-900/95"
                                                )}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div
                                                        className={cn(
                                                            "w-10 h-10 rounded-xl flex items-center justify-center",
                                                            isLight ? "bg-indigo-100 text-indigo-600" : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20"
                                                        )}
                                                    >
                                                        {activeAttachmentKind === "PRODUCT" ? (
                                                            <Package className="w-5 h-5" />
                                                        ) : (
                                                            <ShoppingCart className="w-5 h-5" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className={cn("text-sm md:text-base font-black truncate", isLight ? "text-slate-900" : "text-white")}>
                                                            {activeAttachmentKind === "PRODUCT" ? "Product" : "Order"}
                                                        </h3>
                                                        <p className={cn("text-[11px] md:text-xs truncate", isLight ? "text-slate-500" : "text-slate-300/80")}>
                                                            {activeAttachmentKind === "PRODUCT"
                                                                ? activeAttachment.title || "Attached product"
                                                                : `Order ${activeAttachment.orderNumber || ""}`.trim()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setAttachmentModalOpen(false)}
                                                    className={cn(
                                                        "p-2 rounded-lg transition-colors flex-shrink-0",
                                                        isLight ? "hover:bg-slate-100 text-slate-600" : "hover:bg-white/10 text-slate-300"
                                                    )}
                                                    aria-label="Close attachment modal"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>

                                            <div className={cn("p-4 md:p-5 space-y-4", isLight ? "bg-white" : "bg-slate-900/95")}>
                                                {activeAttachmentKind === "PRODUCT" ? (
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-24 h-24 rounded-2xl overflow-hidden bg-black/10 border border-white/10 flex-shrink-0">
                                                            {activeAttachment.imageUrl ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img
                                                                    src={activeAttachment.imageUrl}
                                                                    alt={activeAttachment.title || "Product image"}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <Package className="w-7 h-7 text-indigo-400" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className={cn("font-black text-base md:text-lg truncate", isLight ? "text-slate-900" : "text-white")}>
                                                                {activeAttachment.title || "Product"}
                                                            </div>
                                                            {activeAttachment.storeName ? (
                                                                <div className={cn("text-[11px] font-black uppercase tracking-widest mt-1", isLight ? "text-indigo-600" : "text-indigo-300")}>
                                                                    {activeAttachment.storeName}
                                                                </div>
                                                            ) : null}
                                                            {activeAttachment.description ? (
                                                                <p className={cn("text-sm mt-2 leading-relaxed", isLight ? "text-slate-600" : "text-slate-300/90")}>
                                                                    {activeAttachment.description}
                                                                </p>
                                                            ) : (
                                                                <p className={cn("text-sm mt-2 opacity-70", isLight ? "text-slate-500" : "text-slate-400")}>
                                                                    No description provided.
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-24 h-24 rounded-2xl overflow-hidden bg-black/10 border border-white/10 flex-shrink-0 flex items-center justify-center">
                                                            {activeAttachment.primaryImageUrl ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img
                                                                    src={activeAttachment.primaryImageUrl}
                                                                    alt="Order image"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="flex flex-col items-center justify-center px-2 text-center">
                                                                    <ShoppingCart className="w-6 h-6 text-indigo-400" />
                                                                    <div className="text-[11px] font-black mt-2 leading-none text-indigo-200">
                                                                        {activeAttachment.orderNumber || ""}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className={cn("font-black text-base md:text-lg truncate", isLight ? "text-slate-900" : "text-white")}>
                                                                Order {activeAttachment.orderNumber || ""}
                                                            </div>
                                                            {activeAttachment.customerName ? (
                                                                <div className={cn("text-sm mt-1 leading-relaxed", isLight ? "text-slate-700" : "text-slate-200/90")}>
                                                                    Customer: {activeAttachment.customerName}
                                                                </div>
                                                            ) : null}
                                                            {activeAttachment.total_price ? (
                                                                <div className={cn("text-sm mt-2 font-bold", isLight ? "text-slate-700" : "text-slate-200/90")}>
                                                                    {activeAttachment.currency ? `${activeAttachment.currency} ` : ""}
                                                                    {activeAttachment.total_price}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>,
                                document.body
                            ) : null}
                        </div>

                        <div className="p-6 flex-shrink-0">
                            {sendError && (
                                <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium flex flex-wrap items-center justify-between gap-2">
                                    <span>{sendError}</span>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button type="button" onClick={() => setSendError(null)} className="text-red-400 hover:text-red-300" aria-label="Dismiss">×</button>
                                    </div>
                                </div>
                            )}
                            <form
                                onSubmit={handleSendMessage}
                                className={cn(
                                    "relative flex items-end gap-3 p-3 rounded-2xl transition-all shadow-lg",
                                    isLight
                                        ? "bg-white border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20"
                                        : "glass-panel bg-white/5 border border-white/10 focus-within:border-indigo-500/50 focus-within:bg-white/10"
                                )}
                            >
                                    <div className="relative" ref={attachRef}>
                                        <button
                                            type="button"
                                            onClick={openAttach}
                                            className={cn("p-3 rounded-xl transition-all", isLight ? "text-slate-500 hover:bg-slate-100 hover:text-indigo-600" : "hover:bg-white/5 text-slate-500 hover:text-indigo-400")}
                                            aria-label="Attach order or product"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                        {attachOpen && (
                                            <div
                                                className={cn(
                                                    "absolute bottom-full left-0 mb-2 w-80 max-h-72 overflow-hidden rounded-2xl shadow-xl border z-50 flex flex-col",
                                                    isLight ? "bg-white border-slate-200" : "bg-slate-800/95 border-white/10 backdrop-blur-xl"
                                                )}
                                            >
                                                <div className={cn("p-2 border-b flex items-center justify-between flex-shrink-0", isLight ? "border-slate-200" : "border-white/10")}>
                                                    <span className={cn("text-xs font-bold uppercase tracking-wider", isLight ? "text-slate-500" : "text-slate-400")}>
                                                        {isSupplier ? "Attach product" : "Attach order or product"}
                                                    </span>
                                                    <button type="button" onClick={() => setAttachOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500" aria-label="Close">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                                    {attachLoading ? (
                                                        <div className="flex items-center justify-center py-8">
                                                            <Loader2 className={cn("w-6 h-6 animate-spin", isLight ? "text-indigo-500" : "text-indigo-400")} />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {!isSupplier && attachOrders.length > 0 && (
                                                                <div className="mb-3">
                                                                    <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1", isLight ? "text-slate-500" : "text-slate-400")}>
                                                                        <ShoppingCart className="w-3 h-3" /> Orders
                                                                    </p>
                                                                    <div className="space-y-1">
                                                                        {attachOrders.map((order) => (
                                                                            <button
                                                                                key={`${order.storeId}-${order.id}`}
                                                                                type="button"
                                                                                onClick={() => insertOrder(order)}
                                                                                className={cn("w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors", isLight ? "hover:bg-slate-100 text-slate-800" : "hover:bg-white/10 text-slate-200")}
                                                                            >
                                                                                <span className="font-semibold">{order.name}</span>
                                                                                {order.storeName && <span className={cn("ml-1.5 text-[10px] uppercase tracking-wider", isLight ? "text-slate-500" : "text-slate-400")}>· {order.storeName}</span>}
                                                                                <span className="block text-xs opacity-80">{order.currency || ""}{order.total_price}</span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {attachProducts.length > 0 && (
                                                                <div>
                                                                    <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1", isLight ? "text-slate-500" : "text-slate-400")}>
                                                                        <Package className="w-3 h-3" /> Products
                                                                    </p>
                                                                    <div className="space-y-1">
                                                                        {attachProducts.map((product) => (
                                                                            <button
                                                                                key={product.storeId ? `${product.storeId}-${product.id}` : String(product.id)}
                                                                                type="button"
                                                                                onClick={() => insertProduct(product)}
                                                                                className={cn("w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors", isLight ? "hover:bg-slate-100 text-slate-800" : "hover:bg-white/10 text-slate-200")}
                                                                            >
                                                                                <span className="line-clamp-1">{product.title}</span>
                                                                                {product.storeName && <span className={cn("text-[10px] uppercase tracking-wider block mt-0.5", isLight ? "text-slate-500" : "text-slate-400")}>{product.storeName}</span>}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {!attachLoading && attachOrders.length === 0 && attachProducts.length === 0 && (
                                                                <p className={cn("py-6 text-center text-sm", isLight ? "text-slate-500" : "text-slate-500")}>
                                                                    {isSupplier ? "No products to attach." : "No orders or products found."}
                                                                </p>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <textarea
                                        rows={1}
                                        placeholder="Type a message..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault()
                                                handleSendMessage(e)
                                            }
                                        }}
                                        className={cn(
                                            "flex-1 max-h-40 py-3 bg-transparent border-none focus:outline-none focus:ring-0 text-sm resize-none font-medium custom-scrollbar",
                                            isLight ? "text-slate-900 placeholder:text-slate-400" : "text-white placeholder:text-slate-600"
                                        )}
                                    />
                                    <button
                                        type="submit"
                                        disabled={(!newMessage.trim() && !(draftKind && draftAttachment)) || sending}
                                        className={cn(
                                            "p-4 rounded-xl transition-all shadow-lg active:scale-90 disabled:opacity-50",
                                            (newMessage.trim() || (draftKind && draftAttachment))
                                                ? "bg-indigo-600 text-white shadow-indigo-600/20"
                                                : isLight ? "bg-slate-100 text-slate-500" : "bg-white/5 text-slate-700"
                                        )}
                                    >
                                        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                    </button>
                            </form>
                            <p className={cn("mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-center", isLight ? "text-slate-500" : "text-slate-600")}>
                                Real-time chat enabled
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center text-center p-12 max-w-sm">
                        <div className={cn("w-24 h-24 rounded-full flex items-center justify-center mb-8 relative", isLight ? "bg-indigo-100" : "bg-indigo-500/5")}>
                            <div className={cn("absolute inset-0 rounded-full animate-ping opacity-20", isLight ? "bg-indigo-300" : "bg-indigo-500/10")} />
                            <MessageSquare className={cn("w-10 h-10", isLight ? "text-indigo-400" : "text-indigo-500/40")} />
                        </div>
                        <h3 className={cn("text-2xl font-black mb-3 tracking-tight", isLight ? "text-slate-900" : "text-white")}>Your Direct Line</h3>
                        <p className={cn("text-sm font-medium leading-relaxed", isLight ? "text-slate-500" : "text-slate-500")}>
                            Messaging workspace for vendors and suppliers.
                            Select a contact to start a session.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
