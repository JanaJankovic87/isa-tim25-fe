// Polyfills for browser environment to support some older libraries
// Define `global` for libraries that expect a Node-like global variable (e.g., sockjs-client)
(window as any).global = (window as any);

// Minimal `process.env` shim if libraries check for it
;(window as any).process = (window as any).process || { env: { NODE_ENV: 'production' } };
