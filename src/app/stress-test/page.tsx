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
  Clock,
  Layers
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

  // Detect macOS
  if (platform === 'MacIntel' || platform.startsWith('Mac')) {
    // Check for Apple Silicon via WebGL renderer
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          if (renderer && renderer.includes('Apple M')) {
            // Extract chip name (M1, M2, M3, M4, etc.)
            const match = renderer.match(/Apple (M\d+)/);
            if (match) {
              return `macOS (Apple Silicon ${match[1]})`;
            }
            return 'macOS (Apple Silicon)';
          }
        }
      }
    } catch (e) {
      // WebGL not available, fall back
    }
    return 'macOS (Intel)';
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

  // iOS
  if (/iPad|iPhone|iPod/.test(platform) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'iOS';
  }

  return platform;
}

export default function StressTestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [maxSuccessful, setMaxSuccessful] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  // Only render client-specific info after mount to avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const testCounts = [10000, 25000, 50000, 66000, 100000, 150000, 200000, 300000, 500000];

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

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatMemory = (mb: number) => {
    if (mb < 0) return 'N/A';
    if (mb < 1024) return `${mb.toFixed(1)}MB`;
    return `${(mb / 1024).toFixed(2)}GB`;
  };

  return (
    <div className="min-h-screen h-full bg-gray-950 text-white p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">IdiamPro Stress Test</h1>
        <p className="text-white/60 mb-8">
          Testing node capacity limits across different scales
        </p>

        {/* System Info */}
        <div className="bg-white/5 rounded-xl p-6 mb-8 border border-white/10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-violet-400" />
            System Information
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-white/40">Platform:</span>
              <span className="ml-2">{mounted ? getPlatformInfo() : 'Loading...'}</span>
            </div>
            <div>
              <span className="text-white/40">Browser:</span>
              <span className="ml-2">{mounted ? navigator.userAgent.split(' ').pop() : 'Loading...'}</span>
            </div>
            <div>
              <span className="text-white/40">Cores:</span>
              <span className="ml-2">{mounted ? navigator.hardwareConcurrency : 'Loading...'}</span>
            </div>
            <div>
              <span className="text-white/40">Memory API:</span>
              <span className="ml-2">{mounted ? ((performance as any).memory ? 'Available' : 'Not available') : 'Loading...'}</span>
            </div>
          </div>
        </div>

        {/* Run Tests Button */}
        <Button
          onClick={runAllTests}
          disabled={isRunning}
          className="mb-8 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {currentTest}
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run All Tests
            </>
          )}
        </Button>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              Test Results
            </h2>

            {/* Summary */}
            {!isRunning && maxSuccessful > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  <span className="text-xl font-bold text-emerald-400">
                    Maximum Tested: {maxSuccessful.toLocaleString()} nodes
                  </span>
                </div>
                <p className="text-white/60">
                  Successfully created, serialized, and parsed an outline with {maxSuccessful.toLocaleString()} nodes.
                </p>
              </div>
            )}

            {/* Results Table */}
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-white/60">Nodes</th>
                    <th className="px-4 py-3 text-left text-white/60">Status</th>
                    <th className="px-4 py-3 text-left text-white/60">Generate</th>
                    <th className="px-4 py-3 text-left text-white/60">Save</th>
                    <th className="px-4 py-3 text-left text-white/60">Load</th>
                    <th className="px-4 py-3 text-left text-white/60">File Size</th>
                    <th className="px-4 py-3 text-left text-white/60">Memory</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-violet-400" />
                          {result.nodeCount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {result.passed ? (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" /> Pass
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-400">
                            <XCircle className="w-4 h-4" /> Fail
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/60">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(result.generateTime)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/60">{formatTime(result.serializeTime)}</td>
                      <td className="px-4 py-3 text-white/60">{formatTime(result.deserializeTime)}</td>
                      <td className="px-4 py-3 text-white/60">
                        <div className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {result.fileSizeMB.toFixed(1)}MB
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/60">{formatMemory(result.memoryUsed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Hardware Assumptions */}
            <div className="mt-8 p-6 bg-white/5 rounded-xl border border-white/10">
              <h3 className="font-semibold mb-3">Hardware & System Assumptions</h3>
              <div className="text-sm text-white/60 space-y-2">
                <p><strong>Web Version:</strong> Performance depends on browser memory limits (typically 2-4GB heap). Chrome/Edge perform best. Safari has stricter limits.</p>
                <p><strong>Desktop (Electron):</strong> Has access to full system RAM. Can handle larger outlines than web browsers.</p>
                <p><strong>Mobile (iOS/Android):</strong> More constrained memory. Recommend keeping outlines under 50,000 nodes for smooth performance.</p>
                <p><strong>Storage:</strong> IndexedDB (web) can store gigabytes. Local filesystem (desktop) has no practical limit.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
