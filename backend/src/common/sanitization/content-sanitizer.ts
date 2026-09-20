const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_COMMENTS = /<!--[\s\S]*?-->/g;
const HTML_TAGS = /<[^>]*>/g;

/**
 * Nexus stores user-entered content as plain text. Strip markup and control
 * characters at the API boundary so later renderers cannot accidentally treat
 * stored ticket/chat content as HTML.
 */
export function sanitizePlainText(value: string): string {
  return value
    .replace(HTML_COMMENTS, '')
    .replace(HTML_TAGS, '')
    .replace(CONTROL_CHARACTERS, '')
    .trim();
}
