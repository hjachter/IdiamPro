'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Folder, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SettingsDialogProps {
  children: React.ReactNode;
}

export default function SettingsDialog({ children }: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [dataFolder, setDataFolder] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('idiampro-data-folder') || 'Browser Storage (Default)';
    }
    return 'Browser Storage (Default)';
  });
  const { toast } = useToast();

  const handleSelectFolder = async () => {
    try {
      // Check if File System Access API is supported
      if ('showDirectoryPicker' in window) {
        // @ts-ignore - showDirectoryPicker is not in TypeScript types yet
        const dirHandle = await window.showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'documents',
        });

        // Save folder handle and path
        const folderPath = dirHandle.name;
        setDataFolder(folderPath);
        localStorage.setItem('idiampro-data-folder', folderPath);

        // Store the directory handle for future use
        // Note: This requires persistence permission
        const permissionStatus = await dirHandle.requestPermission({ mode: 'readwrite' });

        if (permissionStatus === 'granted') {
          toast({
            title: 'Folder Selected',
            description: `Data folder set to: ${folderPath}`,
          });
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
                  Select a folder where all your outlines will be saved. Currently using browser storage by default.
                  {!('showDirectoryPicker' in window) && (
                    <span className="block mt-1 text-amber-400">
                      Note: Folder selection is not supported in your browser. Use Chrome, Edge, or the Desktop app for this feature.
                    </span>
                  )}
                </span>
              </p>
            </div>
          </div>

          {/* Future Settings Sections */}
          <div className="space-y-2 opacity-50">
            <h3 className="text-sm font-medium">More Settings Coming Soon</h3>
            <p className="text-xs text-muted-foreground">
              Additional settings will be available in future updates:
            </p>
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
              <li>Auto-save intervals</li>
              <li>Theme customization</li>
              <li>Keyboard shortcuts</li>
              <li>Export preferences</li>
            </ul>
          </div>
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
