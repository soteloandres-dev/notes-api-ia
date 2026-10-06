# Plan de Implementación de Fecha de Creación y Ordenamiento

- [x] 1. Editar src/notes.router.ts para agregar 'createdAt?: string' a la interfaz Note, asignar new Date().toISOString() en POST /notes para notas nuevas y ordenar las notas descendentemente por createdAt antes de responder en GET /notes.
- [x] 2. Crear la función auxiliar formatDate(isoString) en el script de public/index.html para retornar new Date(isoString).toLocaleString('es-CL').
- [x] 3. Editar public/index.html dentro de loadNotes para incluir <span>📅 ${formatDate(n.createdAt)}</span> al lado del ID de la tarjeta.