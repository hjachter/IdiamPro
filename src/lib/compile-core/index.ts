// ============================================================================
// compile-core — the shared core library of the content compiler (Phase 0).
// See docs/content-compiler-architecture.md for the full blueprint.
// One canonical clean-text engine, one subtree traversal, one structure
// mapper, and the Compile Tree types + content fingerprint that later phases
// (manifests, caching, staleness, adapters) build on.
// ============================================================================

export { htmlToPlainText, decodeEntities, type CleanTextPreset } from './clean-text';
export {
  liveChildIds,
  walkSubtree,
  renderSubtreeForPrompt,
  pathToNode,
  type TraversableNode,
  type TraversableNodeMap,
  type WalkControl,
  type WalkOptions,
} from './traverse';
export {
  mapStructure,
  type CompileRole,
  type StructureUnit,
  type StructureMapOptions,
} from './structure-mapper';
export {
  contentFingerprint,
  hashText,
  buildCompileTree,
  type CompileUnit,
  type CompileTree,
  type BuildCompileTreeOptions,
} from './compile-tree';
