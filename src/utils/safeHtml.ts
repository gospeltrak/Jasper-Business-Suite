const BLOCKED_ELEMENTS = new Set(['script', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'link', 'meta']);
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction']);

const isSafeUrl = (value: string) => {
  try {
    const url = new URL(value, window.location.origin);
    return ['https:', 'http:', 'mailto:', 'tel:', 'data:'].includes(url.protocol);
  } catch {
    return false;
  }
};

export function sanitizeTrustedHtml(html: string): string {
  if (!html || typeof window === 'undefined' || typeof DOMParser === 'undefined') return '';

  const document = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = document.body.firstElementChild;
  if (!root) return '';

  root.querySelectorAll('*').forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (BLOCKED_ELEMENTS.has(tag)) {
      element.remove();
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
        return;
      }
      if (URL_ATTRS.has(name) && value && !isSafeUrl(value)) {
        element.removeAttribute(attribute.name);
      }
    });

    if (tag === 'iframe') {
      element.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
      element.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      element.setAttribute('loading', 'lazy');
    }
  });

  return root.innerHTML;
}
