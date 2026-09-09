import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { SimAgriConnector, SonagessConnector, type ScraperResult } from './connectors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-5.4-mini';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const MAX_PRODUCTS_PER_BATCH = 1;
const MAX_MARKET_HINTS = 6;
const OPENAI_MAX_RETRIES = 2;
const MAX_PRODUCTS_PER_RUN = 1;

type ProductRow = {
  id: string;
  name: string;
  unit: string;
};

type MarketHintRow = {
  id: string;
  name: string;
  city_id?: string | null;
  cities?: { name?: string | null } | null;
};

type CityRow = {
  id: string;
  name: string;
};

type OpenAIPricePoint = {
  product_id: string;
  product_name: string;
  source_name: string;
  location_label: string;
  price_value: number;
  currency: string;
  unit: string;
  quantity: number;
  confidence_score: number;
  url: string;
  notes?: string | null;
};

type OpenAIPriceResponse = {
  price_points: OpenAIPricePoint[];
};

function normalizeText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function resolveCityId(locationLabel: string, cities: CityRow[]) {
  const normalizedLocation = normalizeText(locationLabel);
  if (!normalizedLocation) return null;

  for (const city of cities) {
    const normalizedCity = normalizeText(city.name);
    if (!normalizedCity) continue;
    if (normalizedLocation.includes(normalizedCity) || normalizedCity.includes(normalizedLocation)) {
      return city.id;
    }
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryDelayMs(errorText: string, retryAfterHeader: string | null) {
  const headerSeconds = Number(retryAfterHeader || '');
  if (Number.isFinite(headerSeconds) && headerSeconds > 0) {
    return Math.ceil(headerSeconds * 1000);
  }

  const retryMatch = errorText.match(/Please try again in\s+([\d.]+)s/i);
  if (retryMatch) {
    const seconds = Number(retryMatch[1]);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds * 1000);
    }
  }

  return 5000;
}

function extractResponseText(payload: any) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }

  const messages = Array.isArray(payload?.output) ? payload.output : [];
  const textParts: string[] = [];

  for (const item of messages) {
    if (item?.type !== 'message' || !Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (content?.type === 'output_text' && typeof content?.text === 'string') {
        textParts.push(content.text);
      }
    }
  }

  return textParts.join('\n').trim();
}

function extractSources(payload: any) {
  const outputs = Array.isArray(payload?.output) ? payload.output : [];
  const sources: any[] = [];

  for (const item of outputs) {
    if (item?.type === 'web_search_call' && item?.action?.sources) {
      sources.push(...item.action.sources);
    }
  }

  return sources;
}

async function fetchOpenAIPrices(products: ProductRow[], marketHints: string[]) {
  const input = [
    'Releve des prix recents au Burkina Faso uniquement.',
    'Retourne seulement des prix plausibles en XOF/FCFA.',
    'Ignore les produits sans source credible.',
    'Zones prioritaires: ' + marketHints.join(', '),
    'Produits:',
    ...products.map((product) => `- product_id=${product.id}; nom=${product.name}; unite=${product.unit}`),
  ].join('\n');

  for (let attempt = 0; attempt <= OPENAI_MAX_RETRIES; attempt += 1) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        reasoning: { effort: 'low' },
        tools: [
          {
            type: 'web_search',
            user_location: {
              type: 'approximate',
              country: 'BF',
              city: 'Ouagadougou',
              region: 'Burkina Faso',
              timezone: 'Africa/Ouagadougou',
            },
          },
        ],
        tool_choice: 'auto',
        include: ['web_search_call.action.sources'],
        text: {
          format: {
            type: 'json_schema',
            name: 'burkina_external_prices',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                price_points: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      product_id: { type: 'string' },
                      product_name: { type: 'string' },
                      source_name: { type: 'string' },
                      location_label: { type: 'string' },
                      price_value: { type: 'number' },
                      currency: { type: 'string' },
                      unit: { type: 'string' },
                      quantity: { type: 'number' },
                      confidence_score: { type: 'number' },
                      url: { type: 'string' },
                      notes: { type: ['string', 'null'] },
                    },
                    required: [
                      'product_id',
                      'product_name',
                      'source_name',
                      'location_label',
                      'price_value',
                      'currency',
                      'unit',
                      'quantity',
                      'confidence_score',
                      'url',
                      'notes',
                    ],
                  },
                },
              },
              required: ['price_points'],
            },
          },
        },
        input,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429 && attempt < OPENAI_MAX_RETRIES) {
        await sleep(parseRetryDelayMs(errorText, response.headers.get('retry-after')));
        continue;
      }
      throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    const text = extractResponseText(payload);

    if (!text) {
      return {
        pricePoints: [],
        sources: extractSources(payload),
        rawResponse: payload,
        responseId: payload?.id || null,
      };
    }

    const parsed = JSON.parse(text) as OpenAIPriceResponse;
    return {
      pricePoints: parsed.price_points ?? [],
      sources: extractSources(payload),
      rawResponse: payload,
      responseId: payload?.id || null,
    };
  }

  throw new Error('OpenAI request failed after retries');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestBody = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const requestedOffset = Number(requestBody?.offset ?? 0);
  const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? Math.floor(requestedOffset) : 0;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase credentials' }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: products, error: productsError }, { data: markets, error: marketsError }, { data: cities, error: citiesError }] = await Promise.all([
    supabase.from('products').select('id, name, unit').order('name'),
    supabase.from('markets').select('id, name, city_id, cities(name)').order('name'),
    supabase.from('cities').select('id, name').order('name'),
  ]);

  if (productsError || marketsError || citiesError) {
    return new Response(JSON.stringify({ error: productsError?.message || marketsError?.message || citiesError?.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const allProducts = (products ?? []) as ProductRow[];
  const productsToScan = allProducts.slice(offset, offset + MAX_PRODUCTS_PER_RUN);
  const nextOffset = offset + productsToScan.length;
  const hasMore = nextOffset < allProducts.length;

  const marketHints = Array.from(
    new Set(
      ((markets ?? []) as MarketHintRow[])
        .flatMap((market) => [market.name, market.cities?.name || null])
        .filter(Boolean)
        .map((value) => String(value))
    )
  ).slice(0, MAX_MARKET_HINTS);

  let results: ScraperResult[] = [];
  let mode = 'openai_web_search';
  let openAiAttempted = false;
  let openAiSucceeded = false;
  let openAiError: string | null = null;
  let openAiRetryAfterMs: number | null = null;
  let openAiResponseIds: string[] = [];
  let openAiSourcesCount = 0;
  const batches = chunkArray(productsToScan, MAX_PRODUCTS_PER_BATCH);

  try {
    if (!OPENAI_API_KEY) {
      throw new Error('Missing OPENAI_API_KEY secret');
    }

    openAiAttempted = true;

    for (const batch of batches) {
      const openAiResult = await fetchOpenAIPrices(batch, marketHints);
      if (openAiResult.responseId) {
        openAiResponseIds.push(openAiResult.responseId);
      }
      openAiSourcesCount += Array.isArray(openAiResult.sources) ? openAiResult.sources.length : 0;

      results.push(
        ...openAiResult.pricePoints
          .filter((item) => item.product_id && Number(item.price_value) > 0)
          .map((item) => ({
            product_id: item.product_id,
            source_name: item.source_name || `OpenAI Web Search (${OPENAI_MODEL})`,
            price_value: Math.round(Number(item.price_value)),
            unit: item.unit,
            quantity: Number(item.quantity || 1),
            confidence_score: Math.max(0, Math.min(1, Number(item.confidence_score || 0.5))),
            url: item.url,
            location_label: item.location_label,
            city_id: resolveCityId(item.location_label, (cities ?? []) as CityRow[]),
            raw_payload: {
              provider: 'openai_web_search',
              model: OPENAI_MODEL,
              notes: item.notes || null,
              sources: openAiResult.sources,
            },
          }))
      );
    }

    openAiSucceeded = true;
  } catch (error) {
    console.error('[OpenAI Web Search] Falling back to Burkina connectors:', error);
    mode = 'fallback_connectors';
    openAiSucceeded = false;
    openAiError = error instanceof Error ? error.message : String(error);
    openAiRetryAfterMs = openAiError ? parseRetryDelayMs(openAiError, null) : null;

    const connectors = [new SimAgriConnector(), new SonagessConnector()];
    const scanPromises = connectors.map((connector) => connector.fetchPrices((products ?? []) as any));
    const scans = await Promise.all(scanPromises);
    results = scans.flat();
  }

  const dedupedResults = Array.from(
    new Map(
      results.map((result) => [
        `${result.product_id}:${normalizeText(result.source_name)}:${normalizeText(result.location_label)}`,
        result,
      ])
    ).values()
  );

  const { error: upsertError } = await supabase
    .from('external_price_sources')
    .upsert(
      dedupedResults.map((result) => ({
        ...result,
        source_type: mode === 'openai_web_search' ? 'ai_web_search' : 'public_dataset',
        currency: 'XOF',
        collected_at: new Date().toISOString(),
      })),
      { onConflict: 'product_id,source_name,location_label' }
    );

  if (upsertError) {
    return new Response(JSON.stringify({ error: upsertError.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      mode,
      model: mode === 'openai_web_search' ? OPENAI_MODEL : null,
      openai_attempted: openAiAttempted,
      openai_succeeded: openAiSucceeded,
      openai_error: openAiError,
      openai_retry_after_ms: openAiRetryAfterMs,
      openai_response_ids: openAiResponseIds,
      openai_sources_count: openAiSourcesCount,
      batch_count: batches.length,
      scanned_at: new Date().toISOString(),
      products_updated: productsToScan.length,
      total_products_available: allProducts.length,
      offset,
      next_offset: hasMore ? nextOffset : null,
      has_more: hasMore,
      total_entries: dedupedResults.length,
    }),
    { headers: corsHeaders }
  );
});
