'use client';

// Shared marketing header — the CLARITY-identity top bar used on the homepage
// and every dedicated marketing sub-page (features, use-cases, pricing, faq).
// The logo mark + wordmark is a single Link to the homepage ("/") so the logo
// always takes the visitor home, on every page. The nav items are real page
// navigations (not in-page anchors) so each destination is its own route.

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SignedIn, SignedOut } from '@/lib/auth/signed-gates';
import { Layers, ArrowRight, Menu, X } from 'lucide-react';

const SIGNUP_URL = '/signup';
const launchApp = () => {
  window.location.href = SIGNUP_URL;
};

const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/use-cases', label: 'Use Cases' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
];

export function MarketingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 lg:px-12 backdrop-blur-xl bg-white/80 border-b border-[#d3e6e4]">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo → home. The whole mark + wordmark is one clickable link. */}
        <Link
          href="/"
          aria-label="IdiamPro home"
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-600/20 group-hover:scale-105 transition-transform">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="flex flex-col leading-none">
            <span className="text-xl font-bold text-[#0c2224] group-hover:text-teal-700 transition-colors">
              IdiamPro
            </span>
            <span className="text-[10px] text-[#6b7d7e] tracking-wide mt-0.5">say it &ldquo;I-D-M Pro&rdquo;</span>
          </span>
        </Link>

        {/* Desktop nav — real routes */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[#47585a] hover:text-[#0c2224] transition-colors text-sm"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <SignedOut>
            <Button
              onClick={launchApp}
              className="hidden md:inline-flex bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] hover:from-[#0c5c5b] hover:to-[#0c5c5b] text-white font-semibold shadow-lg shadow-teal-600/25"
            >
              Sign up free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </SignedOut>
          <SignedIn>
            <Button
              onClick={() => { window.location.href = '/app'; }}
              className="hidden md:inline-flex bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] hover:from-[#0c5c5b] hover:to-[#0c5c5b] text-white font-semibold shadow-lg shadow-teal-600/25"
            >
              Open IdiamPro
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </SignedIn>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-[#d3e6e4] p-6">
          <div className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-[#0c2224] py-2"
              >
                {link.label}
              </Link>
            ))}
            <SignedOut>
              <Button
                onClick={launchApp}
                className="bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] text-white font-semibold w-full mt-2"
              >
                Sign up free
              </Button>
            </SignedOut>
            <SignedIn>
              <Button
                onClick={() => { window.location.href = '/app'; }}
                className="bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] text-white font-semibold w-full mt-2"
              >
                Open IdiamPro
              </Button>
            </SignedIn>
          </div>
        </div>
      )}
    </nav>
  );
}
