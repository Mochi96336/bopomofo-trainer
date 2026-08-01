import { createApp } from "./create-app.js";

/**
 * The bootstrap, and nothing else.
 *
 * Importing this module still starts the app -- `browser.ts` depends on that,
 * and so does the page -- but the app itself no longer lives here. Everything
 * that has state or touches the DOM is in `create-app.ts` behind a call, which
 * is what lets a test build one over a jsdom document and drive it, instead of
 * reading this file as text and asserting on the source.
 */

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing required element: ${selector}`);
  return element;
}

function newSeed(): string {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now().toString(36)}`;
}

createApp({
  root: requireElement<HTMLDivElement>("#app"),
  capture: requireElement<HTMLTextAreaElement>("#keyboard-capture"),
  storage: localStorage,
  newSeed,
});
