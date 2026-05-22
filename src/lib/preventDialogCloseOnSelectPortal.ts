/**
 * Radix Select/Popover renderizam em portal fora do Dialog.
 * Sem isto, o Dialog trata o clique como "fora" e fecha ou bloqueia a seleção.
 */
export function preventDialogCloseOnSelectPortal(e: Event): void {
  const t = (e as unknown as { target?: EventTarget | null }).target;
  if (!(t instanceof HTMLElement)) return;
  if (
    t.closest('[role="listbox"]') ||
    t.closest("[data-radix-select-viewport]") ||
    t.closest("[data-radix-popper-content-wrapper]")
  ) {
    e.preventDefault();
  }
}
