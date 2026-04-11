"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Twitter, Github, Linkedin, Mail } from "lucide-react"
import Image from "next/image"

export function LandingFooter() {
    return (
        <footer className="py-20 border-t border-white/5 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-indigo-600/10 blur-[120px] rounded-full -z-10 will-change-transform" />

            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    <div className="col-span-1 md:col-span-1">
                        <Link href="/" className="flex items-center gap-3 mb-6 group">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-white/10 flex items-center justify-center backdrop-blur-sm overflow-hidden shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                                <Image
                                    src="/logo.png"
                                    alt="JUNO Logo"
                                    width={40}
                                    height={40}
                                    className="object-cover"
                                />
                            </div>
                            <span className="text-xl font-black tracking-titter text-white">JUNO</span>
                        </Link>
                        <p className="text-slate-300 font-medium mb-8">
                            The next generation of supply chain connectivity. Secure, encrypted, and real-time.
                        </p>
                        <div className="flex items-center gap-4">
                            <a href="#" aria-label="Follow us on Twitter" className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all">
                                <Twitter className="w-5 h-5" />
                            </a>
                            <a href="#" aria-label="Connect on LinkedIn" className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all">
                                <Linkedin className="w-5 h-5" />
                            </a>
                            <a href="#" aria-label="View our GitHub" className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all">
                                <Github className="w-5 h-5" />
                            </a>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-white font-black uppercase tracking-widest text-sm mb-6">Platform</h4>
                        <ul className="space-y-4">
                            <li><Link href="/platform" className="text-slate-300 hover:text-indigo-400 transition-colors font-medium">Features</Link></li>
                            <li><Link href="/platform" className="text-slate-300 hover:text-indigo-400 transition-colors font-medium">Shopify Sync</Link></li>
                            <li><Link href="/platform" className="text-slate-300 hover:text-indigo-400 transition-colors font-medium">Security</Link></li>
                            <li><Link href="/platform" className="text-slate-300 hover:text-indigo-400 transition-colors font-medium">API</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-black uppercase tracking-widest text-sm mb-6">Company</h4>
                        <ul className="space-y-4">
                            <li><Link href="/about" className="text-slate-300 hover:text-indigo-400 transition-colors font-medium">About Us</Link></li>
                            <li><Link href="/privacy-policy" className="text-slate-300 hover:text-indigo-400 transition-colors font-medium">Privacy Policy</Link></li>
                            <li><Link href="/terms-of-service" className="text-slate-300 hover:text-indigo-400 transition-colors font-medium">Terms of Service</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-black uppercase tracking-widest text-sm mb-6">Newsletter</h4>
                        <p className="text-slate-300 font-medium mb-6">Stay updated with the latest in supply chain tech.</p>

                        {/* Status Message */}
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                const form = e.currentTarget;
                                const email = new FormData(form).get("email") as string;
                                const btn = form.querySelector('button');
                                const statusEl = document.getElementById('newsletter-status');

                                if (btn) btn.disabled = true;
                                if (statusEl) {
                                    statusEl.textContent = "Processing...";
                                    statusEl.className = "text-xs font-bold text-indigo-400 mt-2 block";
                                }

                                try {
                                    const res = await fetch("/api/newsletter/subscribe", {
                                        method: "POST",
                                        body: JSON.stringify({ email }),
                                        headers: { "Content-Type": "application/json" }
                                    });
                                    if (res.ok) {
                                        if (statusEl) {
                                            statusEl.textContent = "Successfully subscribed! ⚡";
                                            statusEl.className = "text-xs font-bold text-emerald-400 mt-2 block";
                                        }
                                        form.reset();
                                        setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, 5000);
                                    } else {
                                        if (statusEl) {
                                            statusEl.textContent = "Something went wrong. Try again.";
                                            statusEl.className = "text-xs font-bold text-rose-400 mt-2 block";
                                        }
                                    }
                                } catch (err) {
                                    if (statusEl) {
                                        statusEl.textContent = "Connection error.";
                                        statusEl.className = "text-xs font-bold text-rose-400 mt-2 block";
                                    }
                                } finally {
                                    if (btn) btn.disabled = false;
                                }
                            }}
                            className="flex flex-col gap-2"
                        >
                            <div className="flex gap-2">
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    maxLength={254}
                                    placeholder="Enter your email"
                                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors flex-1"
                                />
                                <button
                                    type="submit"
                                    aria-label="Subscribe to newsletter"
                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                                >
                                    <Mail className="w-5 h-5" />
                                </button>
                            </div>
                            <span id="newsletter-status" className="h-4"></span>
                        </form>
                    </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-slate-400 font-medium">
                        © 2026 JUNO. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6">
                        <Link href="/terms-of-service" className="text-xs text-slate-400 hover:text-indigo-300 font-bold uppercase tracking-widest">Terms</Link>
                        <Link href="/privacy-policy" className="text-xs text-slate-400 hover:text-indigo-300 font-bold uppercase tracking-widest">Privacy</Link>
                        <Link href="/cookies" className="text-xs text-slate-400 hover:text-indigo-300 font-bold uppercase tracking-widest">Cookies</Link>
                    </div>
                </div>
            </div>
        </footer>
    )
}
