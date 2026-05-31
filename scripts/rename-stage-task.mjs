#!/usr/bin/env node
/**
 * Rename terminology: Stage→Task, Task→Instrument
 * Uses placeholders to avoid collision during replace.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);
const SKIP_FILES = new Set(['schema.d.ts', 'rename-stage-task.mjs']);
const EXT = new Set(['.ts', '.tsx', '.yaml', '.yml', '.sql', '.md', '.txt']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.has(name.slice(name.lastIndexOf('.'))) && !SKIP_FILES.has(name)) out.push(p);
  }
  return out;
}

function transform(content) {
  let s = content;

  // --- Pass 1: old task_* → placeholders (instrument) ---
  const taskToInstr = [
    [/task_model_id/g, '§INSTRUMENT_MODEL_ID§'],
    [/task_models/g, '§INSTRUMENT_MODELS§'],
    [/task_model/g, '§INSTRUMENT_MODEL§'],
    [/TaskModel/g, '§InstrumentModel§'],
    [/task-models/g, '§instrument-models§'],
    [/task-model/g, '§instrument-model§'],
    [/listTaskModel/g, '§listInstrumentModel§'],
    [/createTaskModel/g, '§createInstrumentModel§'],
    [/getTaskModel/g, '§getInstrumentModel§'],
    [/updateTaskModel/g, '§updateInstrumentModel§'],
    [/deleteTaskModel/g, '§deleteInstrumentModel§'],
    [/taskModelId/g, '§instrumentModelId§'],
    [/taskModelKey/g, '§instrumentModelKey§'],
    [/task_model\.created/g, '§instrument_model.created§'],
    [/task_model\.updated/g, '§instrument_model.updated§'],
    [/task_model\.deleted/g, '§instrument_model.deleted§'],
    [/'task_model'/g, "'§INSTRUMENT_MODEL_STR§'"],
    [/CreateTaskModel/g, '§CreateInstrumentModel§'],
    [/UpdateTaskModel/g, '§UpdateInstrumentModel§'],
    [/listTasks\b/g, '§listInstruments§'],
    [/createTask\b/g, '§createInstrument§'],
    [/getTask\b/g, '§getInstrument§'],
    [/updateTask\b/g, '§updateInstrument§'],
    [/deleteTask\b/g, '§deleteInstrument§'],
    [/task_model_id:/g, '§instrument_model_id:§'],
    [/stage_id/g, '§TASK_ID§'], // on old Task instance (child of stage)
    [/\btasks\b/g, '§INSTRUMENTS§'], // table/routes instances - careful
    [/\/tasks\//g, '§/instruments/§'],
    [/\/tasks'/g, "§/instruments'§"],
    [/\/v1\/tasks/g, '§/v1/instruments§'],
    [/operationId: (get|update|delete|list)Task/g, 'operationId: $1Instrument'],
    [/operationId: createTask/g, 'operationId: createInstrument'],
    [/'task'/g, "'§INSTRUMENT_STR§'"],
    [/Task:/g, '§Instrument:§'],
    [/CreateTaskRequest/g, '§CreateInstrumentRequest§'],
    [/UpdateTaskRequest/g, '§UpdateInstrumentRequest§'],
    [/task\.created/g, '§instrument.created§'],
    [/task\.updated/g, '§instrument.updated§'],
    [/task\.deleted/g, '§instrument.deleted§'],
    [/task_id/g, '§instrument_id§'],
    [/taskId/g, '§instrumentId§'],
    [/kind === 'task_model'/g, "kind === '§INSTRUMENT_MODEL_STR§'"],
    [/kind: 'task_model'/g, "kind: '§INSTRUMENT_MODEL_STR§'"],
  ];
  for (const [re, rep] of taskToInstr) s = s.replace(re, rep);

  // --- Pass 2: old stage_* → task ---
  const stageToTask = [
    [/stage_model_id/g, 'task_model_id'],
    [/stage_models/g, 'task_models'],
    [/stage_model/g, 'task_model'],
    [/StageModel/g, 'TaskModel'],
    [/stage-models/g, 'task-models'],
    [/stage-model/g, 'task-model'],
    [/listStageModel/g, 'listTaskModel'],
    [/createStageModel/g, 'createTaskModel'],
    [/getStageModel/g, 'getTaskModel'],
    [/updateStageModel/g, 'updateTaskModel'],
    [/deleteStageModel/g, 'deleteTaskModel'],
    [/stageModelId/g, 'taskModelId'],
    [/stageModelKey/g, 'taskModelKey'],
    [/CaseModelStageModel/g, 'CaseModelTaskModel'],
    [/SetCaseModelStageModels/g, 'SetCaseModelTaskModels'],
    [/listCaseModelStageLinks/g, 'listCaseModelTaskLinks'],
    [/setCaseModelStageLinks/g, 'setCaseModelTaskLinks'],
    [/stage_model\.created/g, 'task_model.created'],
    [/stage_model\.updated/g, 'task_model.updated'],
    [/stage_model\.deleted/g, 'task_model.deleted'],
    [/'stage_model'/g, "'task_model'"],
    [/CreateStageModel/g, 'CreateTaskModel'],
    [/UpdateStageModel/g, 'UpdateTaskModel'],
    [/listStages\b/g, 'listTasks'],
    [/createStage\b/g, 'createTask'],
    [/getStage\b/g, 'getTask'],
    [/updateStage\b/g, 'updateTask'],
    [/deleteStage\b/g, 'deleteTask'],
    [/\bstages\b/g, 'tasks'],
    [/\/stages\//g, '/tasks/'],
    [/\/stages'/g, "/tasks'"],
    [/\/v1\/stages/g, '/v1/tasks'],
    [/operationId: (get|update|delete|list)Stage/g, 'operationId: $1Task'],
    [/operationId: createStage/g, 'operationId: createTask'],
    [/'stage'/g, "'task'"],
    [/Stage:/g, 'Task:'],
    [/CreateStageRequest/g, 'CreateTaskRequest'],
    [/UpdateStageRequest/g, 'UpdateTaskRequest'],
    [/stage\.created/g, 'task.created'],
    [/stage\.updated/g, 'task.updated'],
    [/stage\.deleted/g, 'task.deleted'],
    [/stage_id/g, 'task_id'],
    [/stageId/g, 'taskId'],
    [/kind === 'stage_model'/g, "kind === 'task_model'"],
    [/kind: 'stage_model'/g, "kind: 'task_model'"],
    [/modelsTypeStage/g, 'modelsTypeTask'],
    [/modelsParentStage/g, 'modelsParentTask'],
    [/modelsNoStageModels/g, 'modelsNoTaskModels'],
    [/modelsStageRequired/g, 'modelsTaskRequired'],
    [/StageModelOption/g, 'TaskModelOption'],
    [/useStageModels/g, 'useTaskModels'],
  ];
  for (const [re, rep] of stageToTask) s = s.replace(re, rep);

  // --- Pass 3: placeholders → instrument ---
  const instrMap = {
    '§INSTRUMENT_MODEL_ID§': 'instrument_model_id',
    '§INSTRUMENT_MODELS§': 'instrument_models',
    '§INSTRUMENT_MODEL§': 'instrument_model',
    '§InstrumentModel§': 'InstrumentModel',
    '§instrument-models§': 'instrument-models',
    '§instrument-model§': 'instrument-model',
    '§listInstrumentModel§': 'listInstrumentModel',
    '§createInstrumentModel§': 'createInstrumentModel',
    '§getInstrumentModel§': 'getInstrumentModel',
    '§updateInstrumentModel§': 'updateInstrumentModel',
    '§deleteInstrumentModel§': 'deleteInstrumentModel',
    '§instrumentModelId§': 'instrumentModelId',
    '§instrumentModelKey§': 'instrumentModelKey',
    '§instrument_model.created§': 'instrument_model.created',
    '§instrument_model.updated§': 'instrument_model.updated',
    '§instrument_model.deleted§': 'instrument_model.deleted',
    '§INSTRUMENT_MODEL_STR§': 'instrument_model',
    '§CreateInstrumentModel§': 'CreateInstrumentModel',
    '§UpdateInstrumentModel§': 'UpdateInstrumentModel',
    '§listInstruments§': 'listInstruments',
    '§createInstrument§': 'createInstrument',
    '§getInstrument§': 'getInstrument',
    '§updateInstrument§': 'updateInstrument',
    '§deleteInstrument§': 'deleteInstrument',
    '§instrument_model_id:§': 'instrument_model_id:',
    '§INSTRUMENTS§': 'instruments',
    '§/instruments/§': '/instruments/',
    "§/instruments'§": "/instruments'",
    '§/v1/instruments§': '/v1/instruments',
    '§INSTRUMENT_STR§': 'instrument',
    '§Instrument:§': 'Instrument:',
    '§CreateInstrumentRequest§': 'CreateInstrumentRequest',
    '§UpdateInstrumentRequest§': 'UpdateInstrumentRequest',
    '§instrument.created§': 'instrument.created',
    '§instrument.updated§': 'instrument.updated',
    '§instrument.deleted§': 'instrument.deleted',
    '§instrument_id§': 'instrument_id',
    '§instrumentId§': 'instrumentId',
    '§TASK_ID§': 'task_id',
  };
  for (const [from, to] of Object.entries(instrMap)) {
    s = s.split(from).join(to);
  }

  // UI labels
  s = s.replace(/Case Model/g, 'Case Model');
  s = s.replace(/Stage Model/g, 'Task Model');
  s = s.replace(/Task Model/g, (m, off) => {
    // second pass for former Task Model → Instrument Model in i18n - handle in messages separately
    return m;
  });

  return s;
}

const files = walk(ROOT);
let changed = 0;
for (const file of files) {
  if (file.includes('migrations/004_') || file.includes('migrations/005_') || file.includes('migrations/006_')) {
    continue; // keep historical migrations
  }
  if (file.includes('010_rename')) continue;
  const before = readFileSync(file, 'utf8');
  const after = transform(before);
  if (after !== before) {
    writeFileSync(file, after);
    changed++;
  }
}
console.log(`Updated ${changed} files`);
