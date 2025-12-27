'use client';

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StateCheckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lastNodeNumber: string;
  outlineName: string;
}

export default function StateCheckDialog({ isOpen, onClose, lastNodeNumber, outlineName }: StateCheckDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Outline Load Report</AlertDialogTitle>
          <AlertDialogDescription>
            This is a report of the data loaded from your browser's local storage for the outline "<strong>{outlineName}</strong>".
            <br /><br />
            The numeric prefix of the last visible node loaded was: <strong>{lastNodeNumber || "N/A"}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
