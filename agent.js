import { Ollama } from 'ollama';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// 🟢 Cliente de Ollama con timeout extendido a 5 minutos
const ollama = new Ollama({
  fetch: (url, options) => {
    return fetch(url, {
      ...options,
      signal: AbortSignal.timeout(300000)
    });
  }
});

// ============================================================================
// 1. HERRAMIENTAS DEL SISTEMA Y MANEJO DE RUTAS
// ============================================================================

function cleanCodeContent(content) {
  if (!content) return '';
  return content
    .replace(/<\/?(?:tool_response|code_block|content|code)[^>]*>/gi, '')
    .replace(/^```[a-z]*\n?/gm, '')
    .replace(/```$/gm, '')
    .trim();
}

function resolveProjectPath(filePath) {
  // Garantiza que la ruta siempre sea relativa a la raíz del proyecto
  const normalized = path.normalize(filePath).replace(/^(\.\/|\/)/, '');
  return path.resolve(process.cwd(), normalized);
}

function readFile(filePath) {
  try {
    const fullPath = resolveProjectPath(filePath);
    if (!fs.existsSync(fullPath)) return `Error: El archivo '${filePath}' no existe en '${fullPath}'.`;
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (error) {
    return `Error al leer archivo: ${error.message}`;
  }
}

function markTaskAsCompletedInPlan(taskText) {
  try {
    const planPath = resolveProjectPath('plan.md');
    if (!fs.existsSync(planPath)) return;

    let content = fs.readFileSync(planPath, 'utf-8');
    // Escapa caracteres especiales de regex para buscar la tarea exacta
    const escapedTask = taskText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`- \\[ \\] ${escapedTask}`, 'g');

    if (regex.test(content)) {
      const updatedContent = content.replace(regex, `- [x] ${taskText}`);
      fs.writeFileSync(planPath, updatedContent, 'utf-8');
      console.log(`\n✅ [Auto-Plan]: Tarea marcada en 'plan.md' automáticamente: "${taskText.slice(0, 50)}..."\n`);
    }
  } catch (error) {
    console.error(`Error actualizando plan.md automáticamente: ${error.message}`);
  }
}

function writeFile(filePath, content) {
  try {
    const fullPath = resolveProjectPath(filePath);
    
    // Crear directorios padres si no existen
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    
    const cleanContent = cleanCodeContent(content);
    fs.writeFileSync(fullPath, cleanContent, 'utf-8');
    
    // Retornar la ruta relativa limpia para retroalimentación
    const relativePath = path.relative(process.cwd(), fullPath);
    return `Éxito: El archivo '${relativePath}' fue actualizado/creado correctamente.`;
  } catch (error) {
    return `Error al escribir archivo: ${error.message}`;
  }
}

function executeCommand(command) {
  try {
    console.log(`[Consola]: Ejecutando -> ${command}`);
    const output = execSync(command, { encoding: 'utf-8', cwd: process.cwd() });
    return `Éxito al ejecutar comando:\n${output}`;
  } catch (error) {
    return `Error al ejecutar comando '${command}':\n${error.stdout || error.stderr || error.message}`;
  }
}

function saveRule(rule) {
  try {
    const rulesPath = resolveProjectPath('agent_rules.md');
    const cleanRule = `- ${rule.trim().replace(/^- /, '')}\n`;
    
    if (!fs.existsSync(rulesPath)) {
      fs.writeFileSync(rulesPath, `# Reglas Aprendidas del Proyecto\n\n${cleanRule}`, 'utf-8');
    } else {
      fs.appendFileSync(rulesPath, cleanRule, 'utf-8');
    }
    console.log(`🧠 [Memoria Guardada]: Regla añadida a 'agent_rules.md': "${rule.trim()}"`);
    return `Éxito: Se ha guardado la nueva regla en 'agent_rules.md'.`;
  } catch (error) {
    return `Error al guardar la regla: ${error.message}`;
  }
}

function checkTypeScript() {
  try {
    execSync('npx tsc --noEmit', { encoding: 'utf-8', cwd: process.cwd() });
    return { success: true, error: null };
  } catch (error) {
    const output = error.stdout || error.stderr || error.message;
    return { success: false, error: output };
  }
}

function runApiTests() {
  const testScript = `
    import request from 'supertest';
    import app from './app.js';

    async function testApi() {
      try {
        const healthRes = await request(app).get('/health');
        if (healthRes.status !== 200) throw new Error('GET /health fallo');

        const getRes = await request(app).get('/notes');
        if (getRes.status !== 200) throw new Error('GET /notes fallo');

        const postRes = await request(app)
          .post('/notes')
          .send({ title: 'Nota de Test', content: 'Contenido autogenerado' });
        if (postRes.status !== 201 && postRes.status !== 200) {
          throw new Error('POST /notes fallo al crear la nota');
        }

        console.log('SUCCESS: Todas las pruebas HTTP pasaron correctamente.');
      } catch (err) {
        console.error('FAILED:', err.message);
        process.exit(1);
      }
    }

    testApi();
  `;

  try {
    const tempRunnerPath = resolveProjectPath('temp_runner.ts');
    fs.writeFileSync(tempRunnerPath, testScript, 'utf-8');
    const output = execSync('npx tsx temp_runner.ts', { encoding: 'utf-8', cwd: process.cwd() });
    if (fs.existsSync(tempRunnerPath)) fs.unlinkSync(tempRunnerPath);
    return `Éxito en las pruebas HTTP:\n${output}`;
  } catch (error) {
    const tempRunnerPath = resolveProjectPath('temp_runner.ts');
    if (fs.existsSync(tempRunnerPath)) fs.unlinkSync(tempRunnerPath);
    return `Error en las pruebas HTTP:\n${error.stdout || error.stderr || error.message}`;
  }
}

function getAgentRules() {
  const rulesPath = resolveProjectPath('agent_rules.md');
  if (fs.existsSync(rulesPath)) {
    return fs.readFileSync(rulesPath, 'utf-8');
  }
  return "No hay reglas aprendidas previas.";
}

// ============================================================================
// 2. HERRAMIENTAS Y EJECUTORES
// ============================================================================

const toolExecutors = {
  read_file: (args) => readFile(args.filePath),
  write_file: (args) => writeFile(args.filePath, args.content),
  execute_command: (args) => executeCommand(args.command),
  save_rule: (args) => saveRule(args.rule),
  run_tests: () => runApiTests(),
};

const tools = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Lee el contenido de un archivo local en la raíz del proyecto.',
      parameters: {
        type: 'object',
        properties: { filePath: { type: 'string', description: 'Ruta relativa del archivo desde la raíz (ej: "src/notes.router.ts", "public/index.html")' } },
        required: ['filePath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Crea o sobrescribe un archivo en el disco respetando la estructura del proyecto.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Ruta relativa exacta del archivo desde la raíz del proyecto (ej: "src/notes.router.ts", "public/index.html")' },
          content: { type: 'string', description: 'Contenido completo del archivo' }
        },
        required: ['filePath', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'execute_command',
      description: 'Ejecuta un comando en la terminal del sistema.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: 'Comando a ejecutar' } },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'save_rule',
      description: 'Guarda una regla o lección aprendida en agent_rules.md.',
      parameters: {
        type: 'object',
        properties: { rule: { type: 'string', description: 'La regla clara y concisa a recordar' } },
        required: ['rule']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_tests',
      description: 'Ejecuta las pruebas de integración HTTP contra la API.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
];

function extractToolsFromText(text) {
  if (!text) return [];
  const toolCalls = [];
  const jsonRegex = /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}/g;
  let match;

  while ((match = jsonRegex.exec(text)) !== null) {
    try {
      toolCalls.push({
        function: { name: match[1], arguments: JSON.parse(match[2]) }
      });
    } catch (e) {}
  }
  return toolCalls;
}

function getNextTaskFromPlan(planContent) {
  const lines = planContent.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('- [ ]')) {
      return line.replace('- [ ]', '').trim();
    }
  }
  return null;
}

// ============================================================================
// 3. BUCLE PRINCIPAL CON CONTEXTO DE ARQUITECTURA
// ============================================================================

async function runPlanAgent() {
  console.log(`\n==================================================`);
  console.log(` AGENTE CON PRUEBAS Y MEMORIA PERSISTENTE INICIADO`);
  console.log(`==================================================\n`);

  let isWorking = true;
  let iterations = 0;
  const maxIterations = 15;

  const memoryRules = getAgentRules();
  console.log(`🧠 [Memoria Cargada]: Se leyeron las reglas de 'agent_rules.md'\n`);

  const messages = [
    {
      role: 'system',
      content: `Eres un desarrollador Full-Stack experto en Node.js, Express, TypeScript y Frontend.
Tu objetivo es completar las tareas de 'plan.md' una a una con máxima precisión.

ARQUITECTURA DE DIRECTORIOS DEL PROYECTO:
- 'src/' -> Exclusivo para código de la API backend en TypeScript (.ts). No coloques vistas HTML o assets aquí.
- 'public/' -> Exclusivo para código del frontend web estático (index.html, JS cliente, CSS).
- 'data/' -> Archivos de persistencia local en JSON (notes.json).
- Raíz ('./') -> Archivos de configuración (package.json, tsconfig.json, plan.md, agent_rules.md).

REGLAS OBLIGATORIAS:
1. Respetar siempre las rutas según la arquitectura indicada (ej: las vistas van en 'public/index.html', nunca dentro de 'src/').
2. Antes de modificar un archivo existente con 'write_file', léelo con 'read_file' y conserva su estructura previo a los cambios.
3. Al modificar archivos dentro de 'src/', asegúrate de que sean archivos TypeScript (.ts). No alteres 'tsconfig.json' salvo que la tarea lo solicite explícitamente.
4. Tras completar los cambios solicitados en una tarea, el sistema actualizará 'plan.md' automáticamente.
5. NO intentes hacer commits en Git.

REGLAS APRENDIDAS Y MEMORIA:
${memoryRules}`
    }
  ];

  let lastAction = null;

  while (isWorking && iterations < maxIterations) {
    iterations++;

    const planContent = readFile('plan.md');
    if (planContent.startsWith('Error:')) {
      console.log(`[Error]: No se encontró 'plan.md'.`);
      break;
    }

    const currentTask = getNextTaskFromPlan(planContent);

    if (!currentTask) {
      console.log(`\n[Éxito Total]: Todas las tareas en 'plan.md' han sido completadas [- [x]].\n`);
      break;
    }

    console.log(`--------------------------------------------------`);
    console.log(`[Paso ${iterations}]: Tarea Activa -> "${currentTask}"`);
    console.log(`--------------------------------------------------\n`);

    messages.push({
      role: 'user',
      content: `Estado actual de plan.md:\n\n${planContent}\n\nTAREA ACTIVA: "${currentTask}".`
    });

    const recentMessages = [
      messages[0],
      ...messages.slice(-6)
    ];

    const response = await ollama.chat({
      model: 'qwen2.5-coder',
      messages: recentMessages,
      tools: tools,
      options: { temperature: 0.1, repeat_penalty: 1.1 }
    });

    messages.push(response.message);

    let toolCalls = response.message.tool_calls || [];
    if (toolCalls.length === 0 && response.message.content) {
      toolCalls = extractToolsFromText(response.message.content);
    }

    if (toolCalls.length > 0) {
      let modifiedFiles = [];

      for (const toolCall of toolCalls) {
        const name = toolCall.function.name;
        let args = toolCall.function.arguments;
        if (typeof args === 'string') {
          try { args = JSON.parse(args); } catch (e) {}
        }

        if (name === 'read_file' && lastAction === 'read_file') {
          console.log(`⚠ [Advertencia Loop]: Evitando doble lectura continua...\n`);
        }

        lastAction = name;
        if (name === 'write_file' && args.filePath) {
          modifiedFiles.push(args.filePath);
        }

        console.log(`[Acción]: Ejecutando '${name}'`);
        const executor = toolExecutors[name];
        const result = executor ? executor(args) : 'Herramienta no encontrada';
        console.log(`  └─ Resultado: ${result.slice(0, 120)}...\n`);

        messages.push({ role: 'tool', content: result });
      }

      const wroteFiles = modifiedFiles.length > 0;

      if (wroteFiles) {
        // 1. Marca la tarea en plan.md automáticamente tras cualquier modificación exitosa de archivos
        markTaskAsCompletedInPlan(currentTask);

        // 2. Autocorrección INTELIGENTE: solo audita TypeScript si se modificaron archivos .ts en src/
        const modifiedTsFile = modifiedFiles.some(file => file.endsWith('.ts') || file.includes('src/'));

        if (modifiedTsFile) {
          console.log(`[Autocorrección]: Verificando tipos con 'npx tsc --noEmit'...`);
          const tsAudit = checkTypeScript();
          if (tsAudit.success) {
            console.log(`[Autocorrección]: TypeScript OK (0 errores).\n`);
          } else {
            console.log(`[Autocorrección]: Error de compilación detectado. Solicitando corrección al agente...\n`);
            messages.push({
              role: 'user',
              content: `Error de compilación en TypeScript:\n\n${tsAudit.error}\n\nCorrige únicamente los tipos o declaraciones en el archivo .ts correspondiente dentro de 'src/'. NO modifiques tsconfig.json.`
            });
          }
        }
      }
    } else {
      console.log(`[Respuesta Agente]: ${response.message.content}`);
    }
  }
}

runPlanAgent();