# Plan de Desarrollo: Frontend para Notes API

- [x] Crear estructura inicial con Express y TypeScript
- [x] Modificar `src/notes.router.ts` para agregar persistencia de notas en un archivo JSON `data/notes.json`
- [x] Crear el endpoint `GET /notes` leyendo desde `data/notes.json`
- [x] Crear el endpoint `POST /notes` escribiendo la nueva nota en `data/notes.json`
- [x] Ejecutar prueba de sintaxis y compilación
- [x] Configurar Express para servir archivos estáticos desde la carpeta `public/`
- [x] Crear el archivo `public/index.html` con un dashboard simple (lista de notas, buscador y formulario de creación)
- [x] Ejecutar `npx tsc --noEmit` para verificar que la configuración de Express y TypeScript sigue limpia
- [x] Implementar el endpoint `DELETE /notes/:id` en `src/notes.router.ts` para eliminar la nota por ID de `data/notes.json` y retornar status 200 o 204
- [x] Actualizar `public/index.html` añadiendo un botón de "Eliminar" en cada tarjeta de nota que ejecute `DELETE /notes/:id` mediante `fetch` y recargue la lista
- [x] Ejecutar auditoría de compilación con `npx tsc --noEmit` para verificar que no haya errores de tipos
- [x] Añadir la ruta `router.get('/count', ...)` dentro de `src/notes.router.ts` para responder `{ total: X }` y ejecutar `run_tests`
