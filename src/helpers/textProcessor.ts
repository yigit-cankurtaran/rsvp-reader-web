export const processText = (text: string): string[] => {
  return text
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
};
