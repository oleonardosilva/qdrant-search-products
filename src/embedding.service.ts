import { pipeline, FeatureExtractionPipeline } from "@xenova/transformers";

const MODEL_NAME =
  process.env.EMBEDDING_MODEL ?? "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

/**
 * Singleton do pipeline de embeddings.
 * O modelo é baixado/cacheado na primeira chamada.
 */
let _pipeline: FeatureExtractionPipeline | null = null;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!_pipeline) {
    console.log(`[Embeddings] Carregando modelo ${MODEL_NAME}...`);
    _pipeline = await pipeline("feature-extraction", MODEL_NAME);
    console.log("[Embeddings] Modelo carregado.");
  }
  return _pipeline;
}

export async function gerarEmbedding(texto: string): Promise<number[]> {
  const pipe = await getPipeline();
  const output = await pipe(texto, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

export async function gerarEmbeddingsLote(
  textos: string[]
): Promise<number[][]> {
  const pipe = await getPipeline();

  const resultados = await Promise.all(
    textos.map((t) => {
      console.log(
        `[Embeddings] Gerando embedding para texto de ${t.length} caracteres...`
      );
      return pipe(t, { pooling: "mean", normalize: true });
    })
  );

  return resultados.map((r) => Array.from(r.data as Float32Array));
}

export function construirTextoIndexacao(params: {
  titulo: string;
  descricao: string;
  atributos?: Record<string, string | number | boolean>;
}): string {
  const partes: string[] = [params.titulo, params.descricao];

  if (params.atributos) {
    for (const [chave, valor] of Object.entries(params.atributos)) {
      partes.push(`${chave}: ${valor}`);
    }
  }

  return partes.filter(Boolean).join(" | ");
}
