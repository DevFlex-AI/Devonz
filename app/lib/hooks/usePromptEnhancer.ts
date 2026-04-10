import { useState, useRef, useEffect } from 'react';
import type { ProviderInfo } from '~/types/model';
import { csrfFetch } from '~/lib/api/csrf-client';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('usePromptEnhancement');

export function usePromptEnhancer() {
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [promptEnhanced, setPromptEnhanced] = useState(false);
  const enhanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (enhanceTimeoutRef.current !== null) {
        clearTimeout(enhanceTimeoutRef.current);
        enhanceTimeoutRef.current = null;
      }
    };
  }, []);

  const resetEnhancer = () => {
    setEnhancingPrompt(false);
    setPromptEnhanced(false);
  };

  const enhancePrompt = async (
    input: string,
    setInput: (value: string) => void,
    model: string,
    provider: ProviderInfo,
    apiKeys?: Record<string, string>,
  ) => {
    setEnhancingPrompt(true);
    setPromptEnhanced(false);

    const requestBody: { message: string; model: string; provider: ProviderInfo; apiKeys?: Record<string, string> } = {
      message: input,
      model,
      provider,
    };

    if (apiKeys) {
      requestBody.apiKeys = apiKeys;
    }

    let response: Response;

    try {
      response = await csrfFetch('/api/enhancer', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      logger.error('Prompt enhancement request failed:', error);
      setEnhancingPrompt(false);

      return;
    }

    if (!response.ok) {
      logger.error('Prompt enhancement returned error status:', response.status);
      setEnhancingPrompt(false);

      return;
    }

    const reader = response.body?.getReader();

    if (!reader) {
      logger.warn('Prompt enhancement response has no body');
      setEnhancingPrompt(false);

      return;
    }

    const originalInput = input;
    const decoder = new TextDecoder();

    let _input = '';
    let _error;

    try {
      setInput('');

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        _input += decoder.decode(value, { stream: true });

        logger.trace('Set input', _input);

        setInput(_input);
      }
    } catch (error) {
      _error = error;
      setInput(originalInput);
    } finally {
      if (_error) {
        logger.error(_error);
      }

      setEnhancingPrompt(false);
      setPromptEnhanced(true);

      enhanceTimeoutRef.current = setTimeout(() => {
        setInput(_input);
      });
    }
  };

  return { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer };
}
