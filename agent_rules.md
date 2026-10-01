# Reglas Aprendidas del Proyecto (Memoria del Agente)

- Usa siempre importaciones ESM (`import fs from 'fs'`). Está estrictamente prohibido usar `require(...)`.
- En este proyecto Node ESM, las importaciones de archivos locales deben incluir la extensión `.js` (ejemplo: `import notesRouter from './src/notes.router.js'`).
- El punto de entrada principal del servidor es `app.ts` en la raíz. No intentes crear ni ejecutar `server.ts`.
- Al modificar archivos existentes con `write_file`, conserva todo el código anterior y agrega únicamente las nuevas funciones solicitadas.