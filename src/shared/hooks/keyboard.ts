/**
 * Returns true when a text-like input element or editable region currently holds focus,
 * so global table keyboard shortcuts do not hijack user typing.
 */
export function isTextInputFocused(target: EventTarget | null): boolean {
  const el =
    target instanceof HTMLElement
      ? target
      : typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type?.toLowerCase() ?? 'text';
    return type !== 'range' && type !== 'checkbox' && type !== 'radio' && type !== 'button';
  }
  return false;
}
