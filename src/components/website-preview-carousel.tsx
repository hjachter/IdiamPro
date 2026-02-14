'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, ExternalLink, Megaphone, Building2, BookOpen, Palette, Calendar, GraduationCap, Newspaper, User, Lock, FolderTree, Globe, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react';

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

// The actual outline structure from "The Longevity Blueprint"
const OUTLINE_STRUCTURE = [
  {
    name: "The Longevity Blueprint",
    type: "root",
    children: [
      {
        name: "Biohacking Longevity's Promise",
        type: "chapter",
        children: [
          { name: "The Foundation of Biohacking", type: "document" },
          { name: "The Engineering Approach to Biohacking", type: "document" },
          { name: "Key Biohacks: Metabolic Flexibility", type: "document" },
          { name: "GW501516 (Cardarine)", type: "document" },
        ]
      },
      {
        name: "The Immortal Instinct",
        type: "chapter",
        children: [
          { name: "The Primal Drive to Survive", type: "document" },
          { name: "Ancient Quests for Eternal Life", type: "document" },
          { name: "The Paradox of Self-Preservation", type: "document" },
        ]
      },
      {
        name: "Mitochondria: Our Cellular Powerhouses",
        type: "chapter",
        children: [
          { name: "Subcellular Foundation of Aging", type: "document" },
          { name: "Environmental & Lifestyle Impacts", type: "document" },
          { name: "Autophagy and Detoxification", type: "document" },
          { name: "Reactive Oxygen Species (ROS)", type: "document" },
          { name: "NAD+ and Mitochondrial Optimization", type: "document" },
        ]
      },
      {
        name: "The Three Fs: Survival Imperatives",
        type: "chapter",
        children: [
          { name: "The Foundation: Three Fs", type: "document" },
          { name: "Telomeres, NAD+, and Microbiome", type: "document" },
        ]
      },
      {
        name: "Inflammation: The Silent Killer",
        type: "chapter",
        children: [
          { name: "The Four Killers", type: "document" },
          { name: "Diet, Environment, and Sleep", type: "document" },
        ]
      },
      {
        name: "Sugar's Hidden Dangers",
        type: "chapter",
        children: [
          { name: "Environmental and Light Exposure", type: "document" },
          { name: "The Ozone Therapy Caveat", type: "document" },
          { name: "Hormone Replacement Therapy", type: "document" },
        ]
      },
      {
        name: "Biohacking for Superhuman Status",
        type: "chapter",
        children: [
          { name: "The Dawn of Biohacking", type: "document" },
          { name: "Defining Biohacking", type: "document" },
        ]
      },
      { name: "Investing in Your Biology", type: "chapter" },
      { name: "Tools for Cellular Control", type: "chapter" },
      { name: "Simple, Accessible Hacks", type: "chapter" },
      { name: "The Ethics of Extended Lifespan", type: "chapter" },
      { name: "Legacy and the XPRIZE", type: "chapter" },
    ]
  }
];

// Recursive outline node component
function OutlineNode({ node, depth = 0, defaultExpanded = true }: { node: typeof OUTLINE_STRUCTURE[0]; depth?: number; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded && depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  const typeColors: Record<string, string> = {
    root: 'text-violet-400',
    chapter: 'text-blue-400',
    document: 'text-emerald-400',
  };

  const typeBg: Record<string, string> = {
    root: 'bg-violet-500/20',
    chapter: 'bg-blue-500/20',
    document: 'bg-emerald-500/20',
  };

  return (
    <div className={depth === 0 ? '' : 'ml-4 border-l border-white/10 pl-3'}>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors ${depth === 0 ? 'bg-white/5' : ''}`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          <span className="w-4 h-4 flex items-center justify-center text-white/40">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
          </span>
        ) : (
          <span className="w-4 h-4" />
        )}
        <span className={`text-xs px-1.5 py-0.5 rounded ${typeBg[node.type]} ${typeColors[node.type]}`}>
          {node.type === 'root' ? '📋' : node.type === 'chapter' ? '📖' : '📄'}
        </span>
        <span className={`text-sm ${depth === 0 ? 'font-semibold text-white' : 'text-white/80'}`}>
          {node.name}
        </span>
      </div>
      {hasChildren && expanded && (
        <div className="mt-1">
          {node.children!.map((child, i) => (
            <OutlineNode key={i} node={child as typeof OUTLINE_STRUCTURE[0]} depth={depth + 1} defaultExpanded={depth < 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WebsitePreviewCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'website' | 'outline'>('website');
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
      <div className="flex flex-wrap justify-center gap-2 mb-4">
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

      {/* View mode toggle */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex bg-white/10 rounded-lg p-1">
          <button
            onClick={() => setViewMode('outline')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'outline'
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            Source Outline
          </button>
          <button
            onClick={() => setViewMode('website')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'website'
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" />
            Generated Website
          </button>
        </div>
      </div>

      {/* Main preview area */}
      <div className="relative">
        {viewMode === 'outline' ? (
          /* Outline View */
          <div className="bg-gray-900 rounded-xl border border-white/10 p-6" style={{ height: '500px', overflowY: 'auto' }}>
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <FolderTree className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Source Outline</h4>
                <p className="text-sm text-white/60">This outline structure becomes a {activeTemplate.name.toLowerCase()} website</p>
              </div>
            </div>
            <div className="space-y-1">
              {OUTLINE_STRUCTURE.map((node, i) => (
                <OutlineNode key={i} node={node} />
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-white/10">
              <p className="text-xs text-white/40 text-center">
                13 chapters • 30+ documents • Transforms into a complete {activeTemplate.name.toLowerCase()} website
              </p>
            </div>
          </div>
        ) : (
          /* Website View */
          <>
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
                title="Open in new tab (links work there)"
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

              {/* Hint for full functionality */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 backdrop-blur-sm rounded-full text-xs text-white/80">
                Open in new tab for full navigation →
              </div>
            </div>
          </>
        )}

        {/* Template info bar */}
        <div className={`mt-4 p-4 rounded-xl bg-gradient-to-r ${activeTemplate.color}`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
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
              Open Full Site
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
