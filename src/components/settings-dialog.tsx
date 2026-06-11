'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Folder, Info, Smartphone, Cpu, Cloud, Loader2, CheckCircle, XCircle, Crown, Shield, Moon, Sun, Download, Trash2, AlertTriangle, Play, Sparkles } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { exportAllUserData, deleteAllUserData, inspectUserDataScope } from '@/lib/privacy-data';
import { useTheme } from 'next-themes';
import { Badge } from '@/components/ui/badge';
import { useAI } from '@/contexts/ai-context';
import { useToast } from '@/hooks/use-toast';
import { useDiscovery, fireDiscovery } from '@/hooks/use-discovery';
import { resetAllConfirmSuppressions } from '@/hooks/use-confirm-dialog';
import { storeDirectoryHandle, getDirectoryHandle, verifyDirectoryPermission } from '@/lib/file-storage';
import { isElectron, electronSelectDirectory, electronGetStoredDirectoryPath, checkOllamaInstallation, startOllama } from '@/lib/electron-storage';
import { checkOllamaStatusAction } from '@/app/actions';
import type { AIProvider, AIDepth } from '@/types';
import { AI_DEPTH_CONFIG } from '@/types';
import {
  getCurrentTier,
  getTierCap,
  getTierDisplayName,
  hasAnyByokKey,
} from '@/lib/tier-detection';
import {
  getUsage,
  getNextResetLabel,
  getDaysUntilReset,
  resetUsage,
} from '@/lib/ai-usage-counter';

// Check if running in Capacitor native app (but NOT Electron)
function isCapacitor(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof window !== 'undefined' && !!(window as any).Capacitor && !isElectron();
}

interface SettingsDialogProps {
  children: React.ReactNode;
  onFolderSelected?: () => void;
}

export default function SettingsDialog({ children, onFolderSelected }: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [dataFolder, setDataFolder] = useState<string>('Browser Storage (Default)');
  const [confirmDelete, setConfirmDelete] = useState<boolean>(true);
  const [aiDataConsent, setAiDataConsent] = useState<boolean>(false);
  const { toast } = useToast();
  const { isPremium, plan } = useAI();
  const { theme, setTheme } = useTheme();
  const { isProfessional, setProfessional } = useDiscovery();

  // Format plan name for display
  const planDisplayName = {
    FREE: 'Free',
    BASIC: 'Basic',
    PREMIUM: 'Premium',
    ACADEMIC: 'Academic'
  }[plan] || plan;

  // AI depth setting
  const [aiDepth, setAiDepth] = useState<AIDepth>('standard');

  // Launch tier usage state (recomputed each time the dialog opens).
  // Re-reading on every open keeps it fresh even if the user just hit the cap
  // in another part of the app; we don't need a global state store for this.
  const [usageState, setUsageState] = useState(() => {
    const tier = getCurrentTier();
    return {
      tier,
      tierName: getTierDisplayName(tier),
      cap: getTierCap(tier),
      used: 0,
      isByok: false,
      resetLabel: getNextResetLabel(),
      daysUntilReset: getDaysUntilReset(),
    };
  });
  const refreshUsageState = React.useCallback(() => {
    const tier = getCurrentTier();
    setUsageState({
      tier,
      tierName: getTierDisplayName(tier),
      cap: getTierCap(tier),
      used: getUsage().count,
      isByok: hasAnyByokKey(),
      resetLabel: getNextResetLabel(),
      daysUntilReset: getDaysUntilReset(),
    });
  }, []);

  // Local AI (Ollama) state
  // API Key management
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<Record<string, 'untested' | 'ok' | 'error'>>({});

  const [aiProvider, setAiProvider] = useState<AIProvider>('cloud');
  const [ollamaStatus, setOllamaStatus] = useState<{
    checking: boolean;
    available: boolean;
    models: string[];
    recommendedModel: string | null;
  }>({ checking: true, available: false, models: [], recommendedModel: null });
  const [selectedModel, setSelectedModel] = useState<string>('');
  // Differentiates "Ollama.app installed but service not running" from
  // "Ollama is not installed at all" so the UI can show the right CTA.
  const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null);
  const [isStartingOllama, setIsStartingOllama] = useState<boolean>(false);

  // Load current folder and settings on mount
  useEffect(() => {
    const loadCurrentFolder = async () => {
      // Check Electron first
      if (isElectron()) {
        const dirPath = await electronGetStoredDirectoryPath();
        if (dirPath) {
          // Extract folder name from path
          const folderName = dirPath.split('/').pop() || dirPath;
          setDataFolder(folderName);
          return;
        }
        setDataFolder('Browser Storage (Default)');
        return;
      }

      // Fall back to File System Access API
      const dirHandle = await getDirectoryHandle();
      if (dirHandle) {
        const hasPermission = await verifyDirectoryPermission(dirHandle, 'read');
        if (hasPermission) {
          setDataFolder(dirHandle.name);
        } else {
          setDataFolder('Browser Storage (Default)');
        }
      }
    };

    // Load confirm delete setting
    const savedConfirmDelete = localStorage.getItem('confirmDelete');
    if (savedConfirmDelete !== null) {
      setConfirmDelete(savedConfirmDelete === 'true');
    }

    // Load AI consent setting
    const savedConsent = localStorage.getItem('aiDataConsent');
    setAiDataConsent(savedConsent === 'granted');

    // Load AI depth setting
    const savedAiDepth = localStorage.getItem('aiDepth') as AIDepth | null;
    if (savedAiDepth) {
      setAiDepth(savedAiDepth);
    }

    // Load API keys
    const savedKeys: Record<string, string> = {};
    for (const provider of ['gemini', 'openai', 'anthropic', 'mistral', 'groq']) {
      const key = localStorage.getItem(`apiKey_${provider}`);
      if (key) savedKeys[provider] = key;
    }
    setApiKeys(savedKeys);

    // Load local AI settings
    const savedAiProvider = localStorage.getItem('aiProvider') as AIProvider | null;
    if (savedAiProvider) {
      setAiProvider(savedAiProvider);
    }
    const savedModel = localStorage.getItem('ollamaModel');
    if (savedModel) {
      setSelectedModel(savedModel);
    }

    loadCurrentFolder();
  }, []);

  // Refresh AI usage stats whenever the dialog opens.
  useEffect(() => {
    if (open) refreshUsageState();
  }, [open, refreshUsageState]);

  // Check Ollama status when dialog opens
  useEffect(() => {
    if (open) {
      checkOllamaStatus();
      // Also probe whether Ollama.app is installed on disk so we can
      // distinguish "installed but not running" from "not installed".
      checkOllamaInstallation()
        .then(info => setOllamaInstalled(info.installed))
        .catch(() => setOllamaInstalled(false));
    }
  }, [open]);

  const checkOllamaStatus = async () => {
    setOllamaStatus(prev => ({ ...prev, checking: true }));
    try {
      const status = await checkOllamaStatusAction();
      setOllamaStatus({
        checking: false,
        available: status.available,
        models: status.models.map(m => m.name),
        recommendedModel: status.recommendedModel,
      });
      // Auto-select recommended model if none selected
      if (status.recommendedModel && !selectedModel) {
        setSelectedModel(status.recommendedModel);
      }
    } catch (error) {
      setOllamaStatus({ checking: false, available: false, models: [], recommendedModel: null });
    }
  };

  // Re-probe Ollama status (used after launching Ollama.app).
  // Polls a few times because the service takes a moment to come up.
  const recheckOllamaStatus = async () => {
    setOllamaStatus(prev => ({ ...prev, checking: true }));
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const status = await checkOllamaStatusAction();
        if (status.available) {
          setOllamaStatus({
            checking: false,
            available: true,
            models: status.models.map(m => m.name),
            recommendedModel: status.recommendedModel,
          });
          if (status.recommendedModel && !selectedModel) {
            setSelectedModel(status.recommendedModel);
          }
          return;
        }
      } catch {
        // ignore and retry
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    setOllamaStatus({ checking: false, available: false, models: [], recommendedModel: null });
  };

  const handleStartOllama = async () => {
    setIsStartingOllama(true);
    try {
      const result = await startOllama();
      if (result.ok) {
        await recheckOllamaStatus();
      } else {
        setOllamaStatus(prev => ({ ...prev, checking: false }));
      }
    } finally {
      setIsStartingOllama(false);
    }
  };

  const handleAiDepthChange = (value: AIDepth) => {
    setAiDepth(value);
    localStorage.setItem('aiDepth', value);
  };

  const handleAiProviderChange = (value: AIProvider) => {
    setAiProvider(value);
    localStorage.setItem('aiProvider', value);
  };

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    localStorage.setItem('ollamaModel', value);
  };

  const handleConfirmDeleteChange = (checked: boolean) => {
    setConfirmDelete(checked);
    localStorage.setItem('confirmDelete', String(checked));
  };

  const handleApiKeyChange = (provider: string, value: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
    if (value.trim()) {
      localStorage.setItem(`apiKey_${provider}`, value.trim());
    } else {
      localStorage.removeItem(`apiKey_${provider}`);
    }
    setProviderStatus(prev => ({ ...prev, [provider]: 'untested' }));
  };

  const handleTestApiKey = async (provider: string) => {
    const key = apiKeys[provider];
    if (!key?.trim()) return;
    setTestingProvider(provider);
    try {
      let ok = false;
      if (provider === 'gemini') {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        ok = resp.ok;
      } else if (provider === 'openai') {
        const resp = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': `Bearer ${key}` } });
        ok = resp.ok;
      } else if (provider === 'anthropic') {
        // Anthropic doesn't have a simple list-models endpoint accessible from browser
        // We'll do a minimal call to check auth
        ok = key.startsWith('sk-ant-');
      } else if (provider === 'mistral') {
        const resp = await fetch('https://api.mistral.ai/v1/models', { headers: { 'Authorization': `Bearer ${key}` } });
        ok = resp.ok;
      } else if (provider === 'groq') {
        const resp = await fetch('https://api.groq.com/openai/v1/models', { headers: { 'Authorization': `Bearer ${key}` } });
        ok = resp.ok;
      }
      setProviderStatus(prev => ({ ...prev, [provider]: ok ? 'ok' : 'error' }));
      toast({ title: ok ? 'Connection successful' : 'Connection failed', description: ok ? `${provider} API key is valid.` : `Could not verify ${provider} API key.`, variant: ok ? 'default' : 'destructive' });
    } catch {
      setProviderStatus(prev => ({ ...prev, [provider]: 'error' }));
      toast({ title: 'Connection failed', description: `Could not reach ${provider} API.`, variant: 'destructive' });
    } finally {
      setTestingProvider(null);
    }
  };

  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);

  // Privacy & Data state
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'idle' | 'warn' | 'confirm'>('idle');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [scope, setScope] = useState<{ outlines: number; appKeys: string[] } | null>(null);

  // Load the scope summary when the dialog opens — shown in delete confirmation.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await inspectUserDataScope();
        if (!cancelled) setScope(result);
      } catch (err) {
        console.warn('Could not inspect user data scope:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleExportData = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const result = await exportAllUserData();
      if (result.status === 'saved') {
        toast({
          title: 'Export complete',
          description: `Saved ${result.outlineCount} outline${result.outlineCount === 1 ? '' : 's'} and your settings to ${result.filename}.`,
        });
      } else {
        toast({
          title: 'Export cancelled',
          description: 'No file was saved.',
        });
      }
    } catch (err) {
      console.error('Export failed:', err);
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: (err as Error)?.message || 'Could not generate the data archive.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleStartDelete = () => {
    setDeleteConfirmText('');
    setDeleteStep('warn');
  };

  const handleProceedToConfirm = () => {
    setDeleteConfirmText('');
    setDeleteStep('confirm');
  };

  const handleCancelDelete = () => {
    setDeleteStep('idle');
    setDeleteConfirmText('');
  };

  const handleFinalDelete = async () => {
    if (deleteConfirmText.trim() !== 'DELETE') return;
    setIsDeleting(true);
    try {
      const result = await deleteAllUserData();
      toast({
        title: 'Data deleted',
        description: `Removed ${result.outlinesDeleted} outline${result.outlinesDeleted === 1 ? '' : 's'} and ${result.localStorageKeysCleared} setting${result.localStorageKeysCleared === 1 ? '' : 's'}. Reloading…`,
      });
      // deleteAllUserData triggers a reload itself; UI tear-down handled by reload.
    } catch (err) {
      console.error('Delete failed:', err);
      setIsDeleting(false);
      setDeleteStep('idle');
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: (err as Error)?.message || 'Could not clear all data.',
      });
    }
  };

  const aiProviders: {
    id: string; name: string; placeholder: string;
    free: boolean; recommended: boolean; keyUrl: string;
    cost: string; note?: string; steps: string[];
  }[] = [
    {
      id: 'gemini', name: 'Google Gemini', placeholder: 'AIza...',
      free: true, recommended: true,
      keyUrl: 'https://aistudio.google.com/apikey',
      cost: 'Free tier: 60 requests/min. No credit card required.',
      note: 'On Google\'s free API tier, prompts may be retained for about 55 days and can be used to improve Google\'s models unless you opt out in Google AI Studio. Paid-tier keys are not used for training.',
      steps: [
        'Click "Get Key" to open Google AI Studio',
        'Sign in with your Google account',
        'Click "Create API Key" (blue button)',
        'Copy the key and paste it below',
      ],
    },
    {
      id: 'openai', name: 'OpenAI', placeholder: 'sk-...',
      free: false, recommended: false,
      keyUrl: 'https://platform.openai.com/api-keys',
      cost: 'Pay-as-you-go. ~$0.01-0.03 per 1K tokens. Required for podcast generation.',
      steps: [
        'Click "Get Key" to open OpenAI\'s API keys page',
        'Sign in or create an account',
        'Click "Create new secret key"',
        'Copy the key immediately (it won\'t be shown again)',
        'Add a payment method if you haven\'t already',
      ],
    },
    {
      id: 'anthropic', name: 'Anthropic Claude', placeholder: 'sk-ant-...',
      free: false, recommended: false,
      keyUrl: 'https://console.anthropic.com/settings/keys',
      cost: 'Pay-as-you-go. ~$0.003-0.015 per 1K tokens. Best for long reasoning tasks.',
      steps: [
        'Click "Get Key" to open Anthropic Console',
        'Sign in or create an account',
        'Go to Settings > API Keys',
        'Click "Create Key" and copy it',
      ],
    },
    {
      id: 'mistral', name: 'Mistral AI', placeholder: 'M...',
      free: false, recommended: false,
      keyUrl: 'https://console.mistral.ai/api-keys',
      cost: 'Pay-as-you-go. Competitive pricing. Strong multilingual support.',
      steps: [
        'Click "Get Key" to open Mistral Console',
        'Sign in or create an account',
        'Click "Create new key"',
        'Copy the key and paste it below',
      ],
    },
    {
      id: 'groq', name: 'Groq', placeholder: 'gsk_...',
      free: true, recommended: false,
      keyUrl: 'https://console.groq.com/keys',
      cost: 'Free tier available. Extremely fast inference. No credit card required.',
      steps: [
        'Click "Get Key" to open Groq Console',
        'Sign in with Google or create an account',
        'Click "Create API Key"',
        'Copy the key and paste it below',
      ],
    },
  ];

  const handleAiConsentChange = (checked: boolean) => {
    setAiDataConsent(checked);
    localStorage.setItem('aiDataConsent', checked ? 'granted' : 'revoked');
    toast({
      title: checked ? 'AI Consent Granted' : 'AI Consent Revoked',
      description: checked
        ? 'AI features are now enabled.'
        : 'AI features are disabled. Your data will not be sent to AI services.',
    });
  };

  const handleSelectFolder = async () => {
    try {
      // Use Electron dialog if available
      if (isElectron()) {
        const dirPath = await electronSelectDirectory();
        if (dirPath) {
          const folderName = dirPath.split('/').pop() || dirPath;
          setDataFolder(folderName);

          toast({
            title: 'Folder Selected',
            description: 'Data folder set to: ' + folderName + '. Your outlines will now be saved as .idm files in this folder.',
          });

          onFolderSelected?.();
        }
        return;
      }

      // Check if File System Access API is supported
      if ('showDirectoryPicker' in window) {
        // @ts-expect-error - showDirectoryPicker is not in TypeScript types yet
        const dirHandle = await window.showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'documents',
        });

        // Request permission
        const permissionStatus = await dirHandle.requestPermission({ mode: 'readwrite' });

        if (permissionStatus === 'granted') {
          // Store the directory handle in IndexedDB
          await storeDirectoryHandle(dirHandle);

          // Update UI
          setDataFolder(dirHandle.name);

          toast({
            title: 'Folder Selected',
            description: 'Data folder set to: ' + dirHandle.name + '. Your outlines will now be saved as .idm files in this folder.',
          });

          // Notify parent component that folder was selected
          onFolderSelected?.();
        } else {
          toast({
            variant: 'destructive',
            title: 'Permission Denied',
            description: 'Could not get write permission for the selected folder',
          });
        }
      } else {
        // Fallback for browsers without File System Access API
        toast({
          variant: 'destructive',
          title: 'Not Supported',
          description: 'Your browser doesn\'t support folder selection. Try Chrome, Edge, or use the Desktop app for this feature.',
        });
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to select folder: ' + (error as Error).message,
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure IdiamPro application settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Data Storage Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Data Storage</h3>

            {!isElectron() && isCapacitor() ? (
              /* Capacitor native app storage info */
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">App Storage</span>
                </div>
                <p className="text-xs text-muted-foreground flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>
                    Your outlines are automatically saved within the app. Use <strong>Backup All Outlines</strong> to share/export a backup file (via AirDrop, Files, email, etc.), and <strong>Restore All Outlines</strong> to import from a backup file.
                  </span>
                </p>
              </div>
            ) : (
              /* Desktop folder selection (Electron or web with File System Access API) */
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  User Data Folder
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSelectFolder}
                    className="flex-grow justify-start"
                  >
                    <Folder className="mr-2 h-4 w-4" />
                    {dataFolder}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>
                    Select a folder where all your outlines will be saved. {isElectron() ? 'Your outlines are saved as .idm files.' : 'Currently using browser storage by default.'}
                    {!isElectron() && !('showDirectoryPicker' in window) && (
                      <span className="block mt-1 text-amber-600 dark:text-amber-400">
                        Note: Folder selection is not supported in your browser. Use Chrome, Edge, or the Desktop app for this feature.
                      </span>
                    )}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Account Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Account</h3>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4" />
                <span className="text-sm">Subscription Plan</span>
              </div>
              <Badge variant={isPremium ? "default" : "secondary"}>
                {planDisplayName}
              </Badge>
            </div>
            {/* Paid users (student / pro) see "Manage Subscription" which
                opens Stripe's hosted Customer Portal (cancel, change plan,
                update card). Free / trial users see "See plans" which goes
                to /upgrade. Both buttons gracefully degrade in stub mode. */}
            {(usageState.tier === 'student' || usageState.tier === 'pro') ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                data-testid="manage-subscription-btn"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/billing/portal', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({}),
                    });
                    const data = await res.json() as { url?: string; stub?: boolean };
                    if (data?.url) {
                      if (data.stub) window.location.href = data.url;
                      else window.location.href = data.url;
                    }
                  } catch {
                    window.location.href = '/upgrade';
                  }
                }}
              >
                <Crown className="mr-2 h-4 w-4" />
                Manage Subscription
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => { window.location.href = '/upgrade'; }}
              >
                <Crown className="mr-2 h-4 w-4" />
                See plans
              </Button>
            )}
          </div>

          {/* Answer quality Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Answer quality</h3>
            <p className="text-xs text-muted-foreground">
              Choose how thorough AI responses should be. Can be overridden per-request.
            </p>
            <Select value={aiDepth} onValueChange={handleAiDepthChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(AI_DEPTH_CONFIG) as AIDepth[]).map((depth) => (
                  <SelectItem key={depth} value={depth}>
                    <div className="flex items-center gap-2">
                      <span>{AI_DEPTH_CONFIG[depth].icon}</span>
                      <span>{AI_DEPTH_CONFIG[depth].label}</span>
                      <span className="text-xs text-muted-foreground">— {AI_DEPTH_CONFIG[depth].description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User Preferences Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Preferences</h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="confirm-delete" className="text-sm">
                Confirm before deleting items
              </Label>
              <Switch
                id="confirm-delete"
                checked={confirmDelete}
                onCheckedChange={handleConfirmDeleteChange}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Show confirmation dialog when deleting items or branches
            </p>

            {/* Reset confirmation prompts (2026-06-10). Clears every per-prompt
                "Don't ask again" suppression so the user can roll back their
                opt-outs without flipping Professional mode. */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <Label className="text-sm">Reset confirmation prompts</Label>
                <p className="text-xs text-muted-foreground">
                  Brings back all dialogs you previously dismissed with &ldquo;Don&apos;t ask again&rdquo;
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const cleared = resetAllConfirmSuppressions();
                  toast({
                    title: cleared > 0 ? 'Confirmations reset' : 'No prompts were suppressed',
                    description: cleared > 0
                      ? `Cleared ${cleared} suppressed prompt${cleared === 1 ? '' : 's'}.`
                      : 'You hadn’t opted out of any confirmations.',
                  });
                }}
              >
                Reset
              </Button>
            </div>
          </div>

          {/* Tips & Discovery Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Tips</h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="professional-mode" className="text-sm">
                Professional mode
              </Label>
              <Switch
                id="professional-mode"
                checked={isProfessional}
                onCheckedChange={setProfessional}
                data-testid="professional-mode-toggle"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Suppress &ldquo;Did You Know?&rdquo; tips and all confirmation dialogs. Recommended once you know your way around.
            </p>
          </div>

          {/* Appearance Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Appearance</h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="theme-toggle" className="text-sm">
                Theme
              </Label>
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-muted-foreground" />
                <Switch
                  id="theme-toggle"
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
                <Moon className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Switch between light and dark mode
            </p>
          </div>

          {/* Data & Privacy Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Data &amp; Privacy
            </h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-consent" className="text-sm">
                Allow AI data processing
              </Label>
              <Switch
                id="ai-consent"
                checked={aiDataConsent}
                onCheckedChange={handleAiConsentChange}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              When enabled, your outline content may be sent to <strong>Google Gemini</strong>, <strong>OpenAI</strong>, and <strong>AssemblyAI</strong> for AI features. No data is stored beyond processing.
            </p>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-500 dark:text-sky-400 hover:underline"
            >
              View Privacy Policy
            </a>
          </div>

          {/* AI Usage — launch tier counter (#33) */}
          <div className="space-y-3" data-testid="ai-usage-section">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              AI Usage
            </h3>
            {usageState.isByok ? (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1">
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400" data-testid="ai-usage-line">
                  Unlimited — using your own API key
                </p>
                <p className="text-xs text-muted-foreground">
                  BYOK active. Generations use your own provider key and are not counted against any monthly cap.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border/50 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium" data-testid="ai-usage-tier">
                    {usageState.tierName}
                  </span>
                  {usageState.tier === 'pro' && (
                    <Crown className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </div>
                {Number.isFinite(usageState.cap) ? (
                  <>
                    <p className="text-sm" data-testid="ai-usage-line">
                      <span className="font-medium">{usageState.used}</span>
                      <span className="text-muted-foreground"> of </span>
                      <span className="font-medium">{usageState.cap}</span>
                      <span className="text-muted-foreground">
                        {usageState.tier === 'free-trial'
                          ? ' trial generations used'
                          : ' generations used this month'}
                      </span>
                    </p>
                    {/* Progress bar */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        data-testid="ai-usage-progress"
                        className={
                          usageState.used / usageState.cap >= 1
                            ? 'h-full bg-red-500'
                            : usageState.used / usageState.cap >= 0.8
                              ? 'h-full bg-amber-500'
                              : 'h-full bg-emerald-500'
                        }
                        style={{
                          width: `${Math.min(100, Math.round((usageState.used / Math.max(1, usageState.cap)) * 100))}%`,
                        }}
                      />
                    </div>
                    {usageState.tier === 'free-trial' ? (
                      <p className="text-xs text-muted-foreground">
                        One-time trial. When you run out, add a free API key below (Gemini takes about a minute) or upgrade your plan.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Resets {usageState.resetLabel} ({usageState.daysUntilReset} {usageState.daysUntilReset === 1 ? 'day' : 'days'} away).
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm" data-testid="ai-usage-line">
                    Unlimited generations on this tier.
                  </p>
                )}
                {process.env.NODE_ENV !== 'production' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => { resetUsage(); refreshUsageState(); }}
                    data-testid="ai-usage-reset"
                  >
                    Reset usage (debug)
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* AI Service API Keys */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              AI Service Keys
            </h3>

            {/* Quick start recommendation */}
            {!apiKeys['gemini'] && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                  Quick Start — Set up in 2 minutes
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  Google Gemini is free and powers most SecondBrainWare AI features. No credit card required.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                  onClick={() => {
                    setExpandedGuide('gemini');
                    fireDiscovery('first-byok-prompt-encountered');
                  }}
                >
                  Set Up Gemini (Free)
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Keys are stored locally on your device and never sent to our servers.
            </p>

            <div className="space-y-3">
              {aiProviders.map(provider => (
                <div key={provider.id} className="rounded-lg border border-border/50 p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium">{provider.name}</Label>
                      {provider.free && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                          Free
                        </span>
                      )}
                      {provider.recommended && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                          Recommended
                        </span>
                      )}
                      {apiKeys[provider.id] && providerStatus[provider.id] === 'ok' && (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      )}
                    </div>
                    {!apiKeys[provider.id] && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-primary"
                        onClick={() => {
                          const next = expandedGuide === provider.id ? null : provider.id;
                          setExpandedGuide(next);
                          if (next) fireDiscovery('first-byok-prompt-encountered');
                        }}
                      >
                        {expandedGuide === provider.id ? 'Hide Guide' : 'Get Key'}
                      </Button>
                    )}
                  </div>

                  {/* Setup guide (expandable) */}
                  {expandedGuide === provider.id && (
                    <div className="mb-2 p-2 rounded bg-muted/50 text-xs space-y-1.5">
                      <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
                        {provider.steps.map((step, i) => (
                          <li key={i}>{i === 0 ? (
                            <a
                              href={provider.keyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline hover:no-underline"
                              onClick={(e) => { e.preventDefault(); window.open(provider.keyUrl, '_blank'); }}
                            >
                              {step}
                            </a>
                          ) : step}</li>
                        ))}
                      </ol>
                      <p className="text-[10px] text-muted-foreground/70 italic">{provider.cost}</p>
                      {provider.note && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-500">{provider.note}</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-1.5">
                    <Input
                      type="password"
                      value={apiKeys[provider.id] || ''}
                      onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                      placeholder={provider.placeholder}
                      className="text-xs h-8 font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 flex-shrink-0"
                      disabled={!apiKeys[provider.id]?.trim() || testingProvider === provider.id}
                      onClick={() => handleTestApiKey(provider.id)}
                    >
                      {testingProvider === provider.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : providerStatus[provider.id] === 'ok' ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : providerStatus[provider.id] === 'error' ? (
                        <XCircle className="h-3 w-3 text-red-500" />
                      ) : (
                        <span className="text-xs">Test</span>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Local AI (Ollama) Section - Desktop only, not available on iOS */}
          {!isCapacitor() && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  AI Provider
                </h3>
                {ollamaStatus.checking ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : ollamaStatus.available ? (
                  <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Ollama running
                  </span>
                ) : ollamaInstalled ? (
                  <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Ollama installed, not running
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Ollama not detected
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">AI Mode</Label>
                <Select value={aiProvider} onValueChange={handleAiProviderChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cloud">
                      <div className="flex items-center gap-2">
                        <Cloud className="h-4 w-4" />
                        <span>Cloud AI (Gemini)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="local">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4" />
                        <span>Local AI (Ollama)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="auto">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">⚡</span>
                        <span>Auto (fallback to local on rate limit)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Model selection when local AI is enabled */}
              {(aiProvider === 'local' || aiProvider === 'auto') && (ollamaStatus.available || ollamaStatus.models.length > 0) && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Local Model</Label>
                  <Select value={selectedModel} onValueChange={handleModelChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ollamaStatus.models.map(model => (
                        <SelectItem key={model} value={model}>
                          {model}
                          {model === ollamaStatus.recommendedModel && (
                            <span className="ml-2 text-xs text-muted-foreground">(recommended)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <p className="text-xs text-muted-foreground flex items-start gap-1">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>
                  {aiProvider === 'cloud' && 'Uses Google Gemini for AI features. Requires internet.'}
                  {aiProvider === 'local' && 'Uses Ollama for all AI features. No rate limits, works offline.'}
                  {aiProvider === 'auto' && 'Uses cloud AI normally, falls back to local when rate limited.'}
                  {ollamaStatus.checking && aiProvider !== 'cloud' && (
                    <span className="block mt-1 text-muted-foreground/70">
                      Checking for Ollama…
                    </span>
                  )}
                  {!ollamaStatus.checking && !ollamaStatus.available && (
                    ollamaInstalled ? (
                      <span className="block mt-1">
                        Ollama is installed but the background service isn&apos;t running.
                      </span>
                    ) : aiProvider !== 'cloud' ? (
                      <span className="block mt-1">
                        Install Ollama from <strong>ollama.com</strong> (v0.20+) and run <code className="bg-muted px-1 rounded">ollama pull gemma4:e4b</code>
                      </span>
                    ) : null
                  )}
                </span>
              </p>

              {/* Start Ollama button — shown when Ollama.app is installed but
                  the background service isn't responding. Launching the app
                  starts the service automatically. Available regardless of
                  current provider so the user can start the service even from
                  cloud mode (e.g. to switch to local, or so 'auto' has a real
                  local fallback). */}
              {!ollamaStatus.checking && !ollamaStatus.available && ollamaInstalled && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleStartOllama}
                  disabled={isStartingOllama}
                >
                  {isStartingOllama ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3 mr-1.5" />
                      Start Ollama
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Privacy & Data — GDPR/CCPA export and delete */}
          <div className="space-y-3 pt-2 border-t border-border/40">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Privacy &amp; Data
            </h3>
            <p className="text-xs text-muted-foreground">
              IdiamPro stores all your data locally on this device. Use these
              tools to export everything we hold or to delete it permanently.
            </p>

            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleExportData}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {isExporting ? 'Preparing archive…' : 'Export my data'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Saves a single .zip with every outline (as .idm files), your
                settings, API keys, and AI consent state.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                onClick={handleStartDelete}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete all my data…
              </Button>
              <p className="text-xs text-muted-foreground">
                Wipes outlines, settings, API keys, and AI consent from this
                device. Cannot be undone. Reloads the app afterwards.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </DialogContent>

      {/* Step 1 — warning */}
      <AlertDialog open={deleteStep === 'warn'} onOpenChange={(o) => { if (!o) handleCancelDelete(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete all your IdiamPro data?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  This will permanently remove everything IdiamPro stores on
                  this device:
                </p>
                <ul className="list-disc list-inside text-xs space-y-1">
                  <li>
                    {scope ? `${scope.outlines} outline${scope.outlines === 1 ? '' : 's'}` : 'All your outlines'}
                  </li>
                  <li>Settings, preferences, theme, and saved folder</li>
                  <li>All AI provider API keys stored on this device</li>
                  <li>AI data-processing consent state</li>
                </ul>
                <p className="text-xs text-muted-foreground pt-1">
                  We strongly recommend running <strong>Export my data</strong>
                  {' '}first so you have a backup. This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); handleProceedToConfirm(); }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Step 2 — typed confirmation */}
      <AlertDialog open={deleteStep === 'confirm'} onOpenChange={(o) => { if (!o && !isDeleting) handleCancelDelete(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Type DELETE to confirm
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  This will permanently erase all your IdiamPro data on this
                  device. Type <strong>DELETE</strong> in the box below to
                  confirm.
                </p>
                <Input
                  autoFocus
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  disabled={isDeleting}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              disabled={deleteConfirmText.trim() !== 'DELETE' || isDeleting}
              onClick={(e) => { e.preventDefault(); handleFinalDelete(); }}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete everything'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
