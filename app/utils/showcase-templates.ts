import type { ShowcaseTemplate } from '~/types/showcase-template';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ShowcaseTemplates');

let _cachedTemplates: ShowcaseTemplate[] | null = null;

export async function loadShowcaseTemplates(): Promise<ShowcaseTemplate[]> {
  if (_cachedTemplates) {
    return _cachedTemplates;
  }

  try {
    const response = await fetch('/templates.json');

    if (!response.ok) {
      logger.error('Failed to load templates.json:', response.status);
      return [];
    }

    const data = (await response.json()) as ShowcaseTemplate[];
    _cachedTemplates = data;

    return data;
  } catch (error) {
    logger.error('Error loading showcase templates:', error);
    return [];
  }
}

export function clearTemplateCache(): void {
  _cachedTemplates = null;
}
