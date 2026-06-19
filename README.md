# Hello Node — Versioned EXE Builder + Auto-Deploy Pipeline

A minimal Node.js HTTP server that prints "Hello World", compiled into a standalone `.exe` with automatic versioned folders and a GitHub Actions self-hosted runner deployment pipeline.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Running Locally](#running-locally)
- [Building a Versioned EXE](#building-a-versioned-exe)
- [GitHub Actions Auto-Deploy Pipeline](#github-actions-auto-deploy-pipeline)
- [Installing a Self-Hosted GitHub Runner](#installing-a-self-hosted-github-runner)
- [Full Workflow Summary](#full-workflow-summary)

---

## Project Structure

```
TEST/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions auto-deploy workflow
├── Build/
│   ├── v1.0.0/
│   │   └── your-app.exe        # Compiled standalone executable
│   ├── v1.1.0/
│   │   └── your-app.exe
│   ├── v2.0.0/
│   │   └── your-app.exe
│   ├── v3.0.0/
│   │   └── your-app.exe
│   ├── v4.0.0/
│   │   └── your-app.exe
│   └── v5.0.0/
│       └── your-app.exe
├── .gitattributes
├── .gitignore
├── build.js                    # Build script — compiles .exe with pkg
├── index.js                    # HTTP server — "Hello World" on port 3000
├── package-lock.json
└── package.json                # Project manifest + build script
```

---

## Prerequisites

- **[Node.js](https://nodejs.org/)** v18+ (including npm)
- **Git** (for version control and GitHub Actions)

---

## Running Locally

```powershell
# Install dependencies
npm install

# Start the server
npm start
# OR
node index.js
```

The server starts at `http://localhost:3000`. Test it:

```powershell
curl http://localhost:3000
# Output: Hello World
```

Press `Ctrl + C` to stop.

---

## Building a Versioned EXE

This project uses **`pkg`** (by Vercel) to compile `index.js` into a standalone Windows `.exe`. No Node.js installation is needed on the target machine.

### Step 1 — Bump the version

Edit `package.json` manually, or use the CLI:

```powershell
npm pkg set version=1.0.0   # Set to whatever version you want
```

### Step 2 — Build

```powershell
npm run build
```

The `build.js` script will:

1. Read the `version` field from `package.json`
2. Create a folder `Build/v{version}/` (e.g. `Build/v6.0.0/`)
3. Run `pkg` to compile `index.js` into `Build/v{version}/your-app.exe`

### Step 3 — Verify

```powershell
# Check the new build
dir Build\v6.0.0\
# Output: your-app.exe   (≈ 37 MB, standalone)

# Run it directly (no Node needed)
.\Build\v6.0.0\your-app.exe

# In another terminal, test it
curl http://localhost:3000
# Output: Hello World
```

### How `build.js` works

```javascript
const pkgJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = pkgJson.version;
const outDir = path.join("Build", `v${version}`);

// Create versioned output folder
fs.mkdirSync(outDir, { recursive: true });

// Compile with pkg
execSync(
  `npx pkg index.js --targets node18-win-x64 --output "${path.join(outDir, "your-app.exe")}"`,
  { stdio: "inherit" }
);
```

---

## GitHub Actions Auto-Deploy Pipeline

The file `.github/workflows/deploy.yml` automates deployment whenever a new `.exe` is pushed to the `Build/` folder on the `main` branch.

### Workflow trigger

```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'Build/**/*.exe'
```

Only runs when a `.exe` file is pushed inside `Build/`.

### Step-by-step breakdown

| Step | What it does |
|------|-------------|
| **1. Checkout** | Pulls the latest code using `actions/checkout@v4` |
| **2. Find newest EXE** | Recursively searches `Build/` for `.exe` files, picks the most recently modified one, saves its path to `$env:EXE_PATH` |
| **3. Stop old app** | Uses `Stop-Process -Name "your-app" -Force` (safe try/catch if not running) |
| **4. Copy new EXE** | Creates `C:\MyApp` folder if missing, copies the new `.exe` to `C:\MyApp\your-app.exe` |
| **5. Start new app** | Unsets `$env:RUNNER_TRACKING_ID` (prevents runner from killing the child process), launches the `.exe` hidden and detached |

### Full deploy.yml

```yaml
name: Deploy Versioned EXE

on:
  push:
    branches:
      - main
    paths:
      - 'Build/**/*.exe'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: [self-hosted, windows]

    steps:
      - name: Checkout latest code
        uses: actions/checkout@v4

      - name: Find the newest EXE in the version folders
        id: find_exe
        run: |
          $latestExe = Get-ChildItem -Path ".\Build" -Filter "*.exe" -Recurse |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
          if (-not $latestExe) {
            Write-Error "Could not find any .exe files in the Build directory!"
            exit 1
          }
          Write-Host "Success! Deploying newest EXE: $($latestExe.FullName)"
          echo "EXE_PATH=$($latestExe.FullName)" >> $env:GITHUB_ENV
        shell: powershell

      - name: Stop the existing app on the server
        run: |
          try {
            Stop-Process -Name "your-app" -Force -ErrorAction Stop
            Write-Host "App successfully stopped."
          } catch {
            Write-Host "App was not running."
          }
        shell: powershell

      - name: Copy the specific version EXE to the live folder
        run: |
          New-Item -ItemType Directory -Force -Path "C:\MyApp"
          Copy-Item -Path $env:EXE_PATH -Destination "C:\MyApp\your-app.exe" -Force
        shell: powershell

      - name: Start the newly installed EXE
        run: |
          $env:RUNNER_TRACKING_ID = ""
          Start-Process -FilePath "C:\MyApp\your-app.exe" -WorkingDirectory "C:\MyApp" -WindowStyle Hidden
        shell: powershell
```

---

## Installing a Self-Hosted GitHub Runner

A self-hosted runner allows GitHub Actions to run workflows directly on your Windows machine.

### Step 1 — Go to your repository settings

1. Open your repo on GitHub: `https://github.com/developer19rdl/Github_runner_exe_installer`
2. Click **Settings** → **Actions** → **Runners**
3. Click **New self-hosted runner** → Choose **Windows** → **x64**

### Step 2 — Download and extract the runner

```powershell
# Create the runner directory
mkdir C:\actions-runner

# Move into it
cd C:\actions-runner

# Download the runner zip
Invoke-WebRequest -Uri https://github.com/actions/runner/releases/download/v2.335.1/actions-runner-win-x64-2.335.1.zip -OutFile actions-runner-win-x64-2.335.1.zip

# Verify the checksum (optional but recommended)
if((Get-FileHash -Path actions-runner-win-x64-2.335.1.zip -Algorithm SHA256).Hash.ToUpper() -ne 'eb65c95277af42bcf3778a799c41359d224ba2a67b4de26b7cea1729b09c803d'.ToUpper()){ throw 'Computed checksum did not match' }

# Extract the zip
Add-Type -AssemblyName System.IO.Compression.FileSystem ;
[System.IO.Compression.ZipFile]::ExtractToDirectory("$PWD/actions-runner-win-x64-2.335.1.zip", "$PWD")
```

### Step 3 — Configure the runner

Run the config command with your repository URL and token (get these from the GitHub Runners page):

```powershell
./config.cmd --url https://github.com/developer19rdl/Github_runner_exe_installer --token YOUR_TOKEN_HERE
```

During configuration:

- **Runner group**: press Enter for default
- **Runner name**: press Enter for default (your computer name)
- **Labels**: press Enter to skip (default `self-hosted, Windows, X64`)
- **Work folder**: press Enter for default (`_work`)

### Step 4 — Install as a Windows service (recommended)

When prompted `Would you like to run the runner as service?`, type **`y`**:

```
Would you like to run the runner as service? (Y/N) [press Enter for N] y
User account to use for the service [press Enter for NT AUTHORITY\NETWORK SERVICE]
```

Press Enter to use `NT AUTHORITY\NETWORK SERVICE`. The runner will be installed and started automatically.

### Step 5 — Set PowerShell execution policy

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine -Force
```

### Verification

On GitHub: **Settings** → **Actions** → **Runners** → you should see your runner listed with a green "Idle" status.

On your machine:

```powershell
# Check the service status
Get-Service -Name "actions.runner.*"
```

---

## Full Workflow Summary

```
                          ┌──────────────────────┐
                          │   Edit index.js       │
                          │   or update version   │
                          └──────────┬───────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │  npm run build        │
                          │  → Build/vX.X.X/      │
                          │    your-app.exe       │
                          └──────────┬───────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │  git add .            │
                          │  git commit           │
                          │  git push origin main │
                          └──────────┬───────────┘
                                     │
                                     ▼
                   ┌──────────────────────────────────┐
                   │  GitHub Actions detects new .exe  │
                   │  under Build/**/*.exe             │
                   └──────────┬───────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────────────────┐
              │   Self-hosted runner (Windows) executes:  │
              │                                           │
              │   1. Find newest .exe in Build/           │
              │   2. Stop old your-app.exe process        │
              │   3. Copy new .exe → C:\MyApp\            │
              │   4. Start the new .exe                   │
              └───────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────────────────┐
              │  ✅ New version is live!                  │
              │  http://localhost:3000 → "Hello World"    │
              └───────────────────────────────────────────┘