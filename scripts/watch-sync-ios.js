#!/usr/bin/env node
/**
 * Watch for changes in src/ and automatically sync to iOS
 * Run with: npm run watch:ios
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

let syncTimeout = null;
let isSyncing = false;

function log(message) {
  console.log(`[iOS Sync] ${new Date().toLocaleTimeString()} - ${message}`);
}

function syncIOS() {
  if (isSyncing) {
    log('Sync already in progress, skipping...');
    return;
  }

  isSyncing = true;
  log('Syncing to iOS...');

  try {
    execSync('npx cap sync ios', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: { ...process.env, PATH: process.env.PATH }
    });
    log('iOS sync complete!');
  } catch (error) {
    log('iOS sync failed: ' + error.message);
  } finally {
    isSyncing = false;
  }
}

function debouncedSync() {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  // Wait 2 seconds after last change before syncing
  syncTimeout = setTimeout(syncIOS, 2000);
}

function watchDirectory(dir) {
  fs.watch(dir, { recursive: true }, (eventType, filename) => {
    if (filename && !filename.includes('node_modules') && !filename.startsWith('.')) {
      log(`Change detected: ${filename}`);
      debouncedSync();
    }
  });
}

log('Starting iOS sync watcher...');
log('Watching: ' + SRC_DIR);
log('Press Ctrl+C to stop\n');

// Initial sync
syncIOS();

// Watch for changes
watchDirectory(SRC_DIR);

// Keep process running
process.on('SIGINT', () => {
  log('Stopping watcher...');
  process.exit(0);
});
