# Reglas Aprendidas del Proyecto (Memoria del Agente)

- Usa siempre importaciones ESM (`import fs from 'fs'`). Está estrictamente prohibido usar `require(...)`.
- En este proyecto Node ESM, las importaciones de archivos locales deben incluir la extensión `.js` (ejemplo: `import notesRouter from './src/notes.router.js'`).
- El punto de entrada principal del servidor es `app.ts` en la raíz. No intentes crear ni ejecutar `server.ts`.
- Al modificar archivos existentes con `write_file`, conserva todo el código anterior y agrega únicamente las nuevas funciones solicitadas.
- Al importar tipos de TypeScript (como Request, Response de 'express'), utiliza siempre 'import { type Request, type Response }' debido a la regla verbatimModuleSyntax del tsconfig.json.
- Asegúrate de que el archivo 'src/notes.router.ts' contenga la propiedad 'createdAt?: string' en la interfaz Note, asignar new Date().toISOString() en POST /notes para notas nuevas y ordenar las notas descendentemente por createdAt antes de responder en GET /notes.
- Se ha completado la tarea 1. Se han agregado 'createdAt?: string' a la interfaz Note, se ha asignado new Date().toISOString() en POST /notes para notas nuevas y se han ordenado las notas descendentemente por createdAt antes de responder en GET /notes.
