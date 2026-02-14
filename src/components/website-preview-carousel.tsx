'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, ExternalLink, Megaphone, Building2, BookOpen, Palette, Calendar, GraduationCap, Newspaper, User, Lock } from 'lucide-react';

const TEMPLATES = [
  { id: 'marketing', name: 'Marketing', icon: Megaphone, color: 'from-orange-500 to-red-500', premium: false },
  { id: 'informational', name: 'Informational', icon: Building2, color: 'from-blue-500 to-cyan-500', premium: false },
  { id: 'documentation', name: 'Documentation', icon: BookOpen, color: 'from-emerald-500 to-green-500', premium: false },
  { id: 'portfolio', name: 'Portfolio', icon: Palette, color: 'from-purple-500 to-pink-500', premium: true },
  { id: 'event', name: 'Event', icon: Calendar, color: 'from-amber-500 to-orange-500', premium: true },
  { id: 'educational', name: 'Educational', icon: GraduationCap, color: 'from-indigo-500 to-blue-500', premium: true },
  { id: 'blog', name: 'Blog', icon: Newspaper, color: 'from-rose-500 to-pink-500', premium: true },
  { id: 'personal', name: 'Personal', icon: User, color: 'from-teal-500 to-emerald-500', premium: true },
];

export default function WebsitePreviewCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeTemplate = TEMPLATES[activeIndex];

  const goToPrev = () => {
    setActiveIndex((prev) => (prev === 0 ? TEMPLATES.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setActiveIndex((prev) => (prev === TEMPLATES.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="w-full">
      {/* Template selector pills */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {TEMPLATES.map((template, index) => {
          const Icon = template.icon;
          const isActive = index === activeIndex;
          return (
            <button
              key={template.id}
              onClick={() => setActiveIndex(index)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
                ${isActive
                  ? `bg-gradient-to-r ${template.color} text-white shadow-lg scale-105`
                  : 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {template.name}
              {template.premium && !isActive && (
                <Lock className="w-3 h-3 text-amber-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Main preview area */}
      <div className="relative">
        {/* Browser chrome mockup */}
        <div className="bg-gray-800 rounded-t-xl p-3 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <div className="flex-1 bg-gray-700 rounded-md px-3 py-1 text-sm text-gray-400 text-center truncate">
            longevityblueprint.example.com/{activeTemplate.id}
          </div>
          <a
            href={`/examples/${activeTemplate.id}.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4 text-gray-400 hover:text-white" />
          </a>
        </div>

        {/* iframe preview */}
        <div className="relative bg-white rounded-b-xl overflow-hidden" style={{ height: '500px' }}>
          <iframe
            src={`/examples/${activeTemplate.id}.html`}
            className="w-full h-full border-0"
            title={`${activeTemplate.name} template preview`}
          />

          {/* Navigation arrows */}
          <button
            onClick={goToPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            aria-label="Previous template"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            aria-label="Next template"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Template info bar */}
        <div className={`mt-4 p-4 rounded-xl bg-gradient-to-r ${activeTemplate.color}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <activeTemplate.icon className="w-6 h-6 text-white" />
              <div>
                <h4 className="font-semibold text-white">{activeTemplate.name} Template</h4>
                <p className="text-sm text-white/80">
                  {activeTemplate.premium ? 'Premium' : 'Free'} • Generated from "The Longevity Blueprint" outline
                </p>
              </div>
            </div>
            <a
              href={`/examples/${activeTemplate.id}.html`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
              Full Screen
            </a>
          </div>
        </div>
      </div>

      {/* Pagination dots */}
      <div className="flex justify-center gap-2 mt-4">
        {TEMPLATES.map((_, index) => (
          <button
            key={index}
            onClick={() => setActiveIndex(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === activeIndex
                ? 'bg-white w-6'
                : 'bg-white/40 hover:bg-white/60'
            }`}
            aria-label={`Go to template ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
