# 🔍 Qdrant Semantic Products Search POC

POC de busca semântica com **Qdrant Cloud + Xenova/Transformers + Express + TypeScript**.

---

## Como os Embeddings funcionam

Cada texto é convertido em um vetor de 384 números (um "endereço" em espaço multidimensional).
Textos com significado similar ficam próximos nesse espaço, mesmo usando palavras diferentes:

```
"bateria automotiva 12V"      → [0.12, -0.43, 0.87, ...]   ← 384 números
"acumulador elétrico veículo" → [0.11, -0.41, 0.85, ...]   ← próximo!
"pneu aro 15"                 → [-0.72, 0.33, -0.12, ...]  ← distante
```

O modelo `paraphrase-multilingual-MiniLM-L12-v2` roda **localmente** via `@xenova/transformers` — sem API key,
sem custo, sem dados saindo da sua máquina.

---

## Stack

| Camada        | Tecnologia                                        |
|---------------|---------------------------------------------------|
| Banco vetorial | Qdrant Cloud (gratuito até 1GB)                  |
| Embeddings    | `@xenova/transformers` → `paraphrase-multilingual-MiniLM-L12-v2` (384 dims, local) |
| API           | Express + TypeScript                              |
| Validação     | Zod                                               |

---

## 1. Configurar o Qdrant Cloud

1. Acesse **https://cloud.qdrant.io** e crie uma conta gratuita
2. Crie um novo cluster (plano Free — 1GB)
3. Copie o **Endpoint** do cluster (ex: `https://abc123.cloud.qdrant.io`)
4. Vá em **API Keys** → crie uma chave e copie

---

## 2. Configurar o projeto

```bash
cp .env.example .env
# Edite o .env com sua QDRANT_URL e QDRANT_API_KEY
```

```bash
npm install
npm run dev
```

---

## 3. Endpoints

### `GET /api/health`
Verifica conexão com o Qdrant Cloud e total de vetores indexados.

```bash
curl http://localhost:3000/api/health
```

---

### `POST /api/items` — Indexar itens

Body: `ItemInput[]`

```json
[
  {
    "titulo": "Bateria Moura 60Ah 12V",
    "descricao": "Bateria automotiva selada 12V 60Ah para veículos leves",
    "categoria": "produto",
    "preco": 459.90,
    "atributos": {
      "marca": "Moura",
      "capacidade_ah": 60,
      "voltagem": 12,
      "tipo": "selada"
    }
  }
]
```

**Atributos são livres** — qualquer chave/valor é aceito. O tipo (`keyword`, `integer`, `float`, `bool`)
é inferido automaticamente.

---

### `POST /api/busca` — Busca semântica

```json
{
  "query_semantica": "bateria automotiva 12V alta durabilidade Moura 60Ah",
  "categoria": "produto",
  "filtros": {
    "preco_min": 200,
    "preco_max": 500,
    "atributos_exatos": {
      "marca": "Moura",
      "voltagem": 12
    }
  },
  "top_k": 5
}
```

---

## 4. Modelagem do filtro Qdrant

```
Filter
├── MUST  → categoria = "produto"           ← elimina tudo que não for produto
├── MUST  → preco BETWEEN 200 AND 500       ← elimina fora do range (se informado)
└── SHOULD
    ├── atributos.marca   = "Moura"         ← pontua mais quem tem, mas não elimina quem não tem
    └── atributos.voltagem = 12
```

**Por que SHOULD nos atributos?**
O SHOULD no Qdrant não filtra — ele reordena por relevância.
Um item com `marca=Moura` e `voltagem=12` terá score maior que um com só `marca=Moura`,
que terá score maior que um sem nenhum dos dois. Combinado com a similaridade semântica,
o resultado final é um ranking que mistura semântica + atributos exatos.

---

## 5. Payload de um ponto no Qdrant

```typescript
{
  titulo: string
  descricao: string
  categoria: "produto" | "servico"  // indexado como keyword (MUST)
  preco?: number                    // indexado como float (range filter)
  atributos: {
    marca?: string        // keyword
    voltagem?: number     // integer
    sintetico?: boolean   // bool
    // ...qualquer campo dinâmico
  }
  texto_indexado: string  // texto que gerou o embedding (título + desc + atributos)
  criado_em: string       // ISO 8601
}
```

---

## 6. Teste rápido com curl

```bash
# Indexar
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '[
    {
      "titulo": "Bateria Moura 60Ah",
      "descricao": "Bateria automotiva selada 12V 60Ah",
      "categoria": "produto",
      "preco": 459.90,
      "atributos": { "marca": "Moura", "voltagem": 12, "capacidade_ah": 60 }
    }
  ]'

# Buscar
curl -X POST http://localhost:3000/api/busca \
  -H "Content-Type: application/json" \
  -d '{
    "query_semantica": "bateria automotiva 12V Moura para carro popular",
    "categoria": "produto",
    "filtros": {
      "preco_max": 500,
      "atributos_exatos": { "marca": "Moura" }
    }
  }'
```

---

## 7. Modelos de embedding disponíveis no Xenova

| Modelo | Dims | Tamanho | PT-BR |
|--------|------|---------|-------|
| `Xenova/all-MiniLM-L6-v2` | 384 | ~80MB | Razoável |
| `Xenova/multilingual-e5-large` | 1024 | ~560MB | Excelente |
| `Xenova/paraphrase-multilingual-MiniLM-L12-v2` | 384 | ~470MB | Bom |

Para trocar: altere `EMBEDDING_MODEL` e `EMBEDDING_DIMENSION` no `.env`
e **recrie a collection** (ou crie uma nova com o nome diferente em `QDRANT_COLLECTION`).