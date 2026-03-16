const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

let mainWindow = null;
let serverProcess = null;
const PORT = 5799; // egyedi port, hogy ne ütközzön másokkal

// ── Backend szerver indítása ──────────────────────────────────────────────────
function startBackend() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(
      process.resourcesPath || path.join(__dirname, ".."),
      "app",
      "dist",
      "index.cjs"
    );

    // Dev módban (npm run electron:dev) a lokális build-et használjuk
    const actualPath = app.isPackaged
      ? serverPath
      : path.join(__dirname, "..", "dist", "index.cjs");

    serverProcess = spawn(process.execPath, [actualPath], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(PORT),
        ELECTRON_RUN: "1",
        // SQLite adatbázis a felhasználó AppData mappájában lesz
        DB_PATH: path.join(app.getPath("userData"), "prodai.db"),
      },
      cwd: app.isPackaged
        ? path.join(process.resourcesPath, "app")
        : path.join(__dirname, ".."),
    });

    serverProcess.stdout.on("data", (d) => {
      console.log("[server]", d.toString().trim());
    });
    serverProcess.stderr.on("data", (d) => {
      console.error("[server err]", d.toString().trim());
    });

    // Várunk amíg a szerver elindul
    let attempts = 0;
    const check = () => {
      attempts++;
      http
        .get(`http://localhost:${PORT}/api/machines`, (res) => {
          if (res.statusCode === 200) resolve();
          else if (attempts < 30) setTimeout(check, 500);
          else reject(new Error("Szerver nem indult el"));
        })
        .on("error", () => {
          if (attempts < 30) setTimeout(check, 500);
          else reject(new Error("Szerver nem érhető el"));
        });
    };
    setTimeout(check, 800);
  });
}

// ── Ablak létrehozása ─────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "ProdAI — Termeléstervező",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: "#f8fafc",
    show: false, // csak akkor mutatjuk, ha betöltött
  });

  // Menüsor egyszerűsítése
  const menu = Menu.buildFromTemplate([
    {
      label: "ProdAI",
      submenu: [
        { label: "Névjegy", click: () => {
          const { dialog } = require("electron");
          dialog.showMessageBox(mainWindow, {
            type: "info",
            title: "ProdAI",
            message: "ProdAI — AI vezérelt termeléstervező",
            detail: "Verzió: 1.0.0\nFejlesztő: Polyák Dominik\nSzéchenyi István Egyetem, 2026",
          });
        }},
        { type: "separator" },
        { label: "Kilépés", click: () => app.quit() },
      ],
    },
    {
      label: "Nézet",
      submenu: [
        { role: "reload", label: "Frissítés" },
        { role: "toggleDevTools", label: "Fejlesztői eszközök" },
        { type: "separator" },
        { role: "resetZoom", label: "Zoom visszaállítása" },
        { role: "zoomIn", label: "Zoom nagyítás" },
        { role: "zoomOut", label: "Zoom kicsinyítés" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Teljes képernyő" },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Külső linkek böngészőben nyílnak meg
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    await startBackend();
    createWindow();
  } catch (err) {
    console.error("Backend indítási hiba:", err);
    const { dialog } = require("electron");
    dialog.showErrorBox(
      "Indítási hiba",
      "A ProdAI szerver nem tudott elindulni.\n\nRészletek: " + err.message
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
