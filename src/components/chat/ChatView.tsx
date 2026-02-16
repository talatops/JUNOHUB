"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { getSession } from "next-auth/react"
import { useChatCrypto, PRIVATE_KEY_STORAGE_KEY, PUBLIC_KEY_STORAGE_KEY } from "@/hooks/useChatCrypto"
import { ChatCrypto } from "@/lib/chat-crypto"
import { useTheme } from "@/components/ThemeProvider"
import {
    Send,
    Search,
    ShieldCheck,
    Loader2,
    Plus,
    Lock,
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
    publicKey: string | null
    role: string
}

interface Message {
    id: string
    senderId: string
    receiverId: string
    content: string
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

type AttachOrder = { id: number; name: string; total_price: string; currency?: string; storeId?: string; storeName?: string }
type AttachProduct = { id: number | string; title: string; storeId?: string; storeName?: string }

export function ChatView() {
    const pathname = usePathname()
    const isSupplier = pathname.startsWith("/supplier")
    const { theme } = useTheme()
    const isLight = theme === "light"
    const { hasKeys, loading: cryptoLoading, setupKeys, privateKey, getStoredPublicKey } = useChatCrypto()

    const [contacts, setContacts] = useState<Contact[]>([])
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState("")
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
    const autoSetupAttemptedRef = useRef(false)

    const handleSetup = async () => {
        try {
            setContactsError(null)
            await setupKeys()
            await getSession()
            fetchContacts()
        } catch (error) {
            console.error("Setup failed", error)
            setContactsError("Failed to set up encryption. Please try again.")
        }
    }

    // Auto-setup chat keys when user has none (e.g. supplier who just accepted invitation)
    useEffect(() => {
        if (cryptoLoading || hasKeys || autoSetupAttemptedRef.current) return
        autoSetupAttemptedRef.current = true
        setContactsError(null)
        setupKeys()
            .then(() => getSession())
            .then(() => fetchContacts())
            .catch((err) => {
                console.error("Auto setup failed", err)
                autoSetupAttemptedRef.current = false
                setContactsError("Encryption setup failed. Click below to try again.")
            })
    }, [cryptoLoading, hasKeys, setupKeys])

    const fetchContacts = async () => {
        try {
            setLoadingContacts(true)
            setContactsError(null)
            // Sync current user's public key to DB so the other party always has our latest key (fixes decrypt when they send to us)
            const storedPublic = getStoredPublicKey?.() ?? null
            if (storedPublic) {
                try {
                    await fetch("/api/user/chat-setup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ publicKey: storedPublic })
                    })
                } catch {
                    // Non-blocking; contacts can still load
                }
            }
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
        if (!privateKey) return
        try {
            if (!silent) {
                setLoadingMessages(true)
                setMessagesError(null)
            }
            const res = await fetch(`/api/chat/messages?contactId=${contact.id}`)
            if (res.ok) {
                const data = await res.json()
                const decryptedMessages = await Promise.all(
                    data.messages.map(async (m: { id: string; senderId: string; receiverId: string; encryptedContent: string; encryptedKeyForSender: string; encryptedKeyForReceiver: string; iv: string; createdAt: string }) => {
                        const primaryKey = m.senderId === contact.id ? m.encryptedKeyForReceiver : m.encryptedKeyForSender
                        const fallbackKey = m.senderId === contact.id ? m.encryptedKeyForSender : m.encryptedKeyForReceiver
                        for (const keyBlob of [primaryKey, fallbackKey]) {
                            try {
                                const decrypted = await ChatCrypto.decryptMessage(
                                    m.encryptedContent,
                                    keyBlob,
                                    m.iv,
                                    privateKey
                                )
                                return {
                                    id: m.id,
                                    senderId: m.senderId,
                                    receiverId: m.receiverId,
                                    content: decrypted,
                                    createdAt: m.createdAt
                                }
                            } catch {
                                continue
                            }
                        }
                        return {
                            id: m.id,
                            senderId: m.senderId,
                            receiverId: m.receiverId,
                            content: "[Encrypted Message - Error Decrypting]",
                            createdAt: m.createdAt
                        }
                    })
                )
                setMessages(decryptedMessages)
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
        if (hasKeys) fetchContacts()
    }, [hasKeys])

    useEffect(() => {
        if (selectedContact) {
            fetchMessages(selectedContact)
        } else {
            setMessages([])
        }
    }, [selectedContact, privateKey])

    // Poll for new messages when a contact is selected
    const POLL_INTERVAL_MS = 8000
    useEffect(() => {
        if (!selectedContact || !privateKey) return
        const interval = setInterval(() => {
            fetchMessages(selectedContact, true)
        }, POLL_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [selectedContact?.id, privateKey])

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
                    const list = (data.products || []).map((p: { id: string; title?: string; shopifyProductTitle?: string }) => ({
                        id: p.id,
                        title: p.title || p.shopifyProductTitle || "Product"
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
        const storePart = order.storeName ? ` · ${order.storeName}` : ""
        const line = `[Order ${order.name}${storePart} - ${order.currency || ""} ${order.total_price}]\n`
        setNewMessage(prev => (prev ? prev + line : line.trim()))
        setAttachOpen(false)
    }

    const insertProduct = (product: AttachProduct) => {
        const storePart = product.storeName ? ` · ${product.storeName}` : ""
        const line = `[Product: ${product.title}${storePart}${typeof product.id === "number" ? ` (#${product.id})` : ""}]\n`
        setNewMessage(prev => (prev ? prev + line : line.trim()))
        setAttachOpen(false)
    }

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim() || !selectedContact || !selectedContact.publicKey || !privateKey) return

        try {
            setSending(true)
            setSendError(null)
            let meData: { user?: { chatPublicKey?: string } } = {}
            try {
                const session = await getSession()
                meData = { user: session?.user ? { chatPublicKey: (session.user as { chatPublicKey?: string }).chatPublicKey } : {} }
            } catch {
                const res = await fetch("/api/auth/session")
                meData = await res.json()
            }
            let myPublicKey = meData.user?.chatPublicKey

            if (!myPublicKey && getStoredPublicKey) {
                const storedPublic = getStoredPublicKey()
                if (storedPublic) {
                    const syncRes = await fetch("/api/user/chat-setup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ publicKey: storedPublic })
                    })
                    if (syncRes.ok) myPublicKey = storedPublic
                }
            }

            if (!myPublicKey) {
                setSendError("Encryption key not ready. Please refresh the page and try again.")
                return
            }

            const encrypted = await ChatCrypto.encryptMessage(
                newMessage,
                myPublicKey,
                selectedContact.publicKey
            )

            const res = await fetch("/api/chat/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    receiverId: selectedContact.id,
                    ...encrypted
                })
            })

            if (res.ok) {
                const msg = await res.json()
                const optimiticMsg: Message = {
                    id: msg.id,
                    senderId: msg.senderId,
                    receiverId: msg.receiverId,
                    content: newMessage,
                    createdAt: msg.createdAt
                }
                setMessages(prev => [...prev, optimiticMsg])
                setNewMessage("")
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

    if (cryptoLoading) {
        return (
            <div className={cn("h-full flex flex-col items-center justify-center gap-4", isLight ? "bg-slate-50" : "")}>
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <p className={cn("font-medium", isLight ? "text-slate-600" : "text-slate-400")}>Initializing JUNO CHAT...</p>
            </div>
        )
    }

    if (!hasKeys) {
        return (
            <div className={cn("h-full flex flex-col items-center justify-center p-6 text-center", isLight ? "bg-slate-50" : "")}>
                <div className={cn(
                    "w-20 h-20 rounded-3xl flex items-center justify-center mb-8 animate-pulse shadow-2xl",
                    isLight ? "bg-indigo-100 border border-indigo-200 shadow-indigo-200" : "bg-indigo-500/20 border border-indigo-500/30 shadow-indigo-500/20"
                )}>
                    <ShieldCheck className={cn("w-10 h-10", isLight ? "text-indigo-600" : "text-indigo-400")} />
                </div>
                <h1 className={cn("text-3xl font-black mb-4 tracking-tight", isLight ? "text-slate-900" : "text-white")}>Enable JUNO CHAT</h1>
                <p className={cn("max-w-sm mb-10 leading-relaxed font-medium", isLight ? "text-slate-600" : "text-slate-400")}>
                    JUNO CHAT uses industry-standard <strong>AES-256 E2E Encryption</strong>.
                    Set up your secure keys to start chatting with your connections.
                </p>
                <button
                    onClick={handleSetup}
                    disabled={sending}
                    className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all shadow-xl shadow-indigo-500/30 flex items-center gap-3 active:scale-95 disabled:opacity-50"
                >
                    {sending && <Loader2 className="w-5 h-5 animate-spin" />}
                    Initialize Encryption
                </button>
                <p className={cn("mt-8 text-[10px] uppercase tracking-widest font-black flex items-center gap-2", isLight ? "text-slate-500" : "text-slate-500")}>
                    <Lock className="w-3 h-3" /> Private keys never leave your browser
                </p>
            </div>
        )
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
                                    <div className={cn(
                                        "w-2 h-2 rounded-full",
                                        contact.publicKey ? "bg-green-500/50" : "bg-red-500/50"
                                    )} />
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
                                <ShieldCheck className="w-3 h-3" /> Encrypted Ready
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
                                            <Lock className="w-2.5 h-2.5" /> End-to-End
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
                                    <h4 className={cn("text-lg font-black mb-2", isLight ? "text-slate-900" : "text-white")}>Secure Connection Started</h4>
                                    <p className={cn("text-sm font-medium", isLight ? "text-slate-500" : "text-slate-400")}>Messages are encrypted before leaving your device.</p>
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
                                                {msg.content}
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
                        </div>

                        <div className="p-6 flex-shrink-0">
                            {sendError && (
                                <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium flex flex-wrap items-center justify-between gap-2">
                                    <span>{sendError}</span>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {sendError.includes("Encryption key not ready") && (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    setSendError(null)
                                                    try {
                                                        localStorage.removeItem(PRIVATE_KEY_STORAGE_KEY)
                                                        localStorage.removeItem(PUBLIC_KEY_STORAGE_KEY)
                                                        await setupKeys()
                                                        await getSession()
                                                        fetchContacts()
                                                    } catch {
                                                        setSendError("Re-setup failed. Please refresh the page.")
                                                    }
                                                }}
                                                className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-bold uppercase tracking-wider"
                                            >
                                                Re-setup encryption
                                            </button>
                                        )}
                                        <button type="button" onClick={() => setSendError(null)} className="text-red-400 hover:text-red-300" aria-label="Dismiss">×</button>
                                    </div>
                                </div>
                            )}
                            {!selectedContact.publicKey ? (
                                <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
                                    <p className="text-sm text-red-400 font-black uppercase tracking-tighter flex items-center justify-center gap-2">
                                        <AlertCircle className="w-4 h-4" /> Connection Not Ready
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-2 font-medium">
                                        This contact hasn't set up their JUNO CHAT keys yet.
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                        Ask them to open <strong>JUNO CHAT</strong> once; keys are set up automatically.
                                    </p>
                                </div>
                            ) : (
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
                                        placeholder="Type encrypted message..."
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
                                        disabled={!newMessage.trim() || sending}
                                        className={cn(
                                            "p-4 rounded-xl transition-all shadow-lg active:scale-90 disabled:opacity-50",
                                            newMessage.trim()
                                                ? "bg-indigo-600 text-white shadow-indigo-600/20"
                                                : isLight ? "bg-slate-100 text-slate-500" : "bg-white/5 text-slate-700"
                                        )}
                                    >
                                        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                    </button>
                                </form>
                            )}
                            <p className={cn("mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-center", isLight ? "text-slate-500" : "text-slate-600")}>
                                <Lock className="inline w-2.5 h-2.5 mr-1 mb-0.5" /> Military-Grade AES-256 Protocol
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
                            Encrypted workspace for vendors and suppliers.
                            Select a contact to start a secure session.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
