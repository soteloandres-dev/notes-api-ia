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
// 1. HERRAMIENTAS DEL SISTEMA
// ============================================================================

function cleanCodeContent(content) {
  if (!content) return '';
  return content
    .replace(/<\/?(?:tool_response|code_block|content|code)[^>]*>/gi, '')
    .replace(/^```[a-z]*\n?/gm, '')
    .replace(/```$/gm, '')
    .trim();
}

function readFile(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) return `Error: El archivo '${filePath}' no existe.`;
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (error) {
    return `Error al leer archivo: ${error.message}`;
  }
}

function writeFile(filePath, content) {
  try {
    // 🟢 Prevenir que el agente escriba en .js en lugar de .ts dentro de src/
    let targetPath = filePath;
    if (targetPath.endsWith('.js') && !targetPath.includes('node_modules')) {
      const tsPath = targetPath.replace(/\.js$/, '.ts');
      if (fs.existsSync(path.resolve(tsPath)) || targetPath.includes('src/')) {
        targetPath = tsPath;
      }
    }

    const fullPath = path.resolve(targetPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const cleanContent = cleanCodeContent(content);
    fs.writeFileSync(fullPath, cleanContent, 'utf-8');
    return `Éxito: El archivo '${targetPath}' fue actualizado/creado correctamente.`;
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
    const rulesPath = path.resolve('agent_rules.md');
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
    fs.writeFileSync('temp_runner.ts', testScript, 'utf-8');
    const output = execSync('npx tsx temp_runner.ts', { encoding: 'utf-8', cwd: process.cwd() });
    if (fs.existsSync('temp_runner.ts')) fs.unlinkSync('temp_runner.ts');
    return `Éxito en las pruebas HTTP:\n${output}`;
  } catch (error) {
    if (fs.existsSync('temp_runner.ts')) fs.unlinkSync('temp_runner.ts');
    return `Error en las pruebas HTTP:\n${error.stdout || error.stderr || error.message}`;
  }
}

function getAgentRules() {
  const rulesPath = path.resolve('agent_rules.md');
  if (fs.existsSync(rulesPath)) {
    return fs.readFileSync(rulesPath, 'utf-8');
  }
  return "No hay reglas aprendidas previas.";
}

// 🟢 CORRECCIÓN CLAVE 1: Mapear 'run_tests' en los ejecutores
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
      description: 'Lee el contenido de un archivo local.',
      parameters: {
        type: 'object',
        properties: { filePath: { type: 'string', description: 'Ruta del archivo' } },
        required: ['filePath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Crea o sobrescribe un archivo en el disco.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Ruta del archivo (.ts para código en src/)' },
          content: { type: 'string', description: 'Contenido a escribir' }
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
      description: 'Guarda una regla o lección aprendida en agent_rules.md cuando resuelves un error técnico complejo.',
      parameters: {
        type: 'object',
        properties: { rule: { type: 'string', description: 'La regla clara y concisa a recordar para el futuro' } },
        required: ['rule']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_tests',
      description: 'Ejecuta una serie de peticiones HTTP (GET, POST) contra la API para validar que los endpoints respondan correctamente sin errores 500 o 404.',
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
// 2. BUCLE PRINCIPAL
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
      content: `Eres un desarrollador experto en Node.js, Express y TypeScript.
Tu trabajo es ejecutar las tareas de 'plan.md' una por una.

REGLAS OBLIGATORIAS Y MEMORIA DE PROYECTO:
${memoryRules}
// Dentro del arreglo messages en agent.js (en el role: 'system'):

REGLA CRÍTICA DE EDICIÓN:
Al modificar un archivo existente con 'write_file', DEBES leerlo primero con 'read_file' y MANTENER todo el código, imports y rutas anteriores, agregando únicamente la nueva función solicitada. Queda PROHIBIDO sobrescribir un archivo dejando solo el código nuevo.

REGLAS DE ARCHIVOS Y PRUEBAS:
1. Al usar 'write_file' en la carpeta 'src/', SIEMPRE escribe en archivos '.ts' (ejemplo: 'src/notes.router.ts').
2. Cuando la tarea pida 'ejecutar run_tests', usa DIRECTAMENTE la herramienta 'run_tests'.
3. Trabaja en UNA sola tarea a la vez y actualiza 'plan.md' marcando [- [x]] al finalizar.`
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

    // 🟢 CORRECCIÓN CLAVE 2: Mantener el System Prompt activo recortando solo el historial reciente
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
      let wroteFiles = false;

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
        if (name === 'write_file') wroteFiles = true;

        console.log(`[Acción]: Ejecutando '${name}'`);
        const executor = toolExecutors[name];
        const result = executor ? executor(args) : 'Herramienta no encontrada';
        console.log(`  └─ Resultado: ${result.slice(0, 120)}...\n`);

        messages.push({ role: 'tool', content: result });
      }

      if (wroteFiles) {
        console.log(`[Autocorrección]: Verificando tipos con 'npx tsc --noEmit'...`);
        const tsAudit = checkTypeScript();
        if (tsAudit.success) {
          console.log(`[Autocorrección]: TypeScript OK (0 errores).\n`);
        } else {
          console.log(`[Autocorrección]: Error detectado. Solicitando corrección...\n`);
          messages.push({
            role: 'user',
            content: `Error de compilación en TypeScript:\n\n${tsAudit.error}\n\n1. Corrige el código con write_file asegurando que modificas el archivo .ts correspondiente.`
          });
        }
      }
    } else {
      console.log(`[Respuesta Agente]: ${response.message.content}`);
    }
  }
}

runPlanAgent();