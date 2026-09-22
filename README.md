<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/540ce21a-e18b-44c8-b044-373750f4d923

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Variáveis de ambiente

As rotas em `api/` guardam as chaves das integrações: nenhuma delas pode ir
para o navegador, porque tudo que entra no bundle é público. Configure na
hospedagem (e em `.env.local` para rodar local):

| Variável | Para quê |
|---|---|
| `NEXUS_PUBLIC_API_KEY` | Base externa das fichas de vínculo (Nexus v3). |
| `NEXUS_GC_API_KEY` | **Nexu-GC** — criar e acompanhar as missões da equipe Delta. Começa com `nxs_live_`. É outro sistema, e outra chave, que não tem relação com o `NEXUS_PUBLIC_API_KEY` acima. |
| `NEXUS_GC_BASE_URL` | Opcional: aponta o Nexu-GC para outro ambiente. Sem ela vale a URL de produção. |
| `CCO_API_KEY` | Território e Censo (CCO). |
| `SERPAPI_API_KEY` | Busca de estabelecimentos e de endereços no mapa. |
| `OPENAI_API_KEY` | Relatório do NEO e transcrição de áudio. `OPENAI_MODEL` e `OPENAI_TRANSCRIBE_MODEL` trocam os modelos. |
| `DEVICE_IP_HMAC_KEY` | Sal do registro de dispositivo. |

Sem a chave, a rota correspondente responde com um recado dizendo qual
variável falta — a tela mostra esse recado em vez de falhar sem explicação.
