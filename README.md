<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e141bd02-2a45-4d25-9160-aa459f3602f6

## Run Locally

**Prerequisites:** Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Modo demo (sin API key, gratis)

Para probar toda la interfaz sin gastar cuota de Gemini ni configurar API key,
arranca con la variable `MOCK_AI=true`. El servidor devolverá respuestas simuladas
(las 4 fases y el veredicto) en lugar de llamar a la API:

```bash
# macOS / Linux
MOCK_AI=true npm run dev

# Windows (PowerShell)
$env:MOCK_AI="true"; npm run dev
```

En producción, sin esa variable, la app usa la API real de Gemini con tu clave.
