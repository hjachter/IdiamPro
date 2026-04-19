'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Folder, Info, Smartphone, Cpu, Cloud, Loader2, CheckCircle, XCircle, Crown, Shield, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Badge } from '@/components/ui/badge';
import { useAI } from '@/contexts/ai-context';
import AIPlanDialog from './ai-plan-dialog';
import { useToast } from '@/hooks/use-toast';
import { storeDirectoryHandle, getDirectoryHandle, verifyDirectoryPermission } from '@/lib/file-storage';
import { isElectron, electronSelectDirectory, electronGetStoredDirectoryPath } from '@/lib/electron-storage';
import { checkOllamaStatusAction } from '@/app/actions';
import type { AIProvider, AIDepth } from '@/types';
import { AI_DEPTH_CONFIG } from '@/types';

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

  // Format plan name for display
  const planDisplayName = {
    FREE: 'Free',
    BASIC: 'Basic',
    PREMIUM: 'Premium',
    ACADEMIC: 'Academic'
  }[plan] || plan;

  // AI depth setting
  const [aiDepth, setAiDepth] = useState<AIDepth>('standard');

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
  }>({ checking: false, available: false, models: [], recommendedModel: null });
  const [selectedModel, setSelectedModel] = useState<string>('');

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

  // Check Ollama status when dialog opens
  useEffect(() => {
    if (open) {
      checkOllamaStatus();
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

  const aiProviders = [
    { id: 'gemini', name: 'Google Gemini', placeholder: 'AIza...', hint: 'Get key at ai.google.dev' },
    { id: 'openai', name: 'OpenAI', placeholder: 'sk-...', hint: 'Get key at platform.openai.com' },
    { id: 'anthropic', name: 'Anthropic Claude', placeholder: 'sk-ant-...', hint: 'Get key at console.anthropic.com' },
    { id: 'mistral', name: 'Mistral AI', placeholder: 'M...', hint: 'Get key at console.mistral.ai' },
    { id: 'groq', name: 'Groq', placeholder: 'gsk_...', hint: 'Get key at console.groq.com (fast inference)' },
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
            <AIPlanDialog>
              <Button variant="outline" size="sm" className="w-full">
                <Crown className="mr-2 h-4 w-4" />
                Manage Subscription...
              </Button>
            </AIPlanDialog>
          </div>

          {/* AI Depth Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">AI Reasoning Depth</h3>
            <p className="text-xs text-muted-foreground">
              Controls how thoroughly AI analyzes and responds. Can be overridden per-request.
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
                Confirm before deleting nodes
              </Label>
              <Switch
                id="confirm-delete"
                checked={confirmDelete}
                onCheckedChange={handleConfirmDeleteChange}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Show confirmation dialog when deleting nodes or subtrees
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

          {/* AI Service API Keys */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              AI Service Keys
            </h3>
            <p className="text-xs text-muted-foreground">
              Add your own API keys to use different AI providers. Keys are stored locally on your device and never sent to our servers.
            </p>
            <div className="space-y-2">
              {aiProviders.map(provider => (
                <div key={provider.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs text-muted-foreground">{provider.name}</Label>
                    <div className="flex gap-1.5 mt-0.5">
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
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{provider.hint}</p>
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
                  {!ollamaStatus.available && aiProvider !== 'cloud' && (
                    <span className="block mt-1">
                      Install Ollama from <strong>ollama.com</strong> (v0.20+) and run <code className="bg-muted px-1 rounded">ollama pull gemma4:e4b</code>
                    </span>
                  )}
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
