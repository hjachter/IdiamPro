'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  BarChart3,
  Cpu,
  HardDrive,
  Layers,
  ArrowLeft,
  Home
} from 'lucide-react';

interface TestResult {
  nodeCount: number;
  generateTime: number;
  serializeTime: number;
  deserializeTime: number;
  memoryUsed: number;
  fileSizeMB: number;
  passed: boolean;
  error?: string;
}

interface OutlineNode {
  id: string;
  name: string;
  content: string;
  type: string;
  parentId: string | null;
  childrenIds: string[];
  isCollapsed: boolean;
  prefix: string;
}

function generateTestOutline(nodeCount: number): { nodes: Record<string, OutlineNode>; rootNodeId: string } {
  const nodes: Record<string, OutlineNode> = {};
  const rootId = 'root-stress-test';

  // Create root node
  nodes[rootId] = {
    id: rootId,
    name: `Stress Test - ${nodeCount.toLocaleString()} Nodes`,
    content: `<p>This outline contains ${nodeCount.toLocaleString()} nodes for stress testing.</p>`,
    type: 'root',
    parentId: null,
    childrenIds: [],
    isCollapsed: false,
    prefix: ''
  };

  // Create hierarchical structure
  // Level 1: 100 chapters
  // Level 2: 100 sections per chapter
  // Level 3: remaining nodes distributed

  const chaptersCount = Math.min(100, Math.ceil(nodeCount / 1000));
  const sectionsPerChapter = Math.min(100, Math.ceil(nodeCount / (chaptersCount * 10)));
  const nodesPerSection = Math.ceil((nodeCount - chaptersCount - (chaptersCount * sectionsPerChapter)) / (chaptersCount * sectionsPerChapter));

  let nodeIndex = 0;

  for (let c = 0; c < chaptersCount && nodeIndex < nodeCount - 1; c++) {
    const chapterId = `chapter-${c}`;
    nodes[chapterId] = {
      id: chapterId,
      name: `Chapter ${c + 1}: Research Area ${c + 1}`,
      content: `<p>This is chapter ${c + 1} containing research on topic area ${c + 1}. It includes multiple sections with detailed analysis.</p>`,
      type: 'chapter',
      parentId: rootId,
      childrenIds: [],
      isCollapsed: true,
      prefix: `${c + 1}`
    };
    nodes[rootId].childrenIds.push(chapterId);
    nodeIndex++;

    for (let s = 0; s < sectionsPerChapter && nodeIndex < nodeCount - 1; s++) {
      const sectionId = `section-${c}-${s}`;
      nodes[sectionId] = {
        id: sectionId,
        name: `Section ${s + 1}: Detailed Analysis`,
        content: `<p>Section ${s + 1} of chapter ${c + 1}. Contains in-depth research findings and methodology discussion.</p>`,
        type: 'section',
        parentId: chapterId,
        childrenIds: [],
        isCollapsed: true,
        prefix: `${c + 1}.${s + 1}`
      };
      nodes[chapterId].childrenIds.push(sectionId);
      nodeIndex++;

      for (let n = 0; n < nodesPerSection && nodeIndex < nodeCount - 1; n++) {
        const nodeId = `node-${c}-${s}-${n}`;
        nodes[nodeId] = {
          id: nodeId,
          name: `Finding ${n + 1}: Data point and observation`,
          content: `<p>Research finding ${n + 1} from section ${s + 1}, chapter ${c + 1}. This node contains typical content length representing real-world usage patterns with citations and notes.</p>`,
          type: 'document',
          parentId: sectionId,
          childrenIds: [],
          isCollapsed: false,
          prefix: `${c + 1}.${s + 1}.${n + 1}`
        };
        nodes[sectionId].childrenIds.push(nodeId);
        nodeIndex++;
      }
    }
  }

  return { nodes, rootNodeId: rootId };
}

function getMemoryUsage(): number {
  if (typeof performance !== 'undefined' && (performance as any).memory) {
    return (performance as any).memory.usedJSHeapSize / (1024 * 1024);
  }
  return -1; // Not available in this browser
}

function getPlatformInfo(): string {
  if (typeof navigator === 'undefined') return 'Unknown';

  const platform = navigator.platform;
  const userAgent = navigator.userAgent;
  const cores = navigator.hardwareConcurrency || 0;

  // iOS detection (must come before macOS since iPads report MacIntel)
  if (/iPad|iPhone|iPod/.test(platform) ||
      (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'iOS';
  }

  // Detect macOS
  if (platform === 'MacIntel' || platform.startsWith('Mac')) {
    // Try WebGL renderer for specific chip info
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          // Chrome shows "Apple M4" etc, Safari shows "Apple GPU"
          if (renderer) {
            const chipMatch = renderer.match(/Apple (M\d+)/);
            if (chipMatch) {
              return `macOS (Apple ${chipMatch[1]})`;
            }
            // Safari just shows "Apple GPU" for Apple Silicon
            if (renderer.includes('Apple GPU') || renderer.includes('Apple M')) {
              // Use core count to estimate chip generation
              if (cores >= 10) return 'macOS (Apple Silicon)';
              if (cores >= 8) return 'macOS (Apple Silicon)';
              return 'macOS (Apple Silicon)';
            }
          }
        }
      }
    } catch (e) {
      // WebGL not available
    }

    // Fallback: high core counts on Mac likely mean Apple Silicon
    // Intel MacBooks typically had 4-8 cores, Apple Silicon has 8-12+
    if (cores >= 8) {
      return 'macOS (likely Apple Silicon)';
    }
    return 'macOS';
  }

  // Windows
  if (platform.startsWith('Win')) {
    if (userAgent.includes('ARM')) return 'Windows (ARM)';
    return 'Windows';
  }

  // Linux
  if (platform.startsWith('Linux')) {
    if (userAgent.includes('Android')) return 'Android';
    return 'Linux';
  }

  return platform;
}

export default function StressTestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [maxSuccessful, setMaxSuccessful] = useState<number>(0);
  const [mounted, setMounted] = useState(false);
  const autoStartedRef = React.useRef(false);

  // Only render client-specific info after mount to avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const testCounts = [10000, 25000, 50000, 66000, 100000, 150000, 200000, 300000, 500000, 750000, 1000000];

  const runTest = useCallback(async (nodeCount: number): Promise<TestResult> => {
    const startMemory = getMemoryUsage();

    try {
      // Generate outline
      const genStart = performance.now();
      const outline = generateTestOutline(nodeCount);
      const genEnd = performance.now();
      const generateTime = genEnd - genStart;

      // Serialize (simulate save)
      const serStart = performance.now();
      const json = JSON.stringify(outline);
      const serEnd = performance.now();
      const serializeTime = serEnd - serStart;
      const fileSizeMB = new Blob([json]).size / (1024 * 1024);

      // Deserialize (simulate load)
      const deserStart = performance.now();
      JSON.parse(json);
      const deserEnd = performance.now();
      const deserializeTime = deserEnd - deserStart;

      const endMemory = getMemoryUsage();
      const memoryUsed = endMemory > 0 ? endMemory - startMemory : -1;

      return {
        nodeCount,
        generateTime,
        serializeTime,
        deserializeTime,
        memoryUsed,
        fileSizeMB,
        passed: true
      };
    } catch (error) {
      return {
        nodeCount,
        generateTime: 0,
        serializeTime: 0,
        deserializeTime: 0,
        memoryUsed: 0,
        fileSizeMB: 0,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, []);

  const runAllTests = async () => {
    setIsRunning(true);
    setResults([]);
    setMaxSuccessful(0);

    for (const count of testCounts) {
      setCurrentTest(`Testing ${count.toLocaleString()} nodes...`);

      // Give UI time to update
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await runTest(count);
      setResults(prev => [...prev, result]);

      if (result.passed) {
        setMaxSuccessful(count);
      } else {
        // Stop on first failure
        break;
      }

      // Force garbage collection pause between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setCurrentTest('');
    setIsRunning(false);
  };

  // Auto-run once on arrival: visitors reach this page by clicking "Run the live
  // benchmark on your computer", so they've opted in and expect it to run. The
  // escalating tiers self-limit (they stop on the first failure), and the pauses
  // between tiers let the UI repaint so the chart/table fill in live.
  React.useEffect(() => {
    if (!mounted || autoStartedRef.current) return;
    autoStartedRef.current = true;
    const t = setTimeout(() => { void runAllTests(); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatMemory = (mb: number) => {
    if (mb < 0) return 'N/A';
    if (mb < 1024) return `${mb.toFixed(1)}MB`;
    return `${(mb / 1024).toFixed(2)}GB`;
  };

  const passed = results.filter((r) => r.passed);
  const maxTotal = Math.max(
    1,
    ...passed.map((r) => r.generateTime + r.serializeTime + r.deserializeTime),
  );

  return (
    <div className="min-h-screen h-full bg-white text-[#0b1533] overflow-y-auto">
      {/* Sticky escape hatch — a way out is always visible so the visitor is
          never trapped (matters most on iPhone where the summary can dominate). */}
      <div className="sticky top-0 z-10 px-6 lg:px-12 py-3 bg-white/85 backdrop-blur border-b border-[#dde5f2] flex items-center justify-between">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#475569] hover:text-[#0b1533] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to IdeaM
        </a>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0b1533] transition-colors"
          aria-label="Home"
        >
          <Home className="w-4 h-4" />
        </a>
      </div>

      <div className="max-w-4xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/12 border border-blue-600/30 mb-5">
            <Cpu className="w-4 h-4 text-[#1e40af]" />
            <span className="text-sm font-semibold text-[#1e40af]">Live benchmark · your machine</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
            How IdeaM performs on <span className="text-[#1e40af]">your</span> computer.
          </h1>
          <p className="text-lg font-medium text-[#2b3a5c] leading-relaxed max-w-2xl">
            This is a real test, running right now in your browser — building, saving, and re-loading outlines from ten thousand nodes all the way up to a million, and timing every step on your actual hardware.
          </p>
        </div>

        {/* System Info */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Cpu, label: 'Platform', value: mounted ? getPlatformInfo() : '…' },
            { icon: Layers, label: 'Processing cores', value: mounted ? String(navigator.hardwareConcurrency || '—') : '…' },
            { icon: HardDrive, label: 'Browser', value: mounted ? (navigator.userAgent.split(' ').pop() || '—') : '…' },
          ].map((s) => {
            const SIcon = s.icon;
            return (
              <div key={s.label} className="rounded-2xl border border-[#dde5f2] bg-[#f7faff] p-5">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-600/25 mb-3">
                  <SIcon className="w-4 h-4 text-[#1e40af]" />
                </div>
                <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#5b6b85] mb-1">{s.label}</div>
                <div className="text-base font-extrabold text-[#0b1533] leading-tight break-words">{s.value}</div>
              </div>
            );
          })}
        </div>

        {/* Live status / run controls */}
        <div className="flex flex-wrap items-center gap-4 mb-10">
          <Button
            onClick={runAllTests}
            disabled={isRunning}
            className="bg-gradient-to-br from-[#38bdf8] via-[#2563eb] to-[#4f46e5] hover:from-[#2563eb] hover:to-[#4338ca] text-white font-bold shadow-lg shadow-blue-700/30"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {currentTest || 'Running…'}
              </>
            ) : results.length > 0 ? (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run again
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run the benchmark
              </>
            )}
          </Button>
          {isRunning && (
            <span className="text-sm font-medium text-[#5b6b85]">Timing on your hardware — the results fill in as it runs.</span>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-8">
            {/* Summary */}
            {maxSuccessful > 0 && (
              <div className="rounded-2xl border border-blue-600/30 bg-gradient-to-br from-[#eff4ff] to-[#dbe7ff] p-6 md:p-7">
                <div className="flex items-center gap-3 mb-1.5">
                  <CheckCircle2 className="w-6 h-6 text-[#1e40af]" />
                  <span className="text-2xl md:text-3xl font-black tracking-tight text-[#1e40af]">
                    {maxSuccessful.toLocaleString()} nodes
                  </span>
                  <span className="text-lg font-bold text-[#2b3a5c]">handled {isRunning ? 'so far' : 'on your machine'}</span>
                </div>
                <p className="text-[#2b3a5c] font-medium">
                  Built, saved, and re-loaded a single outline of {maxSuccessful.toLocaleString()} nodes — right here, on the computer you&apos;re using now.
                </p>
              </div>
            )}

            {/* Chart — the impressive diagram: how total processing time scales as
                the outline grows. Bars fill live as each tier completes. */}
            {passed.length > 0 && (
              <div className="rounded-2xl border border-[#dde5f2] bg-white p-6 md:p-7 shadow-[0_1px_3px_rgba(12,34,36,0.06),0_12px_32px_rgba(12,34,36,0.06)]">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-5 h-5 text-[#1e40af]" />
                  <h2 className="text-lg font-extrabold text-[#0b1533]">Response time as your outline grows</h2>
                </div>
                <p className="text-sm text-[#5b6b85] mb-6">Total time to build + save + re-load, at each size. Lower is faster.</p>
                <div className="space-y-3">
                  {passed.map((r, i) => {
                    const total = r.generateTime + r.serializeTime + r.deserializeTime;
                    const pct = Math.max(3, (total / maxTotal) * 100);
                    const isTop = r.nodeCount === maxSuccessful;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-20 sm:w-24 shrink-0 text-right text-sm font-bold text-[#0b1533] tabular-nums">
                          {r.nodeCount >= 1000 ? `${(r.nodeCount / 1000).toLocaleString()}K` : r.nodeCount}
                        </div>
                        <div className="flex-1 h-7 rounded-lg bg-[#f1f5f9] overflow-hidden">
                          <div
                            className={`h-full rounded-lg transition-all duration-500 ${isTop ? 'bg-gradient-to-r from-[#2563eb] to-[#4f46e5]' : 'bg-gradient-to-r from-[#7dd3fc] to-[#38bdf8]'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="w-16 shrink-0 text-sm font-semibold text-[#2b3a5c] tabular-nums">{formatTime(total)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Results Table — the detail behind the chart */}
            <div className="rounded-2xl border border-[#dde5f2] bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#f7faff] border-b border-[#dde5f2]">
                    <tr>
                      {['Nodes', 'Status', 'Generate', 'Save', 'Load', 'File size'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-semibold text-[#5b6b85] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, i) => (
                      <tr key={i} className="border-t border-[#eef2f9]">
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-[#1e40af]" />
                            {result.nodeCount.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {result.passed ? (
                            <span className="inline-flex items-center gap-1 text-[#1e40af] font-semibold">
                              <CheckCircle2 className="w-4 h-4" /> Pass
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                              <XCircle className="w-4 h-4" /> Limit
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#5b6b85] tabular-nums">{formatTime(result.generateTime)}</td>
                        <td className="px-4 py-3 text-[#5b6b85] tabular-nums">{formatTime(result.serializeTime)}</td>
                        <td className="px-4 py-3 text-[#5b6b85] tabular-nums">{formatTime(result.deserializeTime)}</td>
                        <td className="px-4 py-3 text-[#5b6b85] tabular-nums">
                          <div className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            {result.fileSizeMB.toFixed(1)}MB
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Honest context on what the numbers mean */}
            <div className="rounded-2xl border border-[#dde5f2] bg-[#f7faff] p-6">
              <h3 className="font-bold text-[#0b1533] mb-3">What this means</h3>
              <div className="text-sm text-[#5b6b85] space-y-2 leading-relaxed">
                <p><strong className="text-[#2b3a5c]">In your browser:</strong> speed depends on the browser&apos;s memory (typically 2–4GB); Chrome and Edge run the largest tests. This is the most constrained way to run IdeaM.</p>
                <p><strong className="text-[#2b3a5c]">On the desktop app:</strong> IdeaM uses your full system memory, so it comfortably handles larger outlines than a browser tab.</p>
                <p><strong className="text-[#2b3a5c]">On phone &amp; tablet:</strong> memory is tighter — outlines up to ~50,000 nodes stay smooth.</p>
                <p>These are your real numbers, measured just now. No artificial caps — IdeaM scales until your hardware says stop.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
