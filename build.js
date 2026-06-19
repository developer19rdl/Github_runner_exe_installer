const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const pkgJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = pkgJson.version;
const outDir = path.join("Build", `v${version}`);

// Create the versioned output directory
fs.mkdirSync(outDir, { recursive: true });

console.log(`Building hello-node v${version} -> ${outDir}`);

// Compile with pkg: targets a standalone Windows exe
execSync(
  `npx pkg index.js --targets node18-win-x64 --output "${path.join(outDir, "your-app.exe")}"`,
  { stdio: "inherit" }
);

console.log(`Done! Your .exe is at: ${path.join(outDir, "your-app.exe")}`);