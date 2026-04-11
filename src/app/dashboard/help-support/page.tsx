"use client"

import { useState } from "react"
import {
    HelpCircle,
    Book,
    MessageCircle,
    Video,
    FileText,
    Mail,
    Search,
    ChevronRight,
    Package,
    ShoppingCart,
    Users
} from "lucide-react"

interface FAQItem {
    id: string
    question: string
    answer: string
    category: "getting-started" | "inventory" | "orders" | "suppliers" | "general"
}

const faqCategories = [
    { id: "getting-started", label: "Getting Started", icon: Book },
    { id: "inventory", label: "Inventory Management", icon: Package },
    { id: "orders", label: "Orders & Fulfillment", icon: ShoppingCart },
    { id: "suppliers", label: "Suppliers", icon: Users },
    { id: "general", label: "General", icon: HelpCircle },
]

const faqs: FAQItem[] = [
    {
        id: "1",
        question: "How do I connect my Shopify store?",
        answer: "Navigate to Stores > Add Store and enter your Shopify store credentials. You'll need your store domain, API key, and API secret. Follow the step-by-step onboarding process to complete the connection.",
        category: "getting-started"
    },
    {
        id: "2",
        question: "How do I sync my products?",
        answer: "Products are automatically synced from your connected Shopify store. You can manually refresh by going to Inventory and clicking the refresh button. Products sync every 10 seconds automatically.",
        category: "inventory"
    },
    {
        id: "3",
        question: "How do I manage orders?",
        answer: "All orders from your Shopify store appear in the Orders page. You can view order details, track fulfillment status, and manage customer information. Orders sync automatically every 15 seconds.",
        category: "orders"
    },
    {
        id: "4",
        question: "How do I connect with suppliers?",
        answer: "Go to Suppliers > Discover Global to browse available suppliers. You can connect with suppliers, view their products, and manage your supplier relationships from the My Suppliers page.",
        category: "suppliers"
    },
    {
        id: "5",
        question: "What is JUNO Engine?",
        answer: "JUNO Engine is our communication and support infrastructure. It includes ticket views from email activity, email flagging, Gmail integration, and L1 AI replies driven by your knowledge base and module settings (JUNO Engine → Modules).",
        category: "general"
    },
    {
        id: "6",
        question: "How do I export my data?",
        answer: "You can export order data as CSV from the Orders page. Additional export options are planned.",
        category: "general"
    }
]

export default function HelpSupportPage() {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [expandedFaq, setExpandedFaq] = useState<string | null>(null)

    const filteredFaqs = faqs.filter(faq => {
        const matchesSearch = faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = !selectedCategory || faq.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    return (
        <div className="h-full flex flex-col space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Help & Support</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Find answers and get help with JUNO.</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
                <a
                    href="mailto:support@junohub.com"
                    className="bg-white/5 backdrop-blur-xl p-4 md:p-6 rounded-xl md:rounded-2xl border border-white/10 hover:bg-white/[0.07] hover:border-indigo-500/30 transition-all group cursor-pointer"
                >
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center mb-3 group-hover:bg-indigo-500/30 transition-colors">
                        <Mail className="w-6 h-6 text-indigo-400" />
                    </div>
                    <h3 className="font-bold text-white mb-1">Contact Support</h3>
                    <p className="text-xs text-slate-400">Get help from our team</p>
                </a>

                <a
                    href="#"
                    className="bg-white/5 backdrop-blur-xl p-4 md:p-6 rounded-xl md:rounded-2xl border border-white/10 hover:bg-white/[0.07] hover:border-indigo-500/30 transition-all group cursor-pointer"
                >
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/20 flex items-center justify-center mb-3 group-hover:bg-blue-500/30 transition-colors">
                        <MessageCircle className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="font-bold text-white mb-1">Live Chat</h3>
                    <p className="text-xs text-slate-400">Chat with support</p>
                </a>

                <a
                    href="#"
                    className="bg-white/5 backdrop-blur-xl p-4 md:p-6 rounded-xl md:rounded-2xl border border-white/10 hover:bg-white/[0.07] hover:border-indigo-500/30 transition-all group cursor-pointer"
                >
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-400/20 flex items-center justify-center mb-3 group-hover:bg-purple-500/30 transition-colors">
                        <Video className="w-6 h-6 text-purple-400" />
                    </div>
                    <h3 className="font-bold text-white mb-1">Video Tutorials</h3>
                    <p className="text-xs text-slate-400">Watch how-to guides</p>
                </a>

                <a
                    href="#"
                    className="bg-white/5 backdrop-blur-xl p-4 md:p-6 rounded-xl md:rounded-2xl border border-white/10 hover:bg-white/[0.07] hover:border-indigo-500/30 transition-all group cursor-pointer"
                >
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/20 flex items-center justify-center mb-3 group-hover:bg-emerald-500/30 transition-colors">
                        <FileText className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h3 className="font-bold text-white mb-1">Documentation</h3>
                    <p className="text-xs text-slate-400">Read detailed guides</p>
                </a>
            </div>

            {/* Search */}
            <div className="bg-white/5 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 overflow-hidden flex-shrink-0">
                <div className="p-4 md:p-6">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search for help..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 text-white placeholder:text-slate-500 text-sm font-medium transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Categories */}
            <div className="flex gap-2 md:gap-3 overflow-x-auto flex-shrink-0 pb-2">
                <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all duration-200 ease-out ${
                        selectedCategory === null
                            ? "bg-indigo-500 text-white"
                            : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10"
                    }`}
                >
                    All Topics
                </button>
                {faqCategories.map((category) => {
                    const Icon = category.icon
                    return (
                        <button
                            key={category.id}
                            onClick={() => setSelectedCategory(category.id)}
                            className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all duration-200 ease-out flex items-center gap-2 ${
                                selectedCategory === category.id
                                    ? "bg-indigo-500 text-white"
                                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10"
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {category.label}
                        </button>
                    )
                })}
            </div>

            {/* FAQ Section */}
            <div className="flex-1 overflow-y-auto">
                <div className="space-y-3">
                    {filteredFaqs.length === 0 ? (
                        <div className="bg-white/5 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 p-8 md:p-12 text-center">
                            <HelpCircle className="w-12 h-12 text-slate-400 mx-auto mb-4 opacity-20" />
                            <p className="text-slate-400 font-medium">No results found</p>
                            <p className="text-xs text-slate-500 mt-1">Try a different search term or category</p>
                        </div>
                    ) : (
                        filteredFaqs.map((faq) => (
                            <div
                                key={faq.id}
                                className="bg-white/5 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 overflow-hidden transition-all hover:bg-white/[0.07] hover:border-indigo-500/30"
                            >
                                <button
                                    onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                                    className="w-full p-4 md:p-6 flex items-start justify-between gap-4 text-left"
                                >
                                    <div className="flex-1">
                                        <h3 className="font-bold text-white mb-2">{faq.question}</h3>
                                        {expandedFaq === faq.id && (
                                            <p className="text-sm text-slate-400 mt-2 leading-relaxed">{faq.answer}</p>
                                        )}
                                    </div>
                                    <ChevronRight
                                        className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                                            expandedFaq === faq.id ? "rotate-90" : ""
                                        }`}
                                    />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
