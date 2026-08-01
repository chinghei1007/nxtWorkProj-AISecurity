import { config } from "../src/config.js";
import { auditWithOpenAICompatible } from "../src/services/providers.js";

const profile = config.modelProfiles.find(
  (candidate) => candidate.id === config.DEFAULT_MODEL_PROFILE_ID,
);
if (!profile) throw new Error("The default model profile does not exist.");
const apiKey = process.env[profile.apiKeyEnv];
if (!apiKey) throw new Error("The default model profile has no configured API key.");

const result = await auditWithOpenAICompatible({
  apiKey,
  baseUrl: profile.baseUrl,
  model: profile.model,
  source: [
    "import express from \"express\";",
    "const app = express();",
    "app.get(\"/user\", async (req, res) => {",
    "  const result = await db.query(\"SELECT * FROM users WHERE id = \" + req.query.id);",
    "  res.json(result.rows);",
    "});",
  ].join("\n"),
});

console.log("Provider verification passed:");
console.log("- profile: " + profile.label);
console.log("- structured findings: " + result.findings.length);
console.log("- summary received: " + Boolean(result.summary));
