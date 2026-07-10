// Module declaration so TypeScript does not require onnxruntime-node at compile time.
// The module is loaded via dynamic import at runtime on the embedded compute module.
// It is intentionally not listed in package.json devDependencies — it requires
// native compilation on the ARM64 target board.
// Install on device: npm install onnxruntime-node
declare module 'onnxruntime-node';
