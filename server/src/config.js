const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = '7d';
const AI_PROVIDER = process.env.AI_PROVIDER || 'mock';

// RunningHub 接入配置（AI_PROVIDER=runninghub 时使用）
const RH_API_KEY = process.env.RH_API_KEY || '';
const RH_BASE_URL = process.env.RH_BASE_URL || 'https://www.runninghub.cn';
const RH_WORKFLOW_ID_WASH = process.env.RH_WORKFLOW_ID_WASH || '';
const RH_WORKFLOW_ID_FACESWAP = process.env.RH_WORKFLOW_ID_FACESWAP || '';
const RH_WORKFLOW_ID_ENHANCE = process.env.RH_WORKFLOW_ID_ENHANCE || '';

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const FACES_DIR = path.join(UPLOAD_DIR, 'faces');
const REFERENCES_DIR = path.join(UPLOAD_DIR, 'references');
const DEBUG_DIR = path.join(UPLOAD_DIR, 'debug');
const GENERATED_DIR = path.join(DATA_DIR, 'generated');
const MOCK_JOBS_DIR = path.join(DATA_DIR, '.mock', 'jobs');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

for (const d of [DATA_DIR, UPLOAD_DIR, FACES_DIR, REFERENCES_DIR, DEBUG_DIR, GENERATED_DIR, MOCK_JOBS_DIR, PUBLIC_DIR]) {
  fs.mkdirSync(d, { recursive: true });
}

module.exports = {
  DATA_DIR,
  PORT,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  AI_PROVIDER,
  RH_API_KEY,
  RH_BASE_URL,
  RH_WORKFLOW_ID_WASH,
  RH_WORKFLOW_ID_FACESWAP,
  RH_WORKFLOW_ID_ENHANCE,
  UPLOAD_DIR,
  FACES_DIR,
  REFERENCES_DIR,
  DEBUG_DIR,
  GENERATED_DIR,
  MOCK_JOBS_DIR,
  PUBLIC_DIR,
};
