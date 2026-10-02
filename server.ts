import app from './app.ts'

const PORT = process.env.PORT || 3002

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});