"use client"

import { useState, useEffect, useRef } from "react"
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
import { ChatAttachmentModal } from "@/components/chat/ChatAttachmentModal"

interface Contact {
    id: string
    connectionId: string
    storeId: string
    storeName: string | null
    name: string | null
    email: string | null
    image: string | null
    role: string
}

interface Message {
    id: string
    senderId: string
    receiverId: string
    storeId?: string | null
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
            const res = await fetch(
                `/api/chat/messages?contactId=${encodeURIComponent(contact.id)}&storeId=${encodeURIComponent(contact.storeId)}`
            )
            if (res.ok) {
                const data = await res.json()
                const typedMessages = data.messages.map((m: any) => ({
                    id: m.id,
                    senderId: m.senderId,
                    receiverId: m.receiverId,
                    storeId: m.storeId ?? null,
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
    }, [selectedContact?.connectionId])

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
        if (!selectedContact) return
        const threadStoreId = selectedContact.storeId
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
                    const allOrders = ordersData.orders || []
                    setAttachOrders(
                        allOrders.filter((o: AttachOrder) => o.storeId === threadStoreId)
                    )
                }
                if (productsRes.ok) {
                    const productsData = await productsRes.json()
                    const allProducts = productsData.products || []
                    setAttachProducts(
                        allProducts.filter((p: AttachProduct) => p.storeId === threadStoreId)
                    )
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
            storeId: order.storeId,
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
            storeId: product.storeId,
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
                storeId: selectedContact.storeId,
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
                    storeId: msg.storeId ?? selectedContact.storeId,
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

    // Best-effort compatibility for legacy bracket-style chat messages.
    // Example legacy content:
    // - [Product: Title · Store (#123)]
    // - [Order 1005 · Store - USD 25.00]
    const parseLegacyAttachment = (raw: string): { kind: "PRODUCT" | "ORDER"; attachment: any } | null => {
        const text = (raw || "").trim()
        if (!text) return null

        // PRODUCT
        if (text.startsWith("[Product:") && text.includes("]")) {
            const body = text
                .replace(/^\[Product:\s*/i, "")
                .replace(/\]\s*$/, "")
                .trim()

            const cleanedBody = body.replace(/\(#\d+\)\s*$/, "").trim()
            const parts = cleanedBody.split(" · ")
            const title = (parts[0] || "").trim()
            const storeName = parts.length > 1 ? parts.slice(1).join(" · ").trim() : null

            if (!title) return null
            return {
                kind: "PRODUCT",
                attachment: {
                    title,
                    description: null,
                    imageUrl: null,
                    storeName: storeName || null,
                },
            }
        }

        // ORDER
        if (text.startsWith("[Order") && text.includes("]")) {
            const body = text
                .replace(/^\[Order\s*/i, "")
                .replace(/\]\s*$/, "")
                .trim()

            // Split totals: "<orderNumber> · <storeName> - USD 25.00"
            const [leftPart, totalPartRaw] = body.split(" - ", 2)
            if (!leftPart) return null

            let orderNumber = leftPart.trim()
            let storeName: string | null = null
            if (leftPart.includes(" · ")) {
                const [leftOrder, ...rest] = leftPart.split(" · ")
                orderNumber = (leftOrder || "").trim()
                storeName = rest.join(" · ").trim() || null
            }

            const totalPart = (totalPartRaw || "").trim()
            let currency: string | null = null
            let total_price: string | null = null
            if (totalPart) {
                const tokens = totalPart.split(/\s+/)
                if (tokens.length >= 2 && tokens[0].length === 3) {
                    currency = tokens[0]
                    total_price = tokens.slice(1).join(" ")
                } else {
                    total_price = tokens.join(" ")
                }
            }

            if (!orderNumber) return null
            return {
                kind: "ORDER",
                attachment: {
                    orderNumber,
                    customerName: null,
                    primaryImageUrl: null,
                    total_price: total_price || null,
                    currency: currency || null,
                    storeName: storeName || null,
                },
            }
        }

        return null
    }

    const q = searchQuery.toLowerCase()
    const filteredContacts = contacts.filter(c => {
        const name = (c.name ?? "").toLowerCase()
        const email = (c.email ?? "").toLowerCase()
        const storeName = (c.storeName ?? "").toLowerCase()
        return name.includes(q) || email.includes(q) || storeName.includes(q)
    })

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
                                    key={contact.connectionId}
                                    onClick={() => setSelectedContact(contact)}
                                    className={cn(
                                        "w-full flex items-center gap-3 p-4 rounded-2xl transition-all group relative",
                                        selectedContact?.connectionId === contact.connectionId
                                            ? isLight ? "bg-indigo-600 shadow-lg text-white" : "bg-indigo-600 shadow-lg shadow-indigo-600/20"
                                            : isLight ? "hover:bg-slate-100" : "hover:bg-white/5"
                                    )}
                                >
                                    <div className="relative">
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center font-black transition-all",
                                            selectedContact?.connectionId === contact.connectionId
                                                ? "bg-white text-indigo-600"
                                                : isLight ? "bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600" : "bg-white/10 text-slate-300 group-hover:bg-indigo-500/20 group-hover:text-indigo-400"
                                        )}>
                                            {(contact.name?.[0] ?? contact.email?.[0] ?? "?").toUpperCase()}
                                        </div>
                                        <div className={cn("absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 bg-green-500", isLight ? "border-white" : "border-slate-900")} />
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <h4 className={cn(
                                            "text-sm font-black truncate tracking-tight",
                                            selectedContact?.connectionId === contact.connectionId ? "text-white" : isLight ? "text-slate-900" : "text-slate-200"
                                        )}>
                                            {contact.name ?? contact.email ?? "Unknown"}
                                        </h4>
                                        {contact.email ? (
                                            <p
                                                className={cn(
                                                    "text-[11px] font-medium truncate mt-0.5",
                                                    selectedContact?.connectionId === contact.connectionId ? "text-indigo-100/90" : isLight ? "text-slate-600" : "text-slate-400"
                                                )}
                                                title={contact.email}
                                            >
                                                {contact.email}
                                            </p>
                                        ) : null}
                                        {contact.storeName ? (
                                            <p
                                                className={cn(
                                                    "text-[10px] font-semibold truncate mt-0.5 normal-case tracking-normal",
                                                    selectedContact?.connectionId === contact.connectionId ? "text-indigo-100/85" : isLight ? "text-slate-600" : "text-slate-400"
                                                )}
                                                title={contact.storeName}
                                            >
                                                {contact.storeName}
                                            </p>
                                        ) : null}
                                        <p className={cn(
                                            "text-[10px] uppercase font-black tracking-widest mt-0.5",
                                            selectedContact?.connectionId === contact.connectionId ? "text-indigo-100/70" : isLight ? "text-slate-500" : "text-slate-500"
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
                                    {(selectedContact.name?.[0] ?? selectedContact.email?.[0] ?? "?").toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h3 className={cn("font-black text-sm md:text-lg tracking-tight leading-none mb-1 truncate", isLight ? "text-slate-900" : "text-white")}>
                                        {selectedContact.name ?? selectedContact.email ?? "Unknown"}
                                    </h3>
                                    {selectedContact.email ? (
                                        <p className={cn("text-xs font-medium truncate mb-1", isLight ? "text-slate-600" : "text-slate-400")} title={selectedContact.email}>
                                            {selectedContact.email}
                                        </p>
                                    ) : null}
                                    {selectedContact.storeName ? (
                                        <p className={cn("text-[10px] font-semibold truncate mb-1", isLight ? "text-slate-500" : "text-slate-500")} title={selectedContact.storeName}>
                                            {selectedContact.storeName}
                                        </p>
                                    ) : null}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
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
                                    const legacy =
                                        msg.kind === "TEXT" || !msg.kind
                                            ? parseLegacyAttachment(msg.content)
                                            : null
                                    const kindToRender =
                                        msg.kind === "PRODUCT" || msg.kind === "ORDER"
                                            ? msg.kind
                                            : legacy?.kind
                                    const attachmentToRender =
                                        kindToRender === "PRODUCT" || kindToRender === "ORDER"
                                            ? msg.kind
                                                ? msg.attachment
                                                : legacy?.attachment
                                            : null

                                    const threadStoreId = selectedContact.storeId
                                    let wrongStoreForRichCard = false
                                    if (
                                        (kindToRender === "PRODUCT" || kindToRender === "ORDER") &&
                                        threadStoreId
                                    ) {
                                        if (msg.storeId != null && msg.storeId !== "") {
                                            wrongStoreForRichCard = msg.storeId !== threadStoreId
                                        } else if (
                                            attachmentToRender &&
                                            typeof (attachmentToRender as { storeId?: string }).storeId ===
                                                "string" &&
                                            (attachmentToRender as { storeId: string }).storeId !== ""
                                        ) {
                                            wrongStoreForRichCard =
                                                (attachmentToRender as { storeId: string }).storeId !==
                                                threadStoreId
                                        }
                                    }
                                    const displayKind = wrongStoreForRichCard ? "TEXT" : kindToRender
                                    const displayAttachment = wrongStoreForRichCard ? null : attachmentToRender

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
                                                {displayKind === "PRODUCT" && displayAttachment ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveAttachmentKind("PRODUCT")
                                                            setActiveAttachment(displayAttachment)
                                                            setAttachmentModalOpen(true)
                                                        }}
                                                        className={cn("w-full text-left bg-transparent border-0 p-0 m-0")}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/10 border border-white/10 flex-shrink-0 flex items-center justify-center">
                                                                {displayAttachment.imageUrl ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={displayAttachment.imageUrl} alt={displayAttachment.title || "Product"} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="flex flex-col items-center justify-center px-1">
                                                                        <Package className="w-5 h-5 text-indigo-400" />
                                                                        <div className="text-[10px] font-black mt-1 leading-none text-indigo-200">
                                                                            {displayAttachment.title ? displayAttachment.title : ""}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-black truncate">
                                                                    {displayAttachment.title || msg.content}
                                                                </div>
                                                                {displayAttachment.description ? (
                                                                    <div className={cn("text-xs opacity-90 mt-1 line-clamp-2")}>
                                                                        {displayAttachment.description}
                                                                    </div>
                                                                ) : null}
                                                                {displayAttachment.storeName ? (
                                                                    <div className={cn("text-[10px] font-black uppercase tracking-widest mt-1 opacity-80")}>
                                                                        {displayAttachment.storeName}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </button>
                                                ) : displayKind === "ORDER" && displayAttachment ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveAttachmentKind("ORDER")
                                                            setActiveAttachment(displayAttachment)
                                                            setAttachmentModalOpen(true)
                                                        }}
                                                        className={cn("w-full text-left bg-transparent border-0 p-0 m-0")}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/10 border border-white/10 flex-shrink-0 flex items-center justify-center">
                                                                {displayAttachment.primaryImageUrl ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={displayAttachment.primaryImageUrl} alt="Order item" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="flex flex-col items-center justify-center px-1">
                                                                        <ShoppingCart className="w-5 h-5 text-indigo-400" />
                                                                        <div className="text-[10px] font-black mt-1 leading-none text-indigo-200">
                                                                            {displayAttachment.orderNumber || "#"}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-black truncate">
                                                                    Order {displayAttachment.orderNumber || msg.content}
                                                                </div>
                                                                {displayAttachment.customerName ? (
                                                                    <div className={cn("text-xs opacity-90 mt-1 line-clamp-1")}>
                                                                        {displayAttachment.customerName}
                                                                    </div>
                                                                ) : null}
                                                                {displayAttachment.total_price ? (
                                                                    <div className={cn("text-[10px] font-black uppercase tracking-widest mt-1 opacity-80")}>
                                                                        {displayAttachment.currency ? `${displayAttachment.currency} ` : ""}{displayAttachment.total_price}
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
                            <ChatAttachmentModal
                                isOpen={attachmentModalOpen}
                                onClose={() => setAttachmentModalOpen(false)}
                                kind={activeAttachmentKind}
                                attachment={activeAttachment}
                                isLight={isLight}
                            />
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
