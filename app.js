import express from 'express';
import notesRouter from './src/notes.router.js';
const app = express();
app.use(express.json());
app.use('/notes', notesRouter);
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
//# sourceMappingURL=app.js.map