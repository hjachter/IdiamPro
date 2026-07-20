'use client';

/**
 * Upgrade Cancel — Stripe redirects here when the user backs out of
 * Checkout. Gentle "no charge — here's why you might still want Pro" pitch.
 */

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowLeft } from 'lucide-react';

export default function UpgradeCancelPage() {
  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-16 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Sparkles className="h-10 w-10 text-muted-foreground" />
        </div>

        <h1 className="text-3xl font-bold lg:text-4xl">No charge made.</h1>
        <p className="mt-3 text-base text-muted-foreground lg:text-lg">
          You closed the checkout before completing payment. Nothing was
          charged — keep using IdeaM free as long as you like.
        </p>

        <div className="mt-8 max-w-md rounded-2xl border bg-card p-5 text-left">
          <h2 className="text-lg font-semibold">Why upgrade later?</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <strong>1,000 AI generations a month</strong> on Pro — enough
              for daily research without thinking about it.
            </li>
            <li>
              <strong>Podcast generation</strong> turns any branch into a
              listenable audio brief.
            </li>
            <li>
              <strong>Image generation</strong> drops illustrations straight
              into your outlines.
            </li>
            <li>
              <strong>Priority support</strong> when you need a fast answer.
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Or stay on Free (BYOK) forever — bring your own AI key and you get
            unlimited generations, no monthly fee.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" size="lg">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to IdeaM
            </Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/upgrade">See plans again</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
