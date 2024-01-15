import { refreshActiveHighlight } from "./highlight";
import { emit } from "./emitter";
import { getState, setState } from "./state";
import { getConfig } from "./config";
import { getFocusableElements } from "./utils";

export function requireRefresh(window: Window) {
  const resizeTimeout = getState("__resizeTimeout");
  if (resizeTimeout) {
    window.cancelAnimationFrame(resizeTimeout);
  }

  setState(
    "__resizeTimeout",
    window.requestAnimationFrame(() => refreshActiveHighlight(window))
  );
}

function trapFocus(e: KeyboardEvent, document: Document) {
  const isActivated = getState("isInitialized");
  if (!isActivated) {
    return;
  }

  const isTabKey = e.key === "Tab" || e.keyCode === 9;
  if (!isTabKey) {
    return;
  }

  const activeElement = getState("__activeElement");
  const popoverEl = getState("popover")?.wrapper;

  const focusableEls = getFocusableElements([
    ...(popoverEl ? [popoverEl] : []),
    ...(activeElement ? [activeElement] : []),
  ]);

  const firstFocusableEl = focusableEls[0];
  const lastFocusableEl = focusableEls[focusableEls.length - 1];

  e.preventDefault();

  if (e.shiftKey) {
    const previousFocusableEl =
      focusableEls[focusableEls.indexOf(document.activeElement as HTMLElement) - 1] || lastFocusableEl;
    previousFocusableEl?.focus();
  } else {
    const nextFocusableEl =
      focusableEls[focusableEls.indexOf(document.activeElement as HTMLElement) + 1] || firstFocusableEl;
    nextFocusableEl?.focus();
  }
}

function onKeyup(e: KeyboardEvent) {
  const allowKeyboardControl = getConfig("allowKeyboardControl") ?? true;

  if (!allowKeyboardControl) {
    return;
  }

  if (e.key === "Escape") {
    emit("escapePress");
  } else if (e.key === "ArrowRight") {
    emit("arrowRightPress");
  } else if (e.key === "ArrowLeft") {
    emit("arrowLeftPress");
  }
}

/**
 * Attaches click handler to the elements created by driver.js. It makes
 * sure to give the listener the first chance to handle the event, and
 * prevents all other pointer-events to make sure no external-library
 * ever knows the click happened.
 *
 * @param {Element} element Element to listen for click events
 * @param {(pointer: MouseEvent | PointerEvent) => void} listener Click handler
 * @param {(target: HTMLElement) => boolean} shouldPreventDefault Whether to prevent default action i.e. link clicks etc
 */
export function onDriverClick(
  window: Window,
  element: Element,
  listener: (pointer: MouseEvent | PointerEvent) => void,
  shouldPreventDefault?: (target: HTMLElement) => boolean
) {
  const listenerWrapper = (e: MouseEvent | PointerEvent, listener?: (pointer: MouseEvent | PointerEvent) => void) => {
    const target = e.target as HTMLElement;
    if (!element.contains(target)) {
      return;
    }

    if (!shouldPreventDefault || shouldPreventDefault(target)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }

    listener?.(e);
  };

  // We want to be the absolute first one to hear about the event
  const useCapture = true;

  // Events to disable
  window.document.addEventListener("pointerdown", listenerWrapper, useCapture);
  window.document.addEventListener("mousedown", listenerWrapper, useCapture);
  window.document.addEventListener("pointerup", listenerWrapper, useCapture);
  window.document.addEventListener("mouseup", listenerWrapper, useCapture);

  // Actual click handler
  window.document.addEventListener(
    "click",
    e => {
      listenerWrapper(e, listener);
    },
    useCapture
  );
}

export function initEvents(window: Window) {
  window.addEventListener("keyup", onKeyup, false);
  window.addEventListener("keydown", e => trapFocus(e, window.document), false);
  window.addEventListener("resize", () => requireRefresh(window));
  window.addEventListener("scroll", () => requireRefresh(window));
}

export function destroyEvents(window: Window) {
  window.removeEventListener("keyup", onKeyup);
  window.removeEventListener("resize", () => requireRefresh(window));
  window.removeEventListener("scroll", () => requireRefresh(window));
}
