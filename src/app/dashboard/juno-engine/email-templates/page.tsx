"use client"

import { useState } from "react"
import { 
    FileText, 
    Search, 
    Plus,
    Loader2,
    Edit,
    Trash2,
    Copy,
    Eye
} from "lucide-react"

interface EmailTemplate {
    id: string
    name: string
    subject: string
    category: "support" | "order" | "marketing" | "general"
    updatedAt: string
}

export default function EmailTemplatesPage() {
    const [searchTerm, setSearchTerm] = useState("")
    const [templates, setTemplates] = useState<EmailTemplate[]>([])
    const [loading, setLoading] = useState(false)

    const getCategoryStyles = (category: string) => {
        switch (category) {
            case "support": return "bg-blue-500/20 text-blue-400"
            case "order": return "bg-emerald-500/20 text-emerald-400"
            case "marketing": return "bg-purple-500/20 text-purple-400"
            case "general": return "bg-slate-500/20 text-slate-400"
            default: return "bg-white/10 text-slate-400"
        }
    }

    return (
        <div className="h-full flex flex-col space-y-4 md:space-y-6">
            <div className="bg-white/5 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="p-4 md:p-6 border-b border-white/10 flex flex-col sm:flex-row gap-3 md:gap-4 justify-between bg-white/5 flex-shrink-0">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search email templates..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-10 md:h-11 pl-10 md:pl-11 pr-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 text-white placeholder:text-slate-500 text-sm font-medium transition-all"
                        />
                    </div>
                    <button className="h-10 md:h-11 px-4 bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-600 border border-indigo-400/20 transition-all text-sm shrink-0">
                        <Plus className="w-4 h-4" /> New Template
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-auto -mx-4 md:mx-0">
                    <div className="min-w-full px-4 md:px-0">
                        {loading ? (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                                <p className="font-medium animate-pulse">Loading templates...</p>
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
                                <FileText className="w-10 h-10 opacity-20" />
                                <p className="font-medium">No email templates found.</p>
                                <p className="text-xs text-slate-500">Create your first template to get started.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 p-4 md:p-6">
                                {templates.map((template) => (
                                    <div
                                        key={template.id}
                                        className="bg-white/5 backdrop-blur-xl p-4 md:p-6 rounded-xl md:rounded-2xl border border-white/10 hover:bg-white/[0.07] hover:border-indigo-500/30 transition-all group"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-base md:text-lg text-white truncate group-hover:text-indigo-400 transition-colors">
                                                    {template.name}
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-1 truncate">{template.subject}</p>
                                            </div>
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${getCategoryStyles(template.category)}`}>
                                                {template.category}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                            <span className="text-[10px] text-slate-500 font-medium">
                                                Updated {new Date(template.updatedAt).toLocaleDateString()}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-indigo-400 transition-all" title="Preview">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-indigo-400 transition-all" title="Edit">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-indigo-400 transition-all" title="Duplicate">
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <button className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-red-400 transition-all" title="Delete">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
