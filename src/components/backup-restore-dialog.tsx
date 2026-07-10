'use client';

/**
 * BackupRestoreDialog — Backup / Restore feature (2026-06-10).
 *
 * The single dialog covers BOTH user paths:
 *   • Backup — the user gives an optional label and writes a snapshot of the
 *     current outline to disk. Triggered from the outline toolbar Backup
 *     button.
 *   • Restore — the user picks one of the existing snapshots and either
 *     previews it side-by-side with the current outline or restores it
 *     over the current state. A confirmation prompt protects against
 *     accidental overwrites; an auto-snapshot of the current state is taken
 *     immediately before any restore (the "auto: before restore" snapshot).
 *
 * Snapshot retention is capped at 20 per outline (handled in main process).
 * Restoring renders an "Undo" button in the persistent toast so users can
 * roll back instantly without hunting through the list again.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import {
  createSnapshot,
  deleteSnapshot,
  formatSnapshotSize,
  formatSnapshotTimestamp,
  listSnapshots,
  readSnapshot,
  snapshotBeforeRestore,
  type SnapshotMeta,
} from '@/lib/snapshot-storage';
import { isElectron } from '@/lib/electron-storage';
import { Save, Eye, RotateCcw, Trash2, ShieldCheck, ArrowLeft } from 'lucide-react';
import type { Outline } from '@/types';
import { useToast } from '@/hooks/use-toast';

export type BackupRestoreInitialTab = 'backup' | 'restore';

interface BackupRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Initial tab when the dialog opens (defaults to 'backup'). */
  initialTab?: BackupRestoreInitialTab;
  /** The currently loaded outline — the one being backed up / restored. */
  outline: Outline | null;
  /**
   * Called when the user restores a snapshot. The caller is responsible for
   * (a) writing the snapshot's content over the current outline in the
   * outlines list AND (b) marking the action on the undo stack so the user
   * can undo the restore via Cmd+Z. The dialog passes the snapshot's Outline
   * payload and the metadata of the auto-snapshot taken just before the
   * restore (used for the toast's Undo button).
   */
  onRestore: (restoredOutline: Outline, preRestoreMeta: SnapshotMeta | null) => void;
}

export default function BackupRestoreDialog({
  open,
  onOpenChange,
  initialTab = 'backup',
  outline,
  onRestore,
}: BackupRestoreDialogProps) {
  const { toast } = useToast();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [tab, setTab] = useState<BackupRestoreInitialTab>(initialTab);
  const [label, setLabel] = useState('');
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<{ meta: SnapshotMeta; outline: Outline } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when the dialog opens
  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setLabel('');
      setPreviewSnapshot(null);
    }
  }, [open, initialTab]);

  // Load snapshot list when the dialog opens, or when the Restore tab is
  // selected, or after a save / restore so the list stays current.
  const reloadSnapshots = useCallback(async () => {
    if (!outline) {
      setSnapshots([]);
      return;
    }
    setIsLoadingList(true);
    try {
      const list = await listSnapshots(outline.name);
      setSnapshots(list);
    } finally {
      setIsLoadingList(false);
    }
  }, [outline]);

  useEffect(() => {
    if (open) reloadSnapshots();
  }, [open, reloadSnapshots]);

  const handleBackup = useCallback(async () => {
    if (!outline) return;
    setIsSaving(true);
    try {
      const meta = await createSnapshot(outline, { label, kind: 'manual' });
      if (!meta) {
        // createSnapshot already reports a real desktop failure to the backup
        // health watchdog (which raises its own loud, persistent warning). On
        // the web build it simply isn't available yet, so keep this neutral.
        toast({
          title: isElectron() ? "Backup didn't save" : 'Backup unavailable',
          description: isElectron()
            ? 'Your changes may not be protected — see the backup warning for how to fix it.'
            : 'Snapshots only run in the desktop app right now.',
          duration: Infinity,
        });
        return;
      }
      toast({
        title: 'Backed up: ' + outline.name,
        description: label ? 'Labeled "' + label + '" - view in Restore.' : 'View in Restore.',
        duration: Infinity,
      });
      setLabel('');
      await reloadSnapshots();
      // Drop into the Restore tab so the user can confirm their snapshot
      // appears at the top of the list.
      setTab('restore');
    } finally {
      setIsSaving(false);
    }
  }, [outline, label, toast, reloadSnapshots]);

  const handlePreview = useCallback(async (meta: SnapshotMeta) => {
    if (!outline) return;
    const content = await readSnapshot(outline.name, meta.fileName);
    if (!content) {
      toast({ title: 'Could not load snapshot', description: 'The file may have been moved.', duration: 5000 });
      return;
    }
    setPreviewSnapshot({ meta, outline: content });
  }, [outline, toast]);

  const handleRestore = useCallback(async (meta: SnapshotMeta) => {
    if (!outline) return;
    const ok = await confirm({
      id: 'confirm.restoreSnapshot',
      title: 'Restore this snapshot?',
      description: 'Your current outline will be replaced. A backup of the current state will be made automatically before the restore.',
      confirmLabel: 'Restore',
      destructive: false,
    });
    if (!ok) return;

    // 1. Snapshot the current state first (this is the safety net).
    await snapshotBeforeRestore(outline);
    // 2. Read the chosen snapshot.
    const restored = await readSnapshot(outline.name, meta.fileName);
    if (!restored) {
      toast({ title: 'Could not load snapshot', duration: 5000 });
      return;
    }
    // 3. Find the auto-snapshot we just wrote so the toast's Undo button
    //    can point at it (we re-list and pick the newest auto-restore).
    const updatedList = await listSnapshots(outline.name);
    setSnapshots(updatedList);
    const autoSnapshot = updatedList.find(s => s.kind === 'auto-restore') || null;

    onRestore(restored, autoSnapshot);
    onOpenChange(false);
  }, [outline, confirm, onRestore, onOpenChange, toast]);

  const handleDelete = useCallback(async (meta: SnapshotMeta) => {
    if (!outline) return;
    const ok = await confirm({
      id: 'confirm.deleteSnapshot',
      title: 'Delete this snapshot?',
      description: 'This snapshot will be permanently removed. Other snapshots are unaffected.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await deleteSnapshot(outline.name, meta.fileName);
    await reloadSnapshots();
  }, [outline, confirm, reloadSnapshots]);

  const renderKindBadge = (kind: SnapshotMeta['kind']) => {
    const styles = {
      manual: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
      'auto-transform': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      'auto-restore': 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    } as const;
    const label = {
      manual: 'Manual',
      'auto-transform': 'Auto · before transform',
      'auto-restore': 'Auto · before restore',
    } as const;
    return (
      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${styles[kind]}`}>
        {label[kind]}
      </span>
    );
  };

  const electronOnly = !isElectron();

  // Preview view replaces the list when the user clicks Preview on a row.
  const previewView = useMemo(() => {
    if (!previewSnapshot) return null;
    const { meta, outline: previewOutline } = previewSnapshot;
    const nodeCount = Object.keys(previewOutline.nodes || {}).length;
    const currentNodeCount = outline ? Object.keys(outline.nodes || {}).length : 0;
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setPreviewSnapshot(null)} className="px-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to list
        </Button>
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Snapshot preview</p>
              <p className="text-xs text-muted-foreground">
                {formatSnapshotTimestamp(meta.createdAt)} {meta.label ? `· ${meta.label}` : ''}
              </p>
            </div>
            {renderKindBadge(meta.kind)}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded border bg-background p-2">
              <p className="font-medium text-muted-foreground mb-1">Current outline</p>
              <p>{currentNodeCount} items</p>
            </div>
            <div className="rounded border bg-background p-2">
              <p className="font-medium text-muted-foreground mb-1">Snapshot</p>
              <p>{nodeCount} items</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Restoring replaces every item in the current outline with the snapshot above.
            Your current state will be auto-backed-up first so you can undo.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPreviewSnapshot(null)}>Cancel</Button>
          <Button onClick={() => handleRestore(meta)}>
            <RotateCcw className="h-4 w-4 mr-1" /> Restore this snapshot
          </Button>
        </div>
      </div>
    );
  }, [previewSnapshot, outline, handleRestore]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              Backups for {outline ? `"${outline.name}"` : 'this outline'}
            </DialogTitle>
            <DialogDescription>
              Save a snapshot of this outline to disk, or restore a previous one. The 20 most recent snapshots are kept.
            </DialogDescription>
          </DialogHeader>

          {electronOnly && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              Snapshots are only available in the desktop app right now. The toolbar button will still show on web, but writes are deferred until the desktop build is launched.
            </div>
          )}

          {previewView || (
            <Tabs value={tab} onValueChange={(v) => setTab(v as BackupRestoreInitialTab)} className="space-y-3">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="backup">
                  <Save className="h-4 w-4 mr-1.5" /> Backup
                </TabsTrigger>
                <TabsTrigger value="restore">
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Restore ({snapshots.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="backup" className="space-y-3 mt-0">
                <div className="space-y-2">
                  <Label htmlFor="snapshot-label" className="text-sm">
                    Optional label
                  </Label>
                  <Input
                    id="snapshot-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value.slice(0, 30))}
                    placeholder="e.g. before merge, end of Q2 brainstorm"
                    maxLength={30}
                  />
                  <p className="text-xs text-muted-foreground">
                    A short note to help you find this snapshot later. Up to 30 characters.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                  <Button onClick={handleBackup} disabled={!outline || isSaving || electronOnly}>
                    {isSaving ? 'Saving…' : <><Save className="h-4 w-4 mr-1" /> Back up now</>}
                  </Button>
                </DialogFooter>
              </TabsContent>

              <TabsContent value="restore" className="space-y-3 mt-0">
                {isLoadingList ? (
                  <div className="text-center text-sm text-muted-foreground py-8">Loading snapshots…</div>
                ) : snapshots.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No snapshots yet for this outline. Use the Backup tab to create one.
                  </div>
                ) : (
                  <ScrollArea className="h-[360px] rounded border">
                    <div className="divide-y">
                      {snapshots.map((meta) => (
                        <div key={meta.fileName} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/50">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium truncate">
                                {formatSnapshotTimestamp(meta.createdAt)}
                              </p>
                              {renderKindBadge(meta.kind)}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {meta.label || (meta.kind === 'manual' ? '(no label)' : '')} · {formatSnapshotSize(meta.size)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="sm" onClick={() => handlePreview(meta)} title="Preview before restoring">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleRestore(meta)} title="Restore this snapshot">
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(meta)} title="Delete this snapshot">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}
