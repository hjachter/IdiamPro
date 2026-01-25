'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Folder, Info, Smartphone, Cpu, Cloud, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { storeDirectoryHandle, getDirectoryHandle, verifyDirectoryPermission } from '@/lib/file-storage';
import { isElectron, electronSelectDirectory, electronGetStoredDirectoryPath } from '@/lib/electron-storage';
import { checkOllamaStatusAction } from '@/app/actions';
import type { AIProvider } from '@/types';

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
  const { toast } = useToast();

  // Local AI (Ollama) state
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
      <DialogContent className="sm:max-w-[500px]">
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
                      <span className="block mt-1 text-amber-400">
                        Note: Folder selection is not supported in your browser. Use Chrome, Edge, or the Desktop app for this feature.
                      </span>
                    )}
                  </span>
                </p>
              </div>
            )}
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
                    <SelectItem value="local" disabled={!ollamaStatus.available}>
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
              {(aiProvider === 'local' || aiProvider === 'auto') && ollamaStatus.available && (
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
                      Install Ollama from <strong>ollama.com</strong> and run <code className="bg-muted px-1 rounded">ollama pull llama3.2</code>
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
