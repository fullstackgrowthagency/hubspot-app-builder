const TOKEN_PATTERN = /\{\{(\w+)\}\}/g;

export function renderTemplateString(content, vars) {
  return content.replace(TOKEN_PATTERN, (match, key) => {
    if (!(key in vars)) {
      throw new Error(`Missing template variable: ${key}`);
    }
    return String(vars[key]);
  });
}
